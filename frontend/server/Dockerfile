FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

COPY server ./server

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "server/index.js"]
