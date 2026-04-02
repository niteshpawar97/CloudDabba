FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# Normalize build output to /app/_static
RUN mkdir -p /app/_static && \
    if [ -d /app/.next/standalone ]; then \
      cp -r /app/.next/standalone/. /app/_static/ && \
      mkdir -p /app/_static/.next/static && \
      cp -r /app/.next/static/. /app/_static/.next/static/ && \
      cp -r /app/public/. /app/_static/public/ 2>/dev/null; \
    elif [ -d /app/out ]; then cp -r /app/out/. /app/_static/; \
    elif [ -d /app/dist ]; then cp -r /app/dist/. /app/_static/; \
    elif [ -d /app/build ]; then cp -r /app/build/. /app/_static/; \
    elif [ -d /app/.next ]; then cp -r /app/.next/static/. /app/_static/ 2>/dev/null; \
    fi && \
    if [ ! "$(ls -A /app/_static 2>/dev/null)" ]; then \
      echo "No build output found, copying source" && \
      cp -r /app/. /app/_static/; \
    fi

FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/_static /usr/share/nginx/html
RUN chmod -R 755 /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
