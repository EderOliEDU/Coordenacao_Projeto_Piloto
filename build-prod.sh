#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/projeto_piloto_app/app"
PROD_IP="192.168.0.122"
FRONT_PORT="5173"
BACK_PORT="3001"
PUBLIC_URL="https://fonica.rondonopolis.mt.gov.br/"

cd "$APP_DIR"

HOST_IP="$(hostname -I | awk '{print $1}')"
if [[ "$HOST_IP" != "$PROD_IP" ]]; then
  echo "ERRO: este script é para PROD. IP esperado: $PROD_IP | IP atual: $HOST_IP"
  exit 1
fi

echo "==> Build + Start PROD em $HOST_IP"
./stop-prod.sh

echo "==> Subindo PROD (build)..."
sudo docker compose --profile prod up -d --build

echo "==> Aguardando backend/frontend/caddy iniciar..."
sleep 10

echo "==> Status:"
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "==> Smoke test local backend direto (esperado 401 sem token):"
curl -sSI "http://127.0.0.1:${BACK_PORT}/api/turmas" | head -n 12 || true

echo "==> Smoke test local frontend (esperado 200 / e 401 em /api/turmas sem token):"
curl -sSI "http://127.0.0.1:${FRONT_PORT}/" | head -n 5 || true
curl -sSI "http://127.0.0.1:${FRONT_PORT}/api/turmas" | head -n 12 || true

echo "==> Smoke test Docker interno frontend -> backend (esperado 401):"
sudo docker exec -i app-frontend-prod-1 sh -lc "wget -S -O- http://backend-prod:3001/api/turmas 2>&1 | head -n 20" || true

echo "==> Smoke test Caddy local/publico:"
curl -sSI "http://127.0.0.1/" | head -n 12 || true
curl -sSI "$PUBLIC_URL" | head -n 12 || true

echo "==> Nginx proxy_pass:"
sudo docker exec -i app-frontend-prod-1 sh -lc "grep -n 'proxy_pass' /etc/nginx/conf.d/default.conf || true"

echo "==> Caddy config:"
sudo docker exec -i app-caddy-1 caddy validate --config /etc/caddy/Caddyfile || true
