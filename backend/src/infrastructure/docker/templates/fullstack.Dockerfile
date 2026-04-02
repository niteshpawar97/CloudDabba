# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/ ./frontend/
WORKDIR /app/frontend
RUN npm install --legacy-peer-deps && npm run build
# Normalize output directory
RUN mkdir -p /frontend-out && \
    if [ -d dist ]; then cp -r dist/. /frontend-out/; \
    elif [ -d build ]; then cp -r build/. /frontend-out/; \
    elif [ -d out ]; then cp -r out/. /frontend-out/; \
    elif [ -d .next ]; then cp -r .next /frontend-out/.next && cp -r public /frontend-out/public 2>/dev/null; true; \
    fi

# Stage 2: Backend + nginx to serve frontend
FROM node:22-alpine
RUN apk add --no-cache nginx

# Install backend
WORKDIR /app
COPY backend/ ./
RUN npm install --legacy-peer-deps --only=production

# Copy frontend build to nginx
COPY --from=frontend-build /frontend-out /usr/share/nginx/html
RUN rm -rf /usr/share/nginx/html/50x.html 2>/dev/null; true
RUN chmod -R 755 /usr/share/nginx/html

# Nginx: serve frontend + proxy /api to backend
RUN mkdir -p /etc/nginx/http.d && cat > /etc/nginx/http.d/default.conf << 'NGINXEOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location /health {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINXEOF

# Entrypoint: start node backend + nginx
RUN cat > /app/_start.sh << 'STARTSH'
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
STARTSH
RUN chmod +x /app/_start.sh

EXPOSE 80
ENTRYPOINT []
CMD ["/bin/sh", "/app/_start.sh"]
