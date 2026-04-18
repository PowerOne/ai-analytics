#!/bin/sh
set -e
cd /app/apps/api
exec node dist/main.js
