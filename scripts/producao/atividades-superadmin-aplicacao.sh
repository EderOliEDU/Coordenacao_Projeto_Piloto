#!/usr/bin/env bash
# Publicação de edição excepcional e auditoria das atividades, após a migração do banco.
set -Eeuo pipefail
umask 077
APP=/opt/projeto_piloto_app/app
EXPECTED="${FONICA_RELEASE_SHA:?Use fonica-update executar}"
[[ $EUID -eq 0 ]] || { echo 'Execute com sudo no servidor de produção.'; exit 1; }
[[ "$EXPECTED" =~ ^[0-9a-f]{40}$ ]] || { echo 'SHA inválido.'; exit 1; }
hostname -I | tr ' ' '\n' | grep -Fx '192.168.0.122' >/dev/null || { echo 'Servidor diferente da produção.'; exit 1; }
exec 9>/run/lock/fonica-update-app.lock
flock -n 9 || { echo "Outra atualização está em execução."; exit 1; }
cd "$APP"
# Arquivos de ambiente e override permanecem fora da atualização.
[[ -f compose.override.yml && -f nginx.prod.override.conf ]] || { echo 'Configuração local de produção ausente.'; exit 1; }
[[ -z "$(git diff --name-only | sed '/^nginx.prod.override.conf$/d')" && -z "$(git diff --cached --name-only)" ]] || { echo 'Há alterações locais não previstas; publicação interrompida.'; exit 1; }
git fetch "${FONICA_GITHUB_MIRROR:?}" "$EXPECTED"
[[ "$(git rev-parse FETCH_HEAD)" == "$EXPECTED" ]] || { echo 'A main diverge do release esperado.'; exit 1; }
git merge-base --is-ancestor HEAD "$EXPECTED" || { echo 'Histórico de produção divergente.'; exit 1; }
# Confere os requisitos no serviço atual sem modificar os dados.
docker exec -i app-backend-prod-1 node <<'JS'
const {getPgPool}=require('./dist/services/pgPool');
(async()=>{const c=await getPgPool().connect();try{await c.query('BEGIN READ ONLY');
await c.query('SELECT autor_cpf,responsavel_cpf,antes,depois FROM public.auditoria_atividades LIMIT 0');
const trigger=await c.query("SELECT 1 FROM pg_trigger WHERE tgrelid='public.auditoria_atividades'::regclass AND tgname='auditoria_atividades_imutavel' AND tgenabled='O'");
if(trigger.rowCount!==1)throw Error('Proteção da auditoria ausente. Execute primeiro a migração do banco.');
await c.query('SELECT nome_escrito FROM public.avaliacao_aplicador_respostas LIMIT 0');
await c.query('SELECT vogal,acertou FROM public.avaliacao_aplicador_vogais LIMIT 0');
await c.query('ROLLBACK');}finally{c.release()}})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>getPgPool().end());
JS
BACKUP="/opt/projeto_piloto_app/releases/atividades-superadmin-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
BEFORE="$(git rev-parse HEAD)"
printf '%s\n' "$BEFORE" > "$BACKUP/commit-before.txt"
cp -p compose.yml compose.override.yml nginx.prod.override.conf "$BACKUP/"
find . -maxdepth 2 -type f \( -name '.env' -o -name '.env_*' -o -name '.env.*' \) -exec sha256sum {} + > "$BACKUP/env.sha256"
tar --exclude='*/node_modules' --exclude='*/dist' -czf "$BACKUP/code-before.tar.gz" backend frontend docs scripts .git
tag="rollback-atividades-superadmin-$(date +%Y%m%d%H%M%S)"
docker image tag "$(docker inspect -f '{{.Image}}' app-backend-prod-1)" "app-backend-prod:$tag"
docker image tag "$(docker inspect -f '{{.Image}}' app-frontend-prod-1)" "app-frontend-prod:$tag"
printf '{"services":{"backend-prod":{"image":"app-backend-prod:%s"},"frontend-prod":{"image":"app-frontend-prod:%s"}}}\n' "$tag" "$tag" > "$BACKUP/rollback.compose.json"
# Backup próprio das mídias de Produção; nenhum arquivo vem do DEV.
audio_root="$(docker exec app-backend-prod-1 printenv AUDIO_STORAGE_PATH)"
[[ "$audio_root" == /* && "$audio_root" != / ]] || { echo 'Diretório de áudios inválido.'; exit 1; }
docker exec app-backend-prod-1 du -sh "$audio_root"
docker exec app-backend-prod-1 tar -C "$audio_root" -czf - . > "$BACKUP/audios-before.tar.gz"
tar -tzf "$BACKUP/audios-before.tar.gz" >/dev/null
sha256sum "$BACKUP/audios-before.tar.gz" > "$BACKUP/audios-before.tar.gz.sha256"
printf '%s\n' "$EXPECTED" > "$BACKUP/commit-release.txt"
SOURCE_CHANGED=0
rollback() {
  local code=$?
  trap - ERR
  if [[ $SOURCE_CHANGED -eq 1 ]]; then
    echo 'Restaurando código e imagens anteriores; banco e áudios preservados.'
    git restore --source="$BEFORE" --staged --worktree -- backend frontend docs scripts || true
    git update-ref HEAD "$BEFORE" "$EXPECTED" || true
    cp -p "$BACKUP/nginx.prod.override.conf" nginx.prod.override.conf
    docker compose -f compose.yml -f compose.override.yml -f "$BACKUP/rollback.compose.json" --profile prod up -d --no-deps --no-build --pull never backend-prod frontend-prod || true
  fi
  echo "Publicação interrompida. Backup: $BACKUP"
  exit "$code"
}
trap rollback ERR
git restore -- nginx.prod.override.conf
SOURCE_CHANGED=1
git merge --ff-only "$EXPECTED"
cp -p "$BACKUP/nginx.prod.override.conf" nginx.prod.override.conf
cmp compose.override.yml "$BACKUP/compose.override.yml"
cmp compose.yml "$BACKUP/compose.yml"
sha256sum --check "$BACKUP/env.sha256"
docker compose --profile prod config --quiet
# Compile antes de substituir os serviços em execução.
docker compose --profile prod build backend-prod frontend-prod
docker compose --profile prod up -d --no-deps --no-build backend-prod frontend-prod
for attempt in {1..15}; do
  health="$(curl -s --max-time 5 http://127.0.0.1:5173/api/health || true)"
  front="$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/superadmin/atividades || true)"
  auth="$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/api/superadmin/atividades/auditoria || true)"
  if [[ "$health" == *'"ok":true'* && "$front" == 200 && "$auth" == 401 ]]; then break; fi
  sleep 2
done
[[ "$health" == *'"ok":true'* && "$front" == 200 && "$auth" == 401 ]]
docker exec app-frontend-prod-1 nginx -t

# Verificações somente de leitura no backend publicado, sem avaliações fictícias.
docker exec -i app-backend-prod-1 node <<'JS'
const assert=require('assert/strict');const {getPgPool}=require('./dist/services/pgPool');
(async()=>{const c=await getPgPool().connect();try{
 await c.query('BEGIN READ ONLY');
 await c.query('SELECT id,ocorrido_em,autor_cpf,responsavel_cpf,evento,antes,depois FROM public.auditoria_atividades LIMIT 0');
 const trigger=await c.query("SELECT 1 FROM pg_trigger WHERE tgrelid='public.auditoria_atividades'::regclass AND tgname='auditoria_atividades_imutavel' AND tgenabled='O'");
 assert.equal(trigger.rowCount,1);
 const periodo=await require('./dist/services/periodoFormulario').consultarPeriodoFormulario(c);
 console.log(JSON.stringify({auditoria:true,protecaoHistorico:true,periodoFormularioAberto:periodo.aberto}));
 await c.query('ROLLBACK');
}finally{c.release()}})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>getPgPool().end());
JS

public="$(curl -s --max-time 20 -o /dev/null -w '%{http_code}' https://fonica.rondonopolis.mt.gov.br/superadmin/atividades || true)"
[[ "$public" == 200 ]]
echo "Publicação concluída: $EXPECTED. HTTP público: $public. Backup: $BACKUP"
