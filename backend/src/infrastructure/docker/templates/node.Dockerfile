FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Auto-detect TypeScript and build
RUN if [ -f tsconfig.json ]; then \
      echo "[CloudDabba] TypeScript detected, building..." && \
      if grep -q '"build"' package.json 2>/dev/null; then \
        npm run build; \
      else \
        npx tsc; \
      fi && \
      echo "[CloudDabba] TypeScript build complete"; \
    fi

# Remove devDependencies for smaller image
RUN npm prune --production --legacy-peer-deps 2>/dev/null; true

CMD ["npm", "start"]
