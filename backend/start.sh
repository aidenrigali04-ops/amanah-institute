#!/bin/sh
set -e
echo "[Amanah] Running prisma migrate deploy..."
npx prisma migrate deploy
echo "[Amanah] Starting Node server (node dist/index.js)..."
exec node dist/index.js
