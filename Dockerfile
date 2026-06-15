# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# По умолчанию для prod-сборки оставляем same-origin /v1 — внутренний nginx
# контейнера проксирует на rollstory-server в той же docker-сети (rollstory-net).
# Можно переопределить build-arg, если нужен cross-origin (например, для предпрод-стенда).
ARG VITE_API_BASE_URL=/v1
RUN echo "VITE_API_BASE_URL=$VITE_API_BASE_URL" > .env.production && \
    npm run build

# Runtime stage
FROM nginx:1.27-alpine

# GIT_SHA → OCI label на финальном образе. Используется deploy/scripts/dc.sh
# для autodetect IMAGE_TAG из running контейнера (source of truth).
ARG GIT_SHA
LABEL org.opencontainers.image.revision=$GIT_SHA

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
