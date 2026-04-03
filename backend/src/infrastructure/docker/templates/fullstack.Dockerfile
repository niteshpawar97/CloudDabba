# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/ ./frontend/
WORKDIR /app/frontend
RUN npm install --legacy-peer-deps && npm run build
RUN mkdir -p /frontend-out && \
    if ls -d dist/*/browser 2>/dev/null | head -1 | grep -q .; then \
      cp -r $(ls -d dist/*/browser | head -1)/. /frontend-out/; \
    elif [ -d dist ]; then cp -r dist/. /frontend-out/; \
    elif [ -d build ]; then cp -r build/. /frontend-out/; \
    elif [ -d out ]; then cp -r out/. /frontend-out/; \
    elif [ -d public ] && [ -f public/index.html ]; then cp -r public/. /frontend-out/; \
    elif [ -d .next ]; then cp -r .next /frontend-out/.next && cp -r public /frontend-out/public 2>/dev/null; true; \
    fi

# Stage 2: Backend + nginx
FROM node:22-alpine
RUN apk add --no-cache nginx

WORKDIR /app
COPY backend/ ./
RUN npm install --legacy-peer-deps

# Auto-detect TypeScript and build backend
RUN if [ -f tsconfig.json ]; then \
      echo "[CloudDabba] TypeScript backend detected, building..." && \
      if grep -q '"build"' package.json 2>/dev/null; then \
        npm run build; \
      else \
        npx tsc; \
      fi && \
      echo "[CloudDabba] TypeScript build complete"; \
    fi

# Remove devDependencies for smaller image
RUN npm prune --production --legacy-peer-deps 2>/dev/null; true

# Frontend → nginx
COPY --from=frontend-build /frontend-out /usr/share/nginx/html
RUN rm -rf /usr/share/nginx/html/50x.html 2>/dev/null; true
RUN chmod -R 755 /usr/share/nginx/html

# Nginx config + start script
COPY fullstack-nginx.conf /etc/nginx/http.d/default.conf
COPY fullstack-start.sh /app/_start.sh
RUN chmod +x /app/_start.sh

EXPOSE 80
ENTRYPOINT []
CMD ["/bin/sh", "/app/_start.sh"]
