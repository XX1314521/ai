FROM node:20-bookworm-slim AS builder

WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmmirror.com

ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
    npm_config_registry=${NPM_REGISTRY} \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_maxsockets=5

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund

COPY . .

ARG VITE_BASE=/
ENV VITE_BASE=${VITE_BASE}

RUN npm run build

FROM nginx:1.27-alpine AS runner

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
