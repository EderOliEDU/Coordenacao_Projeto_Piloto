#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/projeto_piloto_app/app"
cd "$APP_DIR"

echo "==> Parando DEV (sem derrubar redes compartilhadas)..."
sudo docker compose --profile dev stop || true

echo "==> Removendo containers DEV..."
sudo docker rm -f app-frontend-dev-1 app-backend-dev-1 app-db-dev-1 2>/dev/null || true

echo "==> Containers restantes:"
sudo docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
