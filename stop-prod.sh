#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/projeto_piloto_app/app"
cd "$APP_DIR"

echo "==> Parando PROD (sem derrubar redes compartilhadas)..."
sudo docker compose --profile prod stop || true

echo "==> Removendo containers PROD..."
sudo docker rm -f app-frontend-prod-1 app-backend-prod-1 2>/dev/null || true

echo "==> Containers restantes:"
sudo docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"