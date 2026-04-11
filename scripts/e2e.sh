#!/usr/bin/env bash
set -euo pipefail

echo "=== E2E TEST START ==="

###############################################
# 1. CLEAN ENVIRONMENT
###############################################
echo "[1/10] Cleaning environment..."
docker compose down -v --remove-orphans || true

echo "[2/10] Building fresh images..."
docker compose build --no-cache

echo "[3/10] Starting stack..."
docker compose up -d

###############################################
# 2. WAIT FOR SERVICES
###############################################
wait_for() {
  local name=$1
  local url=$2
  local max=60
  local count=0

  echo "Waiting for $name at $url ..."
  until curl -s "$url" >/dev/null 2>&1; do
    sleep 2
    count=$((count+1))
    if [ $count -ge $max ]; then
      echo "❌ $name did not become ready in time"
      exit 1
    fi
  done
  echo "✔ $name is ready"
}

wait_for "API" "http://localhost:3001/api/health"
wait_for "AI"  "http://localhost:8000/health"
wait_for "WEB" "http://localhost:3000"

###############################################
# 3. VALIDATE HEALTH ENDPOINTS
###############################################
echo "[4/10] Checking API health..."
curl -s http://localhost:3001/api/health | jq .

echo "[5/10] Checking AI health..."
curl -s http://localhost:8000/health | jq .

###############################################
# 4. VALIDATE DB MIGRATIONS
###############################################
echo "[6/10] Checking DB tables..."
docker exec aianalytics-postgres-1 psql -U postgres -c "\dt"

###############################################
# 5. TEST AI ROUTES DIRECTLY
###############################################
echo "[7/10] Testing AI student risk prediction..."
curl -s -X POST http://localhost:8000/predict/student_risk \
  -H "Content-Type: application/json" \
  -d '{"student_id":"123"}' | jq .

echo "[8/10] Testing AI summary route..."
curl -s -X POST http://localhost:8000/generate/teacher_dashboard_summary \
  -H "Content-Type: application/json" \
  -d '{"teacher_id":"T001"}' | jq .

###############################################
# 6. TEST API ROUTES (API → AI)
###############################################
echo "[9/10] Testing API dashboard summary..."
curl -s "http://localhost:3001/api/dashboards/teacher/summary?teacherId=T001" | jq .

echo "[10/10] Testing API risk prediction..."
curl -s "http://localhost:3001/api/students/123/risk" | jq .

###############################################
# 7. VALIDATE PRISMA ENGINE
###############################################
echo "Checking Prisma engine inside API container..."
docker exec aianalytics-api-1 ls /app/apps/api/node_modules/.prisma/client

###############################################
# 8. CHECK LOGS FOR ERRORS
###############################################
echo "Checking API logs..."
docker logs aianalytics-api-1 --tail=200

echo "Checking AI logs..."
docker logs aianalytics-ai-1 --tail=200

###############################################
# 9. FINAL RESULT
###############################################
echo "=== E2E TEST COMPLETE ==="
echo "If no errors were printed, the system is healthy."
