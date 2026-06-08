#!/usr/bin/env bash
# Запускается НА VPS (через ssh из CI или руками).
# Тянет образ под IMAGE_TAG и перезапускает контейнер фронта.
#
# Регистровые креды должны лежать в ~/.docker/config.json (один раз
# `docker login <registry>` руками на VPS). Скрипт сам в registry не логинится.
#
# Использование:
#   IMAGE_TAG=<sha> ./deploy/scripts/deploy.sh
set -euo pipefail

: "${IMAGE_TAG:?IMAGE_TAG must be set (git SHA образа для деплоя)}"

cd "$(dirname "$0")/../.."  # → /opt/rollstory/frontend
export IMAGE_TAG

docker compose pull frontend
docker compose up -d --remove-orphans
