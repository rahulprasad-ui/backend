# Production Dockerfile for Rivava Backend (Powered by Turso Cloud SQLite & Node.js)
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Production Runner
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root system user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/sh nodejs

COPY --from=builder --chown=nodejs:nodejs /app ./

USER nodejs

EXPOSE 3000

CMD ["node", "server.js"]
