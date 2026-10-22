# ==========================================
# STAGE 1: Build the React/Vite SPA bundle
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Cache package manifests first
COPY package.json package-lock.json ./

# Clean production-grade dependency installation
RUN npm ci

# Copy application source code
COPY . .

# Build production bundle with minification and tree-shaking
RUN npm run build

# ==========================================
# STAGE 2: Lightweight Production Web Server
# ==========================================
FROM nginx:1.25-alpine AS runner

# Remove default nginx boilerplate
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled SPA bundle and public assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration with reverse proxy and caching
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=3s --retries=3 \
    CMD wget -q -O /dev/null http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
