FROM node:22-alpine AS frontend-build
WORKDIR /frontend
ARG FRONTEND_PATH=frontend
COPY . /repo
WORKDIR /repo/${FRONTEND_PATH}
RUN npm ci && npm run build
# Normalize output
RUN mkdir -p /frontend-out && \
    if [ -d dist ]; then cp -r dist/. /frontend-out/; \
    elif [ -d build ]; then cp -r build/. /frontend-out/; \
    elif [ -d out ]; then cp -r out/. /frontend-out/; \
    elif [ -d .next ]; then cp -r .next /frontend-out/.next && cp -r public /frontend-out/public 2>/dev/null; true; \
    fi

FROM node:22-alpine
WORKDIR /app
ARG BACKEND_PATH=backend
COPY . /repo
WORKDIR /app
RUN cp -r /repo/${BACKEND_PATH}/. /app/ && \
    rm -rf /repo
RUN npm ci --only=production
# Copy frontend build to public folder
COPY --from=frontend-build /frontend-out ./public
RUN chmod -R 755 ./public 2>/dev/null; true
EXPOSE 3000
CMD ["npm", "start"]
