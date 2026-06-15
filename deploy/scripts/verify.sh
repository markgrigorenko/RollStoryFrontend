#!/usr/bin/env bash
# Health check loop. Дёргает URL пока не получит 200 или не истечёт timeout.
# Используется в CI (post-deploy verify) и для smoke-тестов руками.
#
# Использование:
#   ./deploy/scripts/verify.sh https://rollstory.org/healthz
#   ./deploy/scripts/verify.sh https://rollstory.org/healthz 60
set -euo pipefail

URL="${1:?Usage: $0 <url> [timeout_seconds]}"
TIMEOUT="${2:-120}"
INTERVAL=5
attempts=$((TIMEOUT / INTERVAL))

for i in $(seq 1 "$attempts"); do
  if curl -fsS "$URL" -o /dev/null; then
    echo "✅ $URL → 200 (attempt $i/$attempts)"
    exit 0
  fi
  echo "⏳ $URL not ready (attempt $i/$attempts), retry in ${INTERVAL}s..."
  sleep "$INTERVAL"
done

echo "❌ $URL не отвечает 200 за ${TIMEOUT}s"
exit 1
