#!/bin/bash
set -Eeuo pipefail
[[ $(hostname -s) == semecel01 ]] || { echo 'Este script é exclusivo do banco de Produção.'; exit 1; }
: "${FONICA_RELEASE_DIR:?Use fonica-update executar}"
umask 077
exec 9>/run/lock/fonica-update-db.lock
flock -n 9 || { echo 'Outra atualização está em execução.'; exit 1; }
backup=/var/backups/projeto-piloto/questoes7-8-$(date -u +%Y%m%dT%H%M%SZ)
install -d -o postgres -g postgres -m 700 "$backup"
runuser -u postgres -- pg_dump -Fc -d projPiloto -f "$backup/producao.dump"
runuser -u postgres -- pg_restore --list "$backup/producao.dump" >/dev/null
sha256sum "$backup/producao.dump" > "$backup/producao.dump.sha256"
# The migration and its preservation checks share a transaction.
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d projPiloto < "$FONICA_RELEASE_DIR/scripts/producao/questoes7-8-auditada.sql" > "$backup/migracao.log" 2>&1
printf 'Migração concluída, respostas históricas preservadas. Backup: %s\n' "$backup"
