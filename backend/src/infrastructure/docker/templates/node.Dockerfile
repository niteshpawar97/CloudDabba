FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps --only=production
COPY . .
CMD ["npm", "start"]
