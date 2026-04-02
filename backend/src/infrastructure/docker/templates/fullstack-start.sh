#!/bin/sh
export PORT=3001

echo "[CloudDabba] Starting backend on port $PORT"
npm start &
BACKEND_PID=$!

sleep 3

echo "[CloudDabba] Starting nginx on port 80"
nginx -g 'daemon off;' &
NGINX_PID=$!

cleanup() {
    kill $BACKEND_PID $NGINX_PID 2>/dev/null
    exit 0
}
trap cleanup SIGTERM SIGINT

while true; do
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "[CloudDabba] Backend crashed, restarting..."
        npm start &
        BACKEND_PID=$!
    fi
    if ! kill -0 $NGINX_PID 2>/dev/null; then
        echo "[CloudDabba] Nginx stopped, restarting..."
        nginx -g 'daemon off;' &
        NGINX_PID=$!
    fi
    sleep 5
done
