// server.js — 高并发秒杀系统核心服务
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// ===== 库存管理 =====
const INVENTORY = {
  PRODUCTS: {
    'iphone-16': { name: 'iPhone 16 Pro', price: 8999, stock: 100 },
    'ps5-pro':    { name: 'PS5 Pro',       price: 4999, stock: 50  },
    'nvidia-5090':{ name: 'RTX 5090',      price: 16999,stock: 30  },
  }
};

// 预热库存（防止多次初始化）
let stock = {};
function initStock() {
  for (const [id, p] of Object.entries(INVENTORY.PRODUCTS)) {
    stock[id] = p.stock;
  }
}
initStock();

// ===== 订单记录 =====
const orders = [];
const userOrders = {}; // userId -> [orderIds]

// ===== 互斥锁（内存版 Redis 原子操作模拟）=====
const locks = {};
function acquireLock(key, maxWait = 100) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    if (!locks[key]) {
      locks[key] = true;
      return true;
    }
    // busy-wait （生产环境用 Redis WATCH + MULTI）
  }
  return false;
}
function releaseLock(key) {
  delete locks[key];
}

// ===== 重复下单防护 =====
const boughtFlags = new Set();

// ===== API: 获取商品列表 =====
app.get('/api/products', (req, res) => {
  const result = {};
  for (const [id, p] of Object.entries(INVENTORY.PRODUCTS)) {
    result[id] = { ...p, remaining: stock[id] || 0 };
  }
  res.json({ code: 0, data: result });
});

// ===== API: 秒杀接口（高并发核心）=====
app.post('/api/flash-buy', (req, res) => {
  const { userId, productId, quantity = 1 } = req.body;

  // 参数校验
  if (!userId || !productId) {
    return res.json({ code: 400, msg: '参数不完整' });
  }
  if (!INVENTORY.PRODUCTS[productId]) {
    return res.json({ code: 404, msg: '商品不存在' });
  }
  if (quantity < 1 || quantity > 2) {
    return res.json({ code: 400, msg: '单次限购1-2件' });
  }

  // 重复下单检测（同一个用户同一商品只能买一次）
  const buyKey = `${userId}:${productId}`;
  if (boughtFlags.has(buyKey)) {
    return res.json({ code: 429, msg: '您已抢购过该商品，请勿重复下单' });
  }

  // 加锁扣库存（原子操作）
  const lockKey = `stock:${productId}`;
  if (!acquireLock(lockKey)) {
    return res.json({ code: 503, msg: '系统繁忙，请重试' });
  }

  try {
    if (stock[productId] < quantity) {
      return res.json({ code: 20001, msg: '库存不足，手慢啦！' });
    }

    // 扣减库存
    stock[productId] -= quantity;
    boughtFlags.add(buyKey);

    // 生成订单
    const order = {
      orderId: uuidv4().slice(0, 8).toUpperCase(),
      userId,
      productId,
      productName: INVENTORY.PRODUCTS[productId].name,
      price: INVENTORY.PRODUCTS[productId].price,
      quantity,
      total: INVENTORY.PRODUCTS[productId].price * quantity,
      time: Date.now(),
      status: 'success',
    };
    orders.push(order);

    if (!userOrders[userId]) userOrders[userId] = [];
    userOrders[userId].push(order.orderId);

    return res.json({
      code: 0,
      msg: '🎉 抢购成功！',
      data: order,
    });
  } finally {
    releaseLock(lockKey);
  }
});

// ===== API: 查询订单 =====
app.get('/api/orders/:userId', (req, res) => {
  const uid = req.params.userId;
  const userOrderIds = userOrders[uid] || [];
  const result = orders.filter(o => userOrderIds.includes(o.orderId));
  res.json({ code: 0, data: result });
});

// ===== API: 重置秒杀 =====
app.post('/api/reset', (req, res) => {
  initStock();
  orders.length = 0;
  boughtFlags.clear();
  for (const k of Object.keys(userOrders)) delete userOrders[k];
  res.json({ code: 0, msg: '已重置' });
});

// ===== 启动 =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 秒杀系统已启动: http://localhost:${PORT}`);
  console.log(`📦 商品列表:`);
  for (const [id, p] of Object.entries(INVENTORY.PRODUCTS)) {
    console.log(`   - ${p.name} ¥${p.price} x${p.stock}`);
  }
});
