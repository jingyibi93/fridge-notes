#!/bin/zsh

cd "$(dirname "$0")"

PORT=4173
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
PID=$(lsof -ti tcp:$PORT 2>/dev/null)

if [ -n "$PID" ]; then
  echo "正在关闭旧的冰箱便签预览服务..."
  kill $PID 2>/dev/null
  sleep 1
fi

echo ""
echo "冰箱便签预览已启动"
echo "电脑打开：http://127.0.0.1:$PORT"
if [ -n "$IP" ]; then
  echo "手机打开：http://$IP:$PORT"
else
  echo "没有读到 Wi-Fi 地址，请确认电脑已连接 Wi-Fi。"
fi
echo ""
echo "这个窗口不要关闭。要停止预览时，按 Control + C。"
echo ""

python3 -m http.server $PORT
