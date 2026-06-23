#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/projeto_piloto_app/app"
PROD_IP="192.168.0.122"
FRONT_PORT="5173"
BACK_PORT="3001"

cd "$APP_DIR"

HOST_IP="$(hostname -I | awk '{print $1}')"
if [[ "$HOST_IP" != "$PROD_IP" ]]; then
  echo "ERRO: este script é para PROD. IP esperado: $PROD_IP | IP atual: $HOST_IP"
  exit 1
fi

echo "==> Subindo PROD em $HOST_IP (frontend :$FRONT_PORT, backend :$BACK_PORT)"

echo "==> Limpando containers DEV (se existirem)..."
sudo docker rm -f app-frontend-dev-1 app-backend-dev-1 app-db-dev-1 2>/dev/null || true

echo "==> Subindo stack PROD (build)..."
sudo docker compose --profile prod up -d --build

echo "==> Containers:"
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "==> Testes rápidos:"
echo "- Frontend:"
curl -sSI "http://127.0.0.1:${FRONT_PORT}/" | head -n 5 || true
echo "- API via nginx (esperado 401 sem token):"
curl -sSI "http://127.0.0.1:${FRONT_PORT}/api/turmas" | head -n 12 || true

echo "==> Conf nginx (linha do proxy_pass):"
sudo docker exec -i app-frontend-prod-1 sh -lc "grep -n 'proxy_pass' /etc/nginx/conf.d/default.conf || true"

