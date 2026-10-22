#!/bin/bash
set -Eeuo pipefail
umask 077
[[ $EUID -eq 0 && $(hostname -s) == semecel01 ]] || { echo 'Instalação exclusiva no servidor de armazenamento de Produção.'; exit 1; }
: "${FONICA_RELEASE_DIR:?Use fonica-update executar}"
command -v python3 >/dev/null
[[ -d /opt/projeto_piloto_app/data/audios ]] || { echo 'Armazenamento de mídias não encontrado.'; exit 1; }
backup=/var/backups/projeto-piloto/monitoramento-$(date -u +%Y%m%dT%H%M%SZ)
install -d -m 700 "$backup"
for file in /usr/local/lib/fonica-monitoramento/coletar-armazenamento.py /etc/systemd/system/fonica-armazenamento.service /etc/systemd/system/fonica-armazenamento.timer; do
 if [[ -f $file ]]; then cp -p "$file" "$backup/"; fi
done
install -d -o root -g root -m 755 /usr/local/lib/fonica-monitoramento
install -o root -g root -m 644 "$FONICA_RELEASE_DIR/scripts/monitoramento/coletar-armazenamento.py" /usr/local/lib/fonica-monitoramento/coletar-armazenamento.py
install -d -m 755 /opt/projeto_piloto_app/data/audios/.monitoramento
cat > /etc/systemd/system/fonica-armazenamento.service <<'UNIT'
[Unit]
Description=Contagem de midias e capacidade do armazenamento FonIca
[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /usr/local/lib/fonica-monitoramento/coletar-armazenamento.py
User=root
UMask=0022
Nice=10
IOSchedulingClass=idle
TimeoutStartSec=120
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/opt/projeto_piloto_app/data/audios/.monitoramento
UNIT
cat > /etc/systemd/system/fonica-armazenamento.timer <<'UNIT'
[Unit]
Description=Atualiza indicadores de armazenamento FonIca a cada 5 minutos
[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemd-analyze verify /etc/systemd/system/fonica-armazenamento.service /etc/systemd/system/fonica-armazenamento.timer
systemctl daemon-reload
systemctl enable --now fonica-armazenamento.timer
systemctl start fonica-armazenamento.service
python3 - <<'PY'
import json
p='/opt/projeto_piloto_app/data/audios/.monitoramento/armazenamento.json'
d=json.load(open(p))
assert d['servidor']=='192.168.0.121' and d['completo'] and d['discos']
print(json.dumps({'coletadoEm':d['coletadoEm'],'audios':d['audios'],'fotos':d['fotos'],'discos':len(d['discos'])},ensure_ascii=False))
PY
echo "Coletor instalado. Sem alteração em avaliações ou mídias. Backup da configuração: $backup"
