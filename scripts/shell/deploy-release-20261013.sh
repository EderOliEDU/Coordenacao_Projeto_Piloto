#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
APP=/opt/projeto_piloto_app/app
BACKUP=/home/ederoli/projeto_piloto_backups/20261013-coleta-duas-etapas
EXPECTED="${1:?Informe o SHA completo do release aprovado no GitHub}"
PUBLIC_URL=https://fonica.rondonopolis.mt.gov.br
CHANGED=0
[[ $EUID -eq 0 ]] || { echo 'Execute este script com sudo.'; exit 1; }
[[ "$EXPECTED" =~ ^[0-9a-f]{40}$ ]] || { echo 'SHA inválido'; exit 1; }
[[ "$(hostname -I | awk '{print $1}')" == 192.168.0.122 ]] || { echo 'Servidor diferente de produção'; exit 1; }
[[ "$(realpath "$APP")" == /opt/projeto_piloto_app/app ]] || exit 1
[[ -s "$BACKUP/banco-before.dump" && -s "$BACKUP/app-before.tar.gz" && -s "$BACKUP/before.json" ]] || { echo 'Backup validado não encontrado'; exit 1; }
pg_restore --list "$BACKUP/banco-before.dump" >/dev/null
touch "$BACKUP/deploy.log"
chmod 644 "$BACKUP/deploy.log"
exec > >(tee -a "$BACKUP/deploy.log") 2>&1
status() { echo "$1" > "$BACKUP/status"; chmod 644 "$BACKUP/status"; echo "==> $1"; }
failed() {
  code=$?
  trap - ERR
  status FAILED
  if [[ "$CHANGED" == 1 && -f "$BACKUP/rollback.compose.json" ]]; then
    echo 'Restaurando as imagens anteriores, mantendo banco e áudios...'
    docker compose -f compose.yml -f compose.override.yml -f "$BACKUP/rollback.compose.json" --profile prod up -d --no-build --pull never --force-recreate backend-prod frontend-prod || true
  fi
  echo "Publicação interrompida. Backup: $BACKUP"
  exit "$code"
}
trap failed ERR
cd "$APP"
status PREFLIGHT
[[ -f compose.override.yml ]] || { echo 'Override local de produção ausente'; false; }
other="$(git diff --name-only | sed '/^nginx.prod.override.conf$/d')"
[[ -z "$other" ]] || { echo 'Há alterações locais não previstas; preserve-as antes da publicação.'; false; }
[[ "$(git rev-parse HEAD)" == dd6653bbb734d785800c958f5cfe4dae6d16d039 ]] || { echo 'O código anterior mudou desde a conferência'; false; }
mkdir -p "$BACKUP/config"
cp -p compose.override.yml nginx.prod.override.conf "$BACKUP/config/"
sha256sum backend/.env_prod > "$BACKUP/env-before.sha256"
old_backend="$(docker inspect --format '{{.Image}}' app-backend-prod-1)"
old_frontend="$(docker inspect --format '{{.Image}}' app-frontend-prod-1)"
docker image tag "$old_backend" app-backend-prod:rollback-20261013
docker image tag "$old_frontend" app-frontend-prod:rollback-20261013
printf '%s\n' "$old_backend" "$old_frontend" > "$BACKUP/old-images.txt"
printf '%s\n' '{"services":{"backend-prod":{"image":"app-backend-prod:rollback-20261013"},"frontend-prod":{"image":"app-frontend-prod:rollback-20261013"}}}' > "$BACKUP/rollback.compose.json"
status BACKUP_AUDIO
docker exec app-backend-prod-1 tar -C /opt/projeto_piloto_app/data/audios -czf - . > "$BACKUP/audios-before.tar.gz"
tar -tzf "$BACKUP/audios-before.tar.gz" >/dev/null
status GITHUB
git fetch origin main
[[ "$(git rev-parse origin/main)" == "$EXPECTED" ]] || { echo 'A main mudou: confira o novo commit antes de publicar'; false; }
git merge-base --is-ancestor HEAD "$EXPECTED"
git restore -- nginx.prod.override.conf
git checkout main
git merge --ff-only "$EXPECTED"
cp -p "$BACKUP/config/nginx.prod.override.conf" nginx.prod.override.conf
cmp compose.override.yml "$BACKUP/config/compose.override.yml"
sha256sum --check "$BACKUP/env-before.sha256"
docker compose --profile prod config --quiet
docker compose --profile prod config --format json | python3 -c '
import json,sys
c=json.load(sys.stdin)
m=[v for v in c["services"]["backend-prod"].get("volumes",[]) if v.get("target")=="/opt/projeto_piloto_app/data/audios"]
assert len(m)==1 and m[0].get("type")=="volume" and m[0].get("source")=="fonica_audios_prod", "Volume NFS de áudios foi alterado"
print("Configurações locais e volume NFS preservados.")'
status BUILD_BACKEND
docker compose --profile prod build backend-prod
status BUILD_FRONTEND
docker compose --profile prod build frontend-prod
status MIGRATION
docker compose --profile prod run --rm --no-deps --volume "$APP:/release:ro" backend-prod node /release/scripts/migrate-aplicador.cjs
status START
CHANGED=1
docker compose --profile prod up -d --no-build --force-recreate backend-prod frontend-prod
status HEALTHCHECK
for attempt in {1..12}; do
  front="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/ || true)"
  api="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/api/turmas || true)"
  if [[ "$front" == 200 && "$api" == 401 ]]; then break; fi
  sleep 3
done
[[ "$front" == 200 && "$api" == 401 ]] || { echo "Falha HTTP: frontend=$front API=$api"; false; }
docker exec app-frontend-prod-1 nginx -t
docker compose --profile prod ps
echo "Commit em produção: $(git rev-parse HEAD)"
echo "Frontend local=$front; API sem token=$api"
public="$(curl -s --connect-timeout 10 --max-time 20 -o /dev/null -w '%{http_code}' "$PUBLIC_URL/" || true)"
echo "Frontend público=$public"
status COMPLETE
