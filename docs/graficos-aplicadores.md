# Gráficos das verificações por aplicadores

Implementação: 19/10/2026. Acesso por administradores e superadministradores, no menu de verificações, em “Gráficos das verificações”, ou pelo link do acompanhamento. URL: `/admin/aplicador/graficos`.

A página consulta `GET /api/superadmin/aplicador/graficos`. Os parâmetros opcionais são `faseId`, `escolaId` e `versao` (1 ou 2). O período padrão é o mais recente com aplicações; sem aplicações, usa o período mais recente cadastrado. Período informado inexistente ou filtro malformado produz HTTP 400. Sem resultados, mostra o estado vazio. Escolas disponíveis são as que têm aplicações no período. O acesso usa a mesma autorização administrativa do acompanhamento e é verificado no backend.

A consulta usa uma transação REPEATABLE READ READ ONLY, sem alteração de esquema ou dados. A API retorna somente agregados, períodos e escolas, sem nomes de alunos, CPFs ou caminhos de áudio. A base é a conexão configurada no backend; nenhum relatório estático DEV foi embutido. Aplicações canceladas e incompletas aparecem no andamento, mas não nas distribuições de respostas.

## Apresentação e denominadores

- Resumo: aplicações concluídas e contagens distintas de alunos, turmas e aplicadores nas concluídas. Alunos e aplicações podem divergir se houver duplicidades; não são apresentados como a mesma unidade.
- Andamento: inclui pendentes, em andamento, concluídas e canceladas. A taxa de conclusão usa somente aplicações não canceladas registradas; não estima cobertura da população elegível.
- Todas as distribuições são separadas por versão, mesmo quando o filtro inclui ambas. O campo de período do sistema não significa fase de aprendizagem de Ehri.
- Q1/Q3/Q4/Q5/Q6/Q7/Q8: contagens e percentuais sobre as concluídas da versão, com ausência de resposta explícita. Opções/perguntas inativas que tenham registros no recorte são preservadas.
- Q2: não lê a resposta genérica histórica, evitando duplicação. A cobertura por vogal usa concluídas como base; os resultados usam somente respostas avaliadas, unificando LEGADO e NOVO por vogal e resposta. A origem permanece no banco para auditoria interna; não aparece na tela, na API de gráficos ou no CSV. Sem observações, percentual é indefinido (travessão), nunca zero de desempenho.
- Q5: detalhe por letra, com denominador de respostas da letra. Não afirma que registros antigos seguiram o critério novo e não ranqueia letras ou aplicadores.
- Q8: o rótulo original e sua ausência são preservados; não é classificação validada. A questão é opcional no fluxo atual.
- Q9: distribuição por palavra sobre as concluídas; “não respondeu” difere de “sem registro”. Marcações da mesma criança não são independentes. O gráfico de áudio verifica referência e tamanho positivo, sem afirmar acesso ou qualidade do arquivo.
- Cada barra tem tabela textual de contagens e percentuais, para acesso sem depender de cores. CSV exporta os agregados filtrados com período, escola, versão e base de concluídas por versão. Impressão/PDF usa o diálogo do navegador, mantendo as tabelas e o contexto dos filtros.

## Validação

Builds TypeScript/backend e frontend/Vite. Testes HTTP verificam 401/403, filtro inválido, parâmetros e Cache-Control. Testes de serviço verificam snapshot, rollback e liberação da conexão. Integração DEV em conexão somente leitura confere totais independentes, separação de versões, cinco posições por aplicação em Q2, exclusão da Q2 genérica, filtro de escola, recorte vazio e período inexistente.

Comandos na raiz:

```sh
npm --prefix backend run build
npm --prefix frontend run build
node --test backend/tests/aplicadorGraficos.test.cjs
node --test backend/tests/aplicadorGraficos.integration.cjs
node --test frontend/tests/*.test.cjs
```

O teste integrado usa `backend/.env_dev`, não cria fixtures e exige acesso ao DEV. Antes de disponibilizar em outro ambiente, confirmar que as migrações de aplicadores e de vogais já estão instaladas; a disponibilização em outro ambiente requer seu próprio procedimento de publicação. Não foram executadas migrações nem publicação em produção. A validação estatística/pedagógica das categorias continua dependente de revisão independente das evidências.

## Disponibilização no DEV

Publicado em 19/10/2026 com reconstrução e recriação somente dos serviços `backend-dev` e `frontend-dev`, preservando os arquivos Compose ativos e o volume de áudios de produção em modo de leitura. Acesso: https://172.17.2.42:5173/admin/aplicador/graficos .

Conferência após a atualização: tela HTTP 200, health da API OK, bundle servido contendo a nova rota e consulta agregada no backend ativo retornando período 3, 98 aplicações concluídas e 980 marcações de leitura. A autorização exige administrador/superadministrador; o teste de publicação não utilizou a sessão do usuário.
