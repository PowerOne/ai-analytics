#!/bin/sh
set -e
cd /app/apps/api
npx prisma migrate deploy
exec node /app/apps/api/dist/main.js