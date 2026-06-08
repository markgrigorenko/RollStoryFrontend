#!/usr/bin/env bash
# Откат frontend-а на указанный SHA. У фронта нет ни БД, ни миграций — откат
# полностью безопасен (надо только убедиться, что старый фронт совместим с
# текущей API-схемой бэка).
#
# Запускается НА VPS (через ssh из rollback workflow или руками).
#
# Использование:
#   ./deploy/scripts/rollback.sh <target-sha>
set -euo pipefail

SHA="${1:?Usage: $0 <target-sha>}"

cd "$(dirname "$0")/../.."  # → /opt/rollstory/frontend
export IMAGE_TAG="$SHA"

docker compose pull frontend
docker compose up -d --no-deps frontend
