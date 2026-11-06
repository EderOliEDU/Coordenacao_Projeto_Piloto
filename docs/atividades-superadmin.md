# Preenchimento e correção pelo superadministrador

No menu Administração e parâmetros, use **Preencher e corrigir atividades**. Selecione formulário ou verificação, fase e turma. A lista inclui atividades não iniciadas, em andamento e encerradas, inclusive registros de responsáveis cujo vínculo foi removido. Cada aluno aparece uma vez; se houver vários responsáveis ou registros, é preciso selecionar qual será preenchido ou corrigido. Nenhum registro histórico é descartado.

Ao abrir um registro, confirme que deseja preencher ou alterar mesmo sem ser o professor ou aplicador designado. Cancelar retorna à lista sem gravar. A confirmação é solicitada novamente ao abrir outra atividade ou recarregar a página. Saia do modo conferência antes de utilizar a edição.

A edição mantém as respostas no CPF do responsável original e na fase selecionada. Se não existir registro nem responsável atribuído, o novo registro fica no CPF do próprio superadministrador. Na criação de verificações, `criado_por` identifica o usuário autenticado. Corrigir uma atividade finalizada mantém sua situação; o formulário pode ser salvo sem precisar preencher novamente todas as questões.

A exceção permite ao superadministrador trabalhar também em fases encerradas ou inativas. Os prazos e restrições dos demais perfis continuam válidos. A finalização de verificações continua exigindo as respostas e áudios obrigatórios.

A migração `docs/migracoes-prod/2026-11-06-auditoria-atividades.sql` deve ser aplicada antes de disponibilizar esta versão. Validação no DEV: compilar backend e frontend e executar `backend/tests/atividadeSuperadmin.integration.cjs`, `backend/tests/periodoFormulario.integration.cjs` e `backend/tests/liberarReserva.integration.cjs`. Os testes de integração fazem rollback de todas as escritas.

## Auditoria

O botão de confirmação registra um evento `CONFIRMACAO` no banco antes de liberar a tela. Se o registro falhar, a edição permanece bloqueada. Cada gravação que modifica dados registra `ALTERACAO` na mesma transação das respostas: falha de auditoria reverte também a alteração.

O histórico identifica CPF e nome do superadministrador autenticado, CPF do responsável original, horário do banco, fase, turma, aluno, aplicação, método, rota, IP e identificador da requisição. Os retratos antes/depois incluem respostas, observações, situação, necessidades específicas e metadados dos áudios. Tokens, senhas e o conteúdo binário dos áudios não são copiados para o log. Leituras e tentativas rejeitadas não são registradas como alterações salvas.

Na lista de atividades, selecione fase e turma e use **Consultar histórico de alterações e confirmações**. A consulta exibe os últimos 100 eventos, com horários de Cuiabá, e é restrita a superadministradores. A API permite também filtrar por aluno. O histórico começa com a implantação desta versão; não reconstrói alterações anteriores.

A tabela `public.auditoria_atividades` permite inserção e consulta; um trigger rejeita UPDATE, DELETE e TRUNCATE. Não há endpoint de exclusão ou edição dos logs. A proteção não impede que um administrador do banco remova deliberadamente o trigger.

Uploads de áudio usam arquivos com nomes únicos e mantêm as versões anteriores. O log preserva os caminhos antes/depois. Se a gravação ou a auditoria falhar, os metadados são revertidos e o arquivo novo é removido; o áudio anterior permanece intacto. As versões devem fazer parte do backup próprio do ambiente. Não aplicar rotinas de limpeza dos arquivos antigos sem considerar as referências do histórico.

Os testes de integração instalam a migração dentro da transação de teste e desfazem tudo ao terminar; isso não instala permanentemente a tabela no DEV nem publica a aplicação.

## Publicação em Produção

Publicar o código e scripts na main do GitHub e conferir o SHA remoto. Executar, com esse mesmo SHA e pelo acesso limitado `fonica-update`, primeiro `atividades-superadmin-banco` no semecel01 e depois `atividades-superadmin-aplicacao` no semecel02.

O script do banco faz dump próprio de Produção e compara contagens e assinaturas das respostas, necessidades, aplicações e histórico dentro da transação da migração. O script da aplicação faz backup dos áudios e do código, preserva ambientes e overrides, salva as imagens anteriores e compila antes de substituir os serviços. Em caso de falha após o início da atualização, restaura código e imagens anteriores sem restaurar ou apagar dados do banco. A tabela aditiva de auditoria permanece para preservar o histórico. Os logs ficam em `/var/lib/fonica-update/logs`.
