#!/bin/bash
# /root/.openclaw/workspace/flash-sale-demo/keepalive.sh
# 秒杀服务保活脚本 — 每分钟检查一次

FLASH_DIR="/root/.openclaw/workspace/flash-sale-demo"
LOG="/var/log/flash-sale-keepalive.log"

# 检查秒杀服务
if ! pgrep -x "node server.js" > /dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ 秒杀服务挂了，重启中..." >> $LOG
  cd "$FLASH_DIR" && node server.js > /tmp/flash-sale.log 2>&1 &
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 已重启 (PID: $!)" >> $LOG
fi
