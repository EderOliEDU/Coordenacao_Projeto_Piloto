#!/usr/bin/env bash
# Publicação dos gráficos e Protocolo V1. Não executa migrações.
set -Eeuo pipefail
umask 077
APP=/opt/projeto_piloto_app/app
EXPECTED="${1:?Informe o SHA completo publicado no GitHub}"
[[ $EUID -eq 0 ]] || { echo 'Execute com sudo no servidor de produção.'; exit 1; }
[[ "$EXPECTED" =~ ^[0-9a-f]{40}$ ]] || { echo 'SHA inválido.'; exit 1; }
hostname -I | tr ' ' '\n' | grep -Fxq '192.168.0.122' || { echo 'Servidor diferente da produção.'; exit 1; }
cd "$APP"
# Arquivos de ambiente e override permanecem fora da atualização.
[[ -f compose.override.yml && -f nginx.prod.override.conf ]] || { echo 'Configuração local de produção ausente.'; exit 1; }
[[ -z "$(git diff --name-only | sed '/^nginx.prod.override.conf$/d')" && -z "$(git diff --cached --name-only)" ]] || { echo 'Há alterações locais não previstas; publicação interrompida.'; exit 1; }
git fetch origin main
[[ "$(git rev-parse origin/main)" == "$EXPECTED" ]] || { echo 'A main diverge do release esperado.'; exit 1; }
git merge-base --is-ancestor HEAD "$EXPECTED" || { echo 'Histórico de produção divergente.'; exit 1; }
# Confere pré-requisitos no backend ainda em execução, sem DDL ou escrita.
docker exec -i app-backend-prod-1 node <<'JS'
const {getPgPool}=require('./dist/services/pgPool');
(async()=>{const c=await getPgPool().connect();try{await c.query('BEGIN READ ONLY');
await c.query('SELECT versao_instrumento FROM public.avaliacao_aplicador_aplicacoes LIMIT 0');
await c.query('SELECT vogal,acertou FROM public.avaliacao_aplicador_vogais LIMIT 0');
const f=await c.query('SELECT nome FROM public.avaliacao_fases WHERE id_fase=$1',[Number(process.env.TERCEIRA_AVALIACAO_FASE_ID||3)]);
if(f.rowCount!==1)throw Error('Terceira fase não cadastrada.');
console.log('Pré-requisito: período do relatório = '+f.rows[0].nome);
await c.query('ROLLBACK');}finally{c.release()}})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>getPgPool().end());
JS
BACKUP="/opt/projeto_piloto_app/releases/relatorios-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
BEFORE="$(git rev-parse HEAD)"
printf '%s\n' "$BEFORE" > "$BACKUP/commit-before.txt"
cp -p compose.override.yml nginx.prod.override.conf "$BACKUP/"
find . -maxdepth 2 -type f \( -name '.env' -o -name '.env_*' -o -name '.env.*' \) -exec sha256sum {} + > "$BACKUP/env.sha256"
tar --exclude='*/node_modules' --exclude='*/dist' -czf "$BACKUP/code-before.tar.gz" backend frontend docs scripts .git
tag="rollback-relatorios-$(date +%Y%m%d%H%M%S)"
docker image tag "$(docker inspect -f '{{.Image}}' app-backend-prod-1)" "app-backend-prod:$tag"
docker image tag "$(docker inspect -f '{{.Image}}' app-frontend-prod-1)" "app-frontend-prod:$tag"
printf '{"services":{"backend-prod":{"image":"app-backend-prod:%s"},"frontend-prod":{"image":"app-frontend-prod:%s"}}}\n' "$tag" "$tag" > "$BACKUP/rollback.compose.json"
SOURCE_CHANGED=0
rollback() {
  local code=$?
  trap - ERR
  if [[ $SOURCE_CHANGED -eq 1 ]]; then
    echo 'Restaurando código e imagens anteriores; banco e áudios preservados.'
    git restore --source="$BEFORE" --staged --worktree -- backend frontend docs scripts || true
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
sha256sum --check "$BACKUP/env.sha256"
docker compose --profile prod config --quiet
# Compile antes de substituir os serviços em execução.
docker compose --profile prod build backend-prod frontend-prod
docker compose --profile prod up -d --no-deps --no-build backend-prod frontend-prod
for attempt in {1..15}; do
  health="$(curl -s --max-time 5 http://127.0.0.1:5173/api/health || true)"
  front="$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/admin/aplicador/relatorio-terceira || true)"
  auth="$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/api/superadmin/aplicador/relatorio-terceira || true)"
  if [[ "$health" == *'"ok":true'* && "$front" == 200 && "$auth" == 401 ]]; then break; fi
  sleep 2
done
[[ "$health" == *'"ok":true'* && "$front" == 200 && "$auth" == 401 ]]
docker exec app-frontend-prod-1 nginx -t
docker exec -i app-backend-prod-1 node <<'JS'
const {getPgPool}=require('./dist/services/pgPool');
require('./dist/services/relatorioTerceiraAvaliacao').carregarRelatorioTerceiraAvaliacao()
.then(d=>console.log(JSON.stringify({protocolo:d.protocolo.codigo,fase:d.filtros.faseId,criancas:d.base})))
.catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>getPgPool().end());
JS
public="$(curl -s --max-time 20 -o /dev/null -w '%{http_code}' https://fonica.rondonopolis.mt.gov.br/admin/aplicador/relatorio-terceira || true)"
[[ "$public" == 200 ]]
echo "Publicação concluída: $EXPECTED. HTTP público: $public. Backup: $BACKUP"
