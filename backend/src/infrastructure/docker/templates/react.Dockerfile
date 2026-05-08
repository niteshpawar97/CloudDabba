# CloudDabba: Frontend SPA template
# Handles: React, Vue, Angular, Svelte, Astro, Gatsby, Solid.js
# Builds with npm, normalizes output to _static/, serves with nginx
# Includes SPA fallback so client-side routes (/about, /blog, etc) work on direct hit.

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
    elif ls -d /app/dist/*/browser 2>/dev/null | head -1 | grep -q .; then \
      cp -r $(ls -d /app/dist/*/browser | head -1)/. /app/_static/; \
    elif [ -d /app/dist ]; then cp -r /app/dist/. /app/_static/; \
    elif [ -d /app/build ]; then cp -r /app/build/. /app/_static/; \
    elif [ -d /app/public ] && [ -f /app/public/index.html ]; then \
      cp -r /app/public/. /app/_static/; \
    elif [ -d /app/.next ]; then cp -r /app/.next/static/. /app/_static/ 2>/dev/null; \
    fi && \
    if [ ! "$(ls -A /app/_static 2>/dev/null)" ]; then \
      echo "No build output found, copying source" && \
      cp -r /app/. /app/_static/; \
    fi

FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf
COPY --from=build /app/_static /usr/share/nginx/html
COPY spa.conf /etc/nginx/conf.d/default.conf
RUN chmod -R 755 /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
