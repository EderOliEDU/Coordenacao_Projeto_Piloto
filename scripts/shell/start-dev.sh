#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/projeto_piloto_app/app"
DEV_IP="172.17.2.42"
FRONT_PORT="5173"
BACK_PORT="3001"

cd "$APP_DIR"

HOST_IP="$(hostname -I | awk '{print $1}')"
if [[ "$HOST_IP" != "$DEV_IP" ]]; then
  echo "ERRO: este script é para DEV. IP esperado: $DEV_IP | IP atual: $HOST_IP"
  exit 1
fi

echo "==> Subindo DEV em $HOST_IP (frontend :$FRONT_PORT, backend :$BACK_PORT)"

# Derruba containers do profile oposto, sem tentar remover rede (evita erro de network in use)
echo "==> Limpando containers PROD (se existirem)..."
sudo docker rm -f app-frontend-prod-1 app-backend-prod-1 2>/dev/null || true

echo "==> Subindo stack DEV (build + remove-orphans)..."
sudo docker compose --profile dev up -d --build --remove-orphans

echo "==> Containers:"
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "==> Testes rápidos:"
echo "- Frontend:"
curl -sSI "http://127.0.0.1:${FRONT_PORT}/" | head -n 5 || true
echo "- API via nginx (esperado 401 sem token):"
curl -sSI "http://127.0.0.1:${FRONT_PORT}/api/turmas" | head -n 12 || true

echo "==> Conf nginx (linha do proxy_pass):"
sudo docker exec -i app-frontend-dev-1 sh -lc "grep -n 'proxy_pass' /etc/nginx/conf.d/default.conf || true"
