# Acesso de ederoli para atualizações de Produção

Regra solicitada pelo responsável em 22/10/2026: antes de qualquer atualização de Produção, atualizar o GitHub. Testar no DEV, revisar o diff, fazer commit e push na main; conferir o SHA publicado. Preservar dados, arquivos de ambiente, configurações locais e áudios. Não copiar dados do DEV para Produção.

O acesso SSH existente de ederoli é mantido. A permissão de atualização não tem expiração e não se limita a um release. O sudo permite apenas `/usr/local/sbin/fonica-update`, instalado com proprietário root. A ferramenta consulta o repositório oficial por HTTPS e exige que o SHA solicitado seja exatamente a main publicada; só executa arquivos regulares `scripts/producao/<nome>.sh` desse commit. Não aceita shell, SQL avulso, caminhos arbitrários ou pacotes enviados diretamente ao servidor. Quem publica scripts nessa main passa a ser uma autoridade de implantação com privilégio root; revisar esses scripts antes do push.

Ativação única, como root em semecel01 e semecel02: executar `scripts/operacao/instalar-acesso-ederoli.sh` junto de `fonica-update`. O instalador valida o sudoers, instala Git no banco se necessário e não muda regras SSH nem publica a aplicação. Não instalar os antigos acessos root ou por release.

Operação via SSH como ederoli:

```bash
sudo -n /usr/local/sbin/fonica-update status
sudo -n /usr/local/sbin/fonica-update executar SHA_COMPLETO nome-do-script
```

Para Q7/Q8, executar `questoes7-8-banco` no semecel01 e depois `questoes7-8-aplicacao` no semecel02, com o mesmo SHA confirmado na main. Os scripts fazem backups próprios; a migração verifica a preservação das respostas e aplicações em transação. O script de aplicação verifica a estrutura do banco antes de substituir os serviços e preserva configurações locais. Uma execução interrompida deve ser investigada antes de repetir. Logs protegidos em `/var/lib/fonica-update/logs`.

Para as próximas melhorias, publicar o script necessário em `scripts/producao/` junto do código, testes e migrações; não é necessário renovar a permissão de ederoli. Rollback também deve ter um procedimento revisado e publicado no GitHub. Revogar o privilégio removendo `/etc/sudoers.d/fonica-update` como root; isso não revoga o SSH de ederoli.
