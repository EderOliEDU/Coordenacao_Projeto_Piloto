#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/projeto_piloto_app/app"
DEV_IP="172.17.2.42"
FRONT_PORT="5173"

cd "$APP_DIR"

HOST_IP="$(hostname -I | awk '{print $1}')"
if [[ "$HOST_IP" != "$DEV_IP" ]]; then
  echo "ERRO: este script é para DEV. IP esperado: $DEV_IP | IP atual: $HOST_IP"
  exit 1
fi

echo "==> Build + Start DEV em $HOST_IP"
./stop-dev.sh

echo "==> Subindo DEV (build + remove-orphans)..."
sudo docker compose --profile dev up -d --build --remove-orphans

echo "==> Status:"
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "==> Aguardando backend iniciar..."`nsleep 10`n`necho "==> Smoke test (esperado 200 / e 401 em /api/turmas sem token):"
curl -sSI "http://127.0.0.1:${FRONT_PORT}/" | head -n 5 || true
curl -sSI "http://127.0.0.1:${FRONT_PORT}/api/turmas" | head -n 12 || true

echo "==> Nginx proxy_pass:"
sudo docker exec -i app-frontend-dev-1 sh -lc "grep -n 'proxy_pass' /etc/nginx/conf.d/default.conf || true"

