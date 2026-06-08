#!/usr/bin/env bash
# Синкает compose-файл и deploy/ на VPS.
# Запускается из CI или руками с ноутбука для отладки деплоя.
#
# Использование:
#   ./deploy/scripts/sync-configs.sh user@vps              # default → /opt/rollstory/frontend
#   ./deploy/scripts/sync-configs.sh user@vps /custom/path
set -euo pipefail

VPS="${1:?Usage: $0 <user@host> [remote_path]}"
REMOTE="${2:-/opt/rollstory/frontend}"

cd "$(dirname "$0")/../.."  # repo root

# Compose-файл (одиночный файл — без --delete).
rsync -avz docker-compose.yaml "$VPS:$REMOTE/"

# deploy/ синкается с --delete: то, что удалено в репо, удалится и на VPS.
# Слеши на обоих концах = синк содержимого.
rsync -avz --delete deploy/ "$VPS:$REMOTE/deploy/"
