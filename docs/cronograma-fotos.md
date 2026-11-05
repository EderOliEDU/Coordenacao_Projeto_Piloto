# Fotos das atividades no cronograma

Cada conteúdo da turma tem um painel de fotos, aberto pelo botão “Fotos das atividades”. É permitida uma foto **por professor, turma e conteúdo**. Em turmas integrais, cada professor atribuído pode anexar sua própria foto ao mesmo conteúdo. A API serializa envios concorrentes por turma/conteúdo/CPF normalizado e bloqueia apenas a segunda foto do mesmo autor. Para substituir, cada professor exclui sua própria foto; não pode excluir a do colega. Registros antigos são preservados. A legenda identifica o professor pelo nome cadastrado, priorizando o nome social. São aceitos JPG, PNG e WebP, até 8 MB por imagem. As fotos não são obrigatórias para marcar ou salvar conteúdos. Desmarcar o conteúdo não exclui suas fotos.

A galeria só carrega quando aberta. As imagens são lidas pela API autenticada, com autorização para a turma e o conteúdo, sem URLs públicas. Professores atribuídos podem consultar os registros da turma; o autor e os administradores podem excluir anexos. O modo conferência permite consultar, mas bloqueia anexar e excluir. O servidor confere os bytes do tipo de arquivo, limita tamanho e quantidade e usa nomes UUID. Se o banco rejeitar a gravação, o arquivo criado é removido.

Arquivos em `AUDIO_STORAGE_PATH/cronograma-fotos`, um subdiretório separado dos áudios no mesmo volume persistente. A variável opcional `CRONOGRAMA_FOTOS_STORAGE_PATH` permite outra raiz de armazenamento. No DEV o caminho padrão usa o volume local do DEV; o compartilhamento de áudios de Produção permanece somente leitura. Em Produção, o volume atual de áudios é NFS no servidor **192.168.0.121**, portanto as fotos também serão fisicamente armazenadas nesse servidor quando publicadas, conforme confirmação do solicitante. Não gravar fotos de teste no volume de Produção. Incluir essa subpasta nos backups do armazenamento e os metadados no backup do banco.

Metadados em `public.cronograma_fotos`, vinculados à turma, ao conteúdo e ao CPF do autor. Não há FK para `cronograma_aplicacao`: o catálogo legado não possui unicidade nesse identificador; o vínculo com etapa/conteúdo é validado na API, como no cronograma existente. A FK da turma é mantida. Exclusão remove o vínculo e tenta limpar o binário, registrando eventual falha de limpeza. A manutenção que exclui turmas diretamente deve também limpar arquivos sem vínculo.

Migração idempotente em `migracoes-prod/2026-10-22-cronograma-fotos.sql`; não altera respostas de avaliações ou cronogramas existentes. A API também garante a criação da tabela uma vez por processo, após autorização, seguindo o padrão do cronograma. Na publicação, usar backup próprio e aplicar a estrutura no banco de Produção. Nunca copiar dados do DEV. Primeiro testar no DEV e publicar no GitHub, conforme `acesso-atualizacoes-producao.md`.

Validação: builds de backend/frontend e `backend/tests/cronogramaFotos.integration.cjs`, com PostgreSQL real do DEV, transação revertida e diretório temporário de arquivos. Cobre upload/leitura dos mesmos bytes, acesso entre turmas, modo conferência, limites/tipos inválidos, falha no banco, limpeza e preservação ao desmarcar conteúdo.


## Consulta administrativa das fotos

Administradores e superadministradores podem abrir **Administração e parâmetros → Fotos das atividades**, ou o cartão **Fotos das atividades** em `/admin`. A página `/admin/cronograma/fotos` permite filtrar por escola, turma, conteúdo e professor, com paginação de 12 fotos e ampliação da imagem em outra aba. A galeria é de consulta, sem comandos de anexar ou excluir. Não é necessário estar atribuído como professor à turma.

A API `GET /api/cronogramas/administracao/fotos` exige perfil administrativo, restringe o projeto e valida os filtros. As imagens continuam protegidas pelas rotas autenticadas existentes de cada turma/conteúdo. A conferência de um professor não dá acesso à galeria geral; há um botão para sair desse modo e consultar com o perfil administrativo. A consulta inclui anexos preservados de conteúdos desmarcados; não exclui fotos e não exige migração de banco.


## Validação das fotos de Produção no DEV

Na galeria administrativa do DEV, a origem **Produção — somente leitura** consulta um catálogo de metadados publicado a cada cinco minutos no compartilhamento NFS já existente. A consulta de Produção é selecionada inicialmente no DEV; **DEV — registros locais** permite testar uploads locais. O catálogo não é importado para o banco DEV e não fornece CPF na resposta: o filtro de professor usa um identificador opaco derivado do CPF. Arquivos são abertos somente pelo endpoint autenticado de leitura, restrito a administradores/superadmins. Não há POST/DELETE para a origem de Produção.

O coletor no .121 consulta apenas metadados do projeto via SQL em transação somente leitura e publica `.monitoramento/cronograma-fotos.json` de forma atômica. Instalar a versão atualizada do coletor com `instalar-monitoramento`, sempre após publicar os scripts no GitHub. Coleta ausente não é substituída por números locais, e a interface informa quando o catálogo tem mais de 15 minutos. A reprodução de uma foto referenciada no banco DEV pode recorrer ao volume de Produção somente para leitura; uploads e exclusão de arquivos continuam no volume local DEV.
