# Monitoramento do armazenamento de Produção

Menu exclusivo de SUPERADMIN: Administração e parâmetros → Armazenamento de Produção (`/superadmin/armazenamento`). Mostra quantidades e tamanho lógico dos áudios, fotos e outros arquivos, capacidade total, espaço disponível para gravações, ocupado/reservado e percentual de inodes. O servidor monitorado é 192.168.0.121, onde ficam fisicamente as mídias. O disco do sistema e o do PostgreSQL também são consultados por `statvfs`; pontos no mesmo filesystem compartilham a capacidade, não devem ser somados. Não mede CPU, memória ou o disco do servidor de aplicação .122.

Coleta local em Python a cada cinco minutos, via `fonica-armazenamento.timer`, instalado no semecel01. Varre metadados dos arquivos sem ler seus conteúdos, sem seguir links simbólicos e sem alterar mídias. Exclui a própria pasta `.monitoramento`. Contagens refletem os arquivos físicos, inclusive arquivos sem vínculo no banco; não representam apenas respostas preenchidas. Grava JSON de modo atômico em `/opt/projeto_piloto_app/data/audios/.monitoramento/armazenamento.json`. Não há consulta SQL nem nova tabela. A API lê esse arquivo pequeno, sem fazer varreduras durante a navegação.

A API autenticada `/api/superadmin/armazenamento` exige SUPERADMIN e valida formato, origem, capacidade e data. No DEV lê `AUDIO_READONLY_STORAGE_PATH`, o compartilhamento existente somente leitura de Produção; nunca usa as contagens locais como se fossem de Produção. Em Produção lê `AUDIO_STORAGE_PATH`. Ausência ou corrupção da coleta resulta em 503, sem substituir números por zero. Falha parcial e coleta antiga geram alerta.

Alertas para todos os superadmins conectados: banner nas páginas protegidas e detalhes no painel, com consulta automática a cada minuto enquanto a aba estiver visível. Atenção: ocupação >=80%, disponível <=5 GiB ou inodes ocupados >=90%. Crítico: ocupação >=90%, disponível <=2 GiB ou inodes ocupados >=95%. Coleta com mais de 15 minutos ou incompleta gera atenção mesmo com capacidade aparentemente normal. Falhas de consulta deixam explícito que os últimos números não foram confirmados. Os alertas são dentro do sistema; não enviam e-mails ou mensagens e não impedem novas gravações. Não há exclusão automática de arquivos.

Instalação do coletor: validar no DEV, publicar primeiro no GitHub e executar no .121, como ederoli:

```bash
sudo -n /usr/local/sbin/fonica-update executar SHA_COMPLETO_DA_MAIN instalar-monitoramento
```

O instalador faz cópia das configurações prévias, instala o coletor protegido por root e o timer, executa uma coleta inicial e verifica seu resultado. O serviço tem prioridade de I/O baixa, limite de 120 segundos e escrita restrita à pasta dos indicadores. A instalação não publica a aplicação em Produção. A API, o menu e o banner precisam da publicação normal do backend/frontend para aparecerem lá.

Verificar o timer com `systemctl status fonica-armazenamento.timer`, investigar falhas com `journalctl -u fonica-armazenamento.service` como administrador do servidor. Para desativar, `systemctl disable --now fonica-armazenamento.timer`; o painel avisará sobre dados antigos após 15 minutos.

Validação: `python3 scripts/monitoramento/test_coletor.py`; builds de backend/frontend; testes de regras em `backend/tests/armazenamento.test.cjs` e integração autenticada em `backend/tests/armazenamento.integration.cjs` (PostgreSQL DEV com rollback). A conferência final do DEV compara a API com a coleta real e valida o bundle publicado.
