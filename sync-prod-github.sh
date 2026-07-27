#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/projeto_piloto_app/app}"
PROD_IP="${PROD_IP:-192.168.0.122}"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
RELEASES_DIR="${RELEASES_DIR:-/opt/projeto_piloto_app/releases}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
ACTION="${1:-deploy}"
TARGET_RELEASE="${2:-latest}"

run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERRO: comando nao encontrado: $1"
    exit 1
  }
}

check_prod_host() {
  local host_ip
  host_ip="$(hostname -I | awk '{print $1}')"
  if [[ "$host_ip" != "$PROD_IP" ]]; then
    echo "ERRO: este script e para PROD. IP esperado: $PROD_IP | IP atual: $host_ip"
    exit 1
  fi
}

current_commit() {
  git -C "$APP_DIR" rev-parse HEAD
}

current_branch() {
  git -C "$APP_DIR" branch --show-current || true
}

backup_current_release() {
  local commit short_commit branch timestamp release_dir
  commit="$(current_commit)"
  short_commit="${commit:0:12}"
  branch="$(current_branch)"
  timestamp="$(date +%Y%m%d-%H%M%S)"
  release_dir="$RELEASES_DIR/$timestamp-$short_commit"

  echo "==> Criando copia do release atual: $release_dir" >&2
  run_as_root mkdir -p "$release_dir"
  run_as_root rsync -a --delete --no-owner --no-group \
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
    "$APP_DIR/" "$release_dir/app/"

  {
    echo "commit=$commit"
    echo "branch=$branch"
    echo "created_at=$timestamp"
    echo "app_dir=$APP_DIR"
  } | run_as_root tee "$release_dir/release.env" >/dev/null

  echo "$release_dir"
}

cleanup_old_releases() {
  run_as_root mkdir -p "$RELEASES_DIR"
  mapfile -t releases < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d | sort -r)
  if (( ${#releases[@]} <= KEEP_RELEASES )); then
    return
  fi

  printf '%s\n' "${releases[@]:$KEEP_RELEASES}" | while IFS= read -r old_release; do
    case "$old_release" in
      "$RELEASES_DIR"/*) ;;
      *)
        echo "ERRO: caminho de backup inesperado, limpeza cancelada: $old_release"
        exit 1
        ;;
    esac
    echo "==> Removendo backup antigo: $old_release"
    run_as_root rm -rf "$old_release"
  done
}

deploy() {
  local old_commit new_commit release_dir
  old_commit="$(current_commit)"
  release_dir="$(backup_current_release)"

  echo "==> Atualizando codigo: $REMOTE/$BRANCH"
  git -C "$APP_DIR" fetch "$REMOTE" "$BRANCH"
  if git -C "$APP_DIR" show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git -C "$APP_DIR" checkout "$BRANCH"
  else
    git -C "$APP_DIR" checkout -B "$BRANCH" "$REMOTE/$BRANCH"
  fi
  git -C "$APP_DIR" pull --ff-only "$REMOTE" "$BRANCH"
  new_commit="$(current_commit)"

  echo "==> Commit anterior: $old_commit"
  echo "==> Commit novo:      $new_commit"
  echo "==> Backup criado em: $release_dir"

  echo "==> Rebuildando producao..."
  "$APP_DIR/build-prod.sh"

  cleanup_old_releases
}

resolve_release_dir() {
  if [[ "$TARGET_RELEASE" == "latest" ]]; then
    find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d | sort -r | head -n 1
  else
    echo "$TARGET_RELEASE"
  fi
}

rollback() {
  local release_dir commit
  release_dir="$(resolve_release_dir)"

  if [[ -z "$release_dir" || ! -f "$release_dir/release.env" ]]; then
    echo "ERRO: backup de release nao encontrado: ${release_dir:-latest}"
    exit 1
  fi

  commit="$(grep '^commit=' "$release_dir/release.env" | cut -d= -f2-)"
  if [[ -z "$commit" ]]; then
    echo "ERRO: arquivo release.env sem commit: $release_dir/release.env"
    exit 1
  fi

  echo "==> Restaurando release: $release_dir"
  echo "==> Voltando para commit: $commit"
  git -C "$APP_DIR" checkout "$commit"

  echo "==> Restaurando arquivos locais do backup..."
  run_as_root rsync -a --delete --no-owner --no-group \
    --exclude='.git/' \
    "$release_dir/app/" "$APP_DIR/"

  echo "==> Rebuildando producao no commit restaurado..."
  "$APP_DIR/build-prod.sh"
}

usage() {
  cat <<USAGE
Uso:
  ./sync-prod-github.sh deploy
  ./sync-prod-github.sh rollback [latest|/opt/projeto_piloto_app/releases/<pasta>]

Variaveis opcionais:
  BRANCH=main
  REMOTE=origin
  PROD_IP=192.168.0.122
  APP_DIR=/opt/projeto_piloto_app/app
  RELEASES_DIR=/opt/projeto_piloto_app/releases
  KEEP_RELEASES=5
USAGE
}

check_prod_host
require_command git
require_command rsync
require_command docker

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "ERRO: destino de producao invalido ou sem git: $APP_DIR"
  exit 1
fi

case "$ACTION" in
  deploy)
    deploy
    ;;
  rollback)
    rollback
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
