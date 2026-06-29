#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/projeto_piloto_app/app}"
DEV_IP="${DEV_IP:-172.17.2.42}"
FRONT_PORT="${FRONT_PORT:-5173}"
SMB_SHARE="${SMB_SHARE:-//172.17.2.35/app}"
SMB_MOUNT_POINT="${SMB_MOUNT_POINT:-/mnt/projeto_piloto_app_local}"
SMB_USER="${SMB_USER:-eder.oliveira}"
SMB_DOMAIN="${SMB_DOMAIN:-RONDONOPOLIS}"
SMB_UID="${SMB_UID:-coordenacao}"
SMB_GID="${SMB_GID:-coordenacao}"
REMOUNT_SHARE="${REMOUNT_SHARE:-1}"
SOURCE_DIR="${1:-${SOURCE_DIR:-$SMB_MOUNT_POINT}}"

HOST_IP="$(hostname -I | awk '{print $1}')"
if [[ "$HOST_IP" != "$DEV_IP" ]]; then
  echo "ERRO: este script e para DEV. IP esperado: $DEV_IP | IP atual: $HOST_IP"
  exit 1
fi

command -v rsync >/dev/null 2>&1 || {
  echo "ERRO: rsync nao encontrado. Instale com: sudo apt update && sudo apt install -y rsync"
  exit 1
}

command -v mountpoint >/dev/null 2>&1 || {
  echo "ERRO: mountpoint nao encontrado."
  exit 1
}

run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

mount_share() {
  mkdir -p "$SMB_MOUNT_POINT"

  if mountpoint -q "$SMB_MOUNT_POINT"; then
    if [[ "$REMOUNT_SHARE" == "1" ]]; then
      echo "==> Desmontando compartilhamento anterior: $SMB_MOUNT_POINT"
      run_as_root umount "$SMB_MOUNT_POINT"
    else
      echo "==> Compartilhamento ja montado: $SMB_MOUNT_POINT"
      return
    fi
  fi

  echo "==> Montando compartilhamento: $SMB_SHARE -> $SMB_MOUNT_POINT"
  echo "==> Usuario: ${SMB_DOMAIN}\\${SMB_USER}"
  echo "==> Digite a senha do AD quando solicitado."

  if run_as_root mount -t cifs "$SMB_SHARE" "$SMB_MOUNT_POINT" \
    -o "username=${SMB_USER},domain=${SMB_DOMAIN},vers=3.0,sec=ntlmssp,iocharset=utf8,uid=${SMB_UID},gid=${SMB_GID},file_mode=0644,dir_mode=0755,noperm"; then
    return
  fi

  echo "==> Primeira tentativa falhou. Tentando usuario no formato dominio\\usuario..."
  run_as_root umount "$SMB_MOUNT_POINT" 2>/dev/null || true

  if run_as_root mount -t cifs "$SMB_SHARE" "$SMB_MOUNT_POINT" \
    -o "username=${SMB_DOMAIN}\\${SMB_USER},vers=3.0,sec=ntlmssp,iocharset=utf8,uid=${SMB_UID},gid=${SMB_GID},file_mode=0644,dir_mode=0755,noperm"; then
    return
  fi

  echo "ERRO: nao foi possivel montar o compartilhamento."
  echo "Ultimas mensagens do kernel:"
  dmesg | tail -n 40 || true
  exit 1
}

if [[ "$SOURCE_DIR" == "$SMB_MOUNT_POINT" ]]; then
  mount_share
fi

SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"

if [[ ! -f "$SOURCE_DIR/compose.yml" || ! -d "$SOURCE_DIR/backend" || ! -d "$SOURCE_DIR/frontend" ]]; then
  echo "ERRO: origem invalida: $SOURCE_DIR"
  echo "Esperado encontrar compose.yml, backend/ e frontend/."
  echo
  echo "Conteudo encontrado na origem:"
  find "$SOURCE_DIR" -maxdepth 2 -mindepth 1 -printf "  %p\n" | head -n 40
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
