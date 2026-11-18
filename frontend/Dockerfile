# Frontend Dockerfile - React + Vite + Nginx
# Debian/glibc avoids the native Rollup parser failure seen on Alpine/musl.
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install the locked build toolchain, including platform-specific native packages.
RUN npm ci --include=dev --include=optional --no-audit --no-fund \
    --fetch-retries=5 --fetch-retry-factor=2 \
    --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=60000 \
    --fetch-timeout=180000

# Copy source code
COPY . .

# Build argument for API URL (used at build time)
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

# Build argument para a site key publica do Cloudflare Turnstile (captcha do login).
# Sem isso configurado no build, o captcha fica desligado (ver Turnstile.tsx).
ARG VITE_TURNSTILE_SITE_KEY=
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY

# Validate TypeScript and build using the locally installed Vite.
RUN npm run build

# Production stage - Nginx
FROM nginx:alpine AS production

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx template
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Default backend URL - override with environment variable in EasyPanel
ENV BACKEND_URL=http://backend:5000

EXPOSE 80

# Install curl for healthcheck
RUN apk add --no-cache curl

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
