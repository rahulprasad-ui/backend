# Production Dockerfile for Rivava Backend (Debian-slim for 100% stable SQLite native C++ binaries)
FROM node:20-slim AS builder

WORKDIR /app

# Install build tools for native addons
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Production Runner
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create persistent data directory and non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/sh nodejs && \
    mkdir -p /app/data && \
    chown -R nodejs:nodejs /app

COPY --from=builder --chown=nodejs:nodejs /app ./

USER nodejs

EXPOSE 3000

CMD ["node", "server.js"]
