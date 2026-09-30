# Multi-stage production Dockerfile for Rivava Backend
FROM node:20-alpine AS builder

WORKDIR /app

# Install native compilation dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ gcc

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root system user and persistent SQLite data directory
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    mkdir -p /app/data && \
    chown -R nodejs:nodejs /app

COPY --from=builder --chown=nodejs:nodejs /app ./

USER nodejs

EXPOSE 3000

CMD ["node", "server.js"]
