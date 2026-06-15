#!/usr/bin/env bash
# Обёртка над docker compose: автодетектит IMAGE_TAG из лейбла running контейнера.
# Без неё каждая команда требовала бы `IMAGE_TAG=... docker compose ...`,
# потому что compose-файл использует `${IMAGE_TAG:?}`.
#
# Использование:
#   ./dc.sh logs frontend   # auto IMAGE_TAG, не надо помнить SHA
#   ./dc.sh ps
#   ./dc.sh down
#
# Для первого deploy / явного указания SHA:
#   IMAGE_TAG=<sha> ./dc.sh up -d
#
set -euo pipefail
cd "$(dirname "$0")/../.."  # repo root (где лежит docker-compose.yaml)

if [ -z "${IMAGE_TAG:-}" ]; then
    IMAGE_TAG=$(docker inspect rollstory-frontend-prod \
        --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' \
        2>/dev/null || true)

    if [ -z "$IMAGE_TAG" ]; then
        echo "❌ IMAGE_TAG не задан и не получается достать из running container."
        echo "   Запусти первый deploy явно:  IMAGE_TAG=<sha> ./dc.sh up -d"
        echo "   Список доступных SHA:         docker images \$REGISTRY_URL/rollstory-frontend"
        exit 1
    fi
fi

export IMAGE_TAG
exec docker compose "$@"
