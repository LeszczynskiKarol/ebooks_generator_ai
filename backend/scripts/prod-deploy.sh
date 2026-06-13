#!/usr/bin/env bash
# Build + restart the InkMagnet backend on the production host (matury).
# Invoked over SSH by .github/workflows/deploy.yml after sources are rsynced.
# Env in: DEPS (true|false), PM2_APP, HEALTH_URL.
set -u

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use --lts >/dev/null 2>&1 || true

cd "$(dirname "$0")/.." || exit 1   # → backend/

if [ "${DEPS:-false}" = "true" ] || [ ! -d node_modules ]; then
  echo "== npm ci =="
  npm install --no-audit --no-fund || exit 1
else
  echo "== deps unchanged — skip npm ci =="
fi

npx prisma generate || exit 1
npm run build || exit 1

pm2 restart "${PM2_APP:-inkmagnet-api}" --update-env || exit 1
pm2 save || true

ok=0
for i in $(seq 1 15); do
  if curl -fsS --max-time 3 "${HEALTH_URL:-http://localhost:3015/api/health}" >/dev/null 2>&1; then
    echo "health OK (attempt $i)"; ok=1; break
  fi
  sleep 2
done
[ "$ok" = "1" ] || { echo "::error::backend health check failed"; exit 1; }
echo "== backend deploy done =="
