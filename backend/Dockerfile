# Backend Dockerfile - NestJS API
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install once, with bounded retries for temporary registry connection failures.
RUN npm install --include=dev --no-audit --no-fund \
    --fetch-retries=5 --fetch-retry-factor=2 \
    --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=60000 \
    --fetch-timeout=180000

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Reuse the packages already downloaded and built on the same Alpine image.
# Pruning is offline and does not rerun native dependency install scripts.
FROM builder AS production-deps
RUN npm prune --omit=dev --offline --ignore-scripts --no-audit --no-fund

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install PostgreSQL client for health check in entrypoint
RUN apk add --no-cache postgresql-client

# Copy package files
COPY package.json ./

# Copy production dependencies without downloading them a second time.
COPY --from=production-deps /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy database files for migrations/seeds
COPY --from=builder /app/database ./database

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create certs directory
RUN mkdir -p certs

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
