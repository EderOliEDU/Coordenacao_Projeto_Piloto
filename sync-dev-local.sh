#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/projeto_piloto_app/app}"
DEV_IP="${DEV_IP:-172.17.2.42}"
FRONT_PORT="${FRONT_PORT:-5173}"
SOURCE_DIR="${1:-${SOURCE_DIR:-}}"

HOST_IP="$(hostname -I | awk '{print $1}')"
if [[ "$HOST_IP" != "$DEV_IP" ]]; then
  echo "ERRO: este script e para DEV. IP esperado: $DEV_IP | IP atual: $HOST_IP"
  exit 1
fi

command -v rsync >/dev/null 2>&1 || {
  echo "ERRO: rsync nao encontrado. Instale com: sudo apt update && sudo apt install -y rsync"
  exit 1
}

if [[ -z "$SOURCE_DIR" ]]; then
  cat <<'USAGE'
ERRO: informe a pasta de origem que contem a copia local do projeto.

Este script deve ser executado no servidor DEV Debian, mas a pasta do Windows
precisa estar montada/compartilhada no Linux antes.

Exemplo:
  ./sync-dev-local.sh /mnt/projeto_piloto_app_local

Ou:
  SOURCE_DIR=/mnt/projeto_piloto_app_local ./sync-dev-local.sh
USAGE
  exit 1
fi

SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"

if [[ ! -f "$SOURCE_DIR/compose.yml" || ! -d "$SOURCE_DIR/backend" || ! -d "$SOURCE_DIR/frontend" ]]; then
  echo "ERRO: origem invalida: $SOURCE_DIR"
  echo "Esperado encontrar compose.yml, backend/ e frontend/."
  exit 1
fi

if [[ ! -d "$APP_DIR" ]]; then
  echo "ERRO: destino DEV nao existe: $APP_DIR"
  exit 1
fi

echo "==> Servidor DEV:  $HOST_IP"
echo "==> Origem:        $SOURCE_DIR"
echo "==> Destino:       $APP_DIR"
echo
echo "Este processo copia a origem informada para o app DEV e rebuilda os containers."
echo "Arquivos .env, .git, node_modules e dist serao preservados/ignorados no destino."
echo
read -r -p "Continuar? [s/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
  echo "Cancelado."
  exit 0
fi

cd "$APP_DIR"

echo "==> Sincronizando arquivos..."
rsync -az --delete --info=progress2 --no-owner --no-group \
  --exclude='.git/' \
  --exclude='.agents/' \
  --exclude='.codex/' \
  --exclude='.codex-sync-github/' \
  --exclude='node_modules/' \
  --exclude='backend/node_modules/' \
  --exclude='frontend/node_modules/' \
  --exclude='backend/dist/' \
  --exclude='frontend/dist/' \
  --exclude='out/' \
  --exclude='patches/' \
  --exclude='.env' \
  --exclude='backend/.env_dev' \
  --exclude='backend/.env_prod' \
  "$SOURCE_DIR/" "$APP_DIR/"

echo "==> Rebuildando DEV sem git pull..."
chmod +x ./build-dev.sh ./stop-dev.sh
SKIP_GIT_PULL=1 ./build-dev.sh

echo
echo "==> Pronto. Acesse: http://$DEV_IP:$FRONT_PORT"
