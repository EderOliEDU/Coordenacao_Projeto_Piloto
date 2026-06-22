#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/projeto_piloto_app/app"
PROD_IP="192.168.0.122"
FRONT_PORT="5173"

cd "$APP_DIR"

HOST_IP="$(hostname -I | awk '{print $1}')"
if [[ "$HOST_IP" != "$PROD_IP" ]]; then
  echo "ERRO: este script é para PROD. IP esperado: $PROD_IP | IP atual: $HOST_IP"
  exit 1
fi

echo "==> Build + Start PROD em $HOST_IP"
./stop-prod.sh

echo "==> Subindo PROD (build + remove-orphans)..."
sudo docker compose --profile prod up -d --build --remove-orphans

echo "==> Status:"
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "==> Smoke test (esperado 200 / e 401 em /api/turmas sem token):"
curl -sSI "http://127.0.0.1:${FRONT_PORT}/" | head -n 5 || true
curl -sSI "http://127.0.0.1:${FRONT_PORT}/api/turmas" | head -n 12 || true

echo "==> Nginx proxy_pass:"
sudo docker exec -i app-frontend-prod-1 sh -lc "grep -n 'proxy_pass' /etc/nginx/conf.d/default.conf || true"