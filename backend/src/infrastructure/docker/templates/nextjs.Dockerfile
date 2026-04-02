FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .

# Add standalone output config if not present
RUN if ! grep -q "standalone" next.config.* 2>/dev/null; then \
      echo "module.exports = { output: 'standalone' }" > next.config.js 2>/dev/null || true; \
    fi

RUN npm run build

# Production
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy standalone build
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

CMD ["node", "server.js"]
