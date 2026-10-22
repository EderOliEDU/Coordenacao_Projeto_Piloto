#!/bin/bash
set -Eeuo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 077
[[ $EUID -eq 0 ]] || { echo 'Execute como root usando su -.'; exit 1; }
case "$(hostname -s)" in semecel01|semecel02) ;; *) echo 'Servidor não autorizado.'; exit 1;; esac
id ederoli >/dev/null
command -v visudo >/dev/null
# O banco ainda pode não ter Git instalado. Não atualiza os demais pacotes.
if ! command -v git >/dev/null; then
 apt-get update
 apt-get install -y --no-install-recommends git ca-certificates
fi
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
[[ -f $source_dir/fonica-update && ! -L $source_dir/fonica-update ]] || exit 1
install -o root -g root -m 755 "$source_dir/fonica-update" /usr/local/sbin/fonica-update
candidate=$(mktemp /etc/sudoers.d/.fonica-update.XXXXXX)
trap 'rm -f "$candidate"' EXIT
cat > "$candidate" <<'SUDOERS'
# Atualizações do repositório oficial, sempre após publicação na main do GitHub.
# O comando valida argumentos, SHA, repositório e caminho do script.
ederoli ALL=(root) NOPASSWD: /usr/local/sbin/fonica-update
SUDOERS
chmod 440 "$candidate"
visudo -cf "$candidate"
# Preserve eventual regra anterior caso a validação global falhe.
backup=$(mktemp -d /root/fonica-sudo-before.XXXXXX)
if [[ -f /etc/sudoers.d/fonica-update ]]; then cp -p /etc/sudoers.d/fonica-update "$backup/regra"; fi
install -o root -g root -m 440 "$candidate" /etc/sudoers.d/fonica-update
if ! visudo -c; then
 if [[ -f $backup/regra ]]; then cp -p "$backup/regra" /etc/sudoers.d/fonica-update; else rm -f /etc/sudoers.d/fonica-update; fi
 echo 'Validação recusada; regra anterior preservada.'; exit 1
fi
rm -f /etc/sudoers.d/fonica-update-16710d4
echo 'ederoli autorizado para atualizações futuras, sem senha ou expiração.'
echo 'Produção só executará scripts de atualização publicados na main do GitHub.'
echo 'Nenhuma publicação de aplicação ou migração foi executada pelo instalador.'
