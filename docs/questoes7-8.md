# Detalhamento da escrita do nome e opção não escreveu

Melhoria de 22/10/2026, preparada primeiro no DEV.

Questão 7 mantém a opção principal de apoio e armazena um complemento independente:

| Opção principal | Complementos |
| --- | --- |
| Com apoio | Só o nome; Nome composto; Nome completo |
| Sem apoio | Só o nome; Nome composto; Nome completo |
| Não escreve | Nenhum complemento |

A tela só salva o par após escolher o complemento. Trocar o apoio exige uma nova seleção do complemento; não transfere automaticamente o detalhe anterior. Falhas de gravação são exibidas sem considerar uma nova resposta como salva. O aplicador pode corrigir um complemento já gravado enquanto a aplicação estiver em andamento.

`avaliacao_aplicador_respostas.nome_escrito` aceita NOME, NOME_COMPOSTO, NOME_COMPLETO ou NULL. Os IDs e significados das opções anteriores permanecem iguais; respostas históricas mantêm NULL, sem inferência sobre quanto do nome foi escrito. Aplicações existentes conservam `exige_detalhe_nome=false`, sem reabrir avaliações concluídas. Novas aplicações usam true e não finalizam respostas de apoio sem complemento válido. Toda gravação nova da Q7 exige a combinação válida, inclusive ao editar aplicações antigas.

Questão 8 acrescenta `NAO_ESCREVEU`, exibida como NÃO ESCREVEU, sem substituir as quatro opções anteriores e sem alterar sua condição opcional. A migração atualiza apenas a estrutura e o catálogo de opções; não copia dados entre ambientes.

Migração: `migracoes-prod/2026-10-22-questoes7-8.sql`, transacional e idempotente. O backup DEV e o ensaio ficam em `out/backups/questoes7-8-*`, com conferência das assinaturas das respostas e aplicações existentes. Antes de uma futura publicação em Produção, fazer backup próprio e executar a migração junto à versão correspondente de backend/frontend.

Validação: builds de backend/frontend, testes PostgreSQL em `backend/tests/vogais.integration.cjs` (fixtures revertidas) e fluxo da tela em `frontend/tests/nome.test.cjs`. A listagem de opções da Q8 e a API de questionário devolvem os novos campos, permitindo conferência após recarregar a avaliação.
