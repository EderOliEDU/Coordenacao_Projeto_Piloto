#!/bin/bash
set -Eeuo pipefail
[[ $(hostname -s) == semecel01 ]] || { echo 'Este script é exclusivo do banco de Produção.'; exit 1; }
: "${FONICA_RELEASE_DIR:?Use fonica-update executar}"
umask 077
exec 9>/run/lock/fonica-update-db.lock
flock -n 9 || { echo 'Outra atualização está em execução.'; exit 1; }
backup=/var/backups/projeto-piloto/atividades-superadmin-$(date -u +%Y%m%dT%H%M%SZ)
install -d -o postgres -g postgres -m 700 "$backup"
runuser -u postgres -- pg_dump -Fc -d projPiloto -f "$backup/producao.dump"
runuser -u postgres -- pg_restore --list "$backup/producao.dump" >/dev/null
sha256sum "$backup/producao.dump" > "$backup/producao.dump.sha256"
# Cria a tabela com o mesmo proprietário usado pela aplicação.
{ printf '%s\n' 'SET ROLE userprojetopiloto;'; cat "$FONICA_RELEASE_DIR/docs/migracoes-prod/2026-11-06-auditoria-atividades.sql"; } |
 runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d projPiloto > "$backup/migracao.log" 2>&1
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d projPiloto -Atc "SELECT count(*),count(*) FILTER(WHERE evento='CONFIRMACAO') FROM public.auditoria_atividades" > "$backup/auditoria-apos-migracao.txt"
printf 'Auditoria criada. Respostas e histórico existentes conferidos na transação. Backup: %s\n' "$backup"
