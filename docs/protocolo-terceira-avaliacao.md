# Protocolo de Análise da Terceira Avaliação — versão 1.0

Implementação para avaliação no DEV em 20/10/2026. Código do protocolo: `TERCEIRA-AVALIACAO-V1`. É uma rubrica operacional do projeto para descrição padronizada das respostas; não é instrumento psicométrico validado nem algoritmo de classificação de Ehri.

## Recorte e acesso

Menu administrativo “Relatório da terceira avaliação”, rota `/admin/aplicador/relatorio-terceira`. API `/api/superadmin/aplicador/relatorio-terceira`, com filtros opcionais `escolaId` e `turmaId`. Mesma autorização de administradores/superadministradores do acompanhamento. A API rejeita filtros de fase e versão, impedindo alteração do recorte previsto.

Terceira fase configurada no backend por `TERCEIRA_AVALIACAO_FASE_ID`, padrão 3, correspondente à terceira fase dos aplicadores neste DEV. Não procura automaticamente o período mais recente. O relatório é coletivo, por turma, escola ou conjunto de escolas. Não inclui dados dos professores, comparação temporal ou dados pessoais de crianças.

Uma única aplicação concluída por criança no período. Quando há mais de uma, seleciona a maior data de conclusão, depois o maior identificador; data de conclusão nula fica por último. Seleção ocorre antes do filtro de escola, evitando contar novamente uma aplicação antiga de criança transferida. As consultas usam um único snapshot REPEATABLE READ READ ONLY. A regra se aplica apenas ao relatório; o painel de gráficos continua apresentando os registros coletados de acordo com seus próprios filtros.

## Cálculos e descrições fixas

- Q1, Q3, Q4, Q5 e Q6: SIM e NÃO. Percentual de SIM = SIM/(SIM+NÃO)*100; mesma fórmula para NÃO. Ausências fora do denominador, mas apresentadas em contagem sobre a base de crianças do recorte.
- Q2: mesmo cálculo por vogal, agregando respostas sem mostrar a origem interna. Nenhuma conversão de posição não avaliada em erro.
- Q5: resultado geral sobre a consoante aplicada e detalhes por letra. No detalhe, a base é o grupo que tem resposta naquela consoante, não todas as crianças. Não inferir qual letra deveria ter sido aplicada a quem não possui resultado.
- Q7: com apoio, sem apoio e não escreve. Q8: quatro classificações originais de escrita, descritas como julgamento registrado; sem atribuir uma fase global nova. Percentuais sobre respostas válidas da questão.
- Q9: cinco categorias originais por palavra. Percentuais sobre as classificações registradas da palavra. NAO_RESPONDEU é uma categoria; não equivale à ausência de registro ou áudio. A redação não afirma ter revisado gravações.
- Cada item apresenta base, avaliadas, ausentes, resultados e limite da conclusão. Sem dados: percentual nulo, frase “Não há evidência registrada suficiente para esta habilidade”. Percentuais numéricos arredondados a uma casa decimal; podem somar 99,9% ou 100,1% por arredondamento.

A redação é determinística: a mesma entrada gera o mesmo texto e os mesmos cálculos. O sistema não chama modelo de IA nem envia dados a terceiros para criar os relatórios. A função de cálculo não atribui nota geral, diagnóstico, prontidão ou evolução.

## Estrutura da devolutiva

1. Identificação do protocolo e versão, recorte, base e data de geração.
2. Regras de cálculo e interpretação.
3. Resultados e limites por item Q1–Q9, incluindo vogais e palavras.
4. Habilidades demonstradas, com quantidade e denominador por tarefa. Com apoio é explicitamente qualificado.
5. Continuidade pedagógica por regras fixas: novas oportunidades no mesmo domínio quando há NÃO; acompanhamento do nome quando com apoio/não escreve; retomada de relações letra–som e combinação nos registros de leitura com uso ausente/parcial dos sons. São orientações gerais para revisão pedagógica, sem diagnóstico causal ou prescrição individualizada.
6. Itens com dados insuficientes, em quantidade e base.
7. Síntese de limites para a transição ao Ensino Fundamental.

O texto pode ser baixado em TXT ou impresso/salvo como PDF pelo navegador. Metadados de protocolo e recorte acompanham a exportação. O relatório não é salvo como registro imutável no banco: baixar o arquivo preserva o resultado daquela geração; nova consulta pode refletir novos dados. Mudanças futuras de regra exigem versionar o protocolo e seus testes.

## Verificação

Testes de função pura: denominadores, arredondamento, ausências, zero avaliadas, categorias Q7/Q8, Q2 agregada, grupos por consoante, Q9 sem resposta, base vazia, entrada inconsistente e saída determinística. Testes HTTP: autenticação, autorização e bloqueio de fase/versão. Integração no DEV em conexão somente leitura: base igual ao número de crianças distintas concluídas na terceira fase e recorte vazio.

Builds de backend e frontend. Comandos de testes após build:

```sh
node --test backend/tests/relatorioTerceira.test.cjs backend/tests/aplicadorGraficos.test.cjs backend/tests/aplicadorGraficos.integration.cjs
```

Não há alteração de respostas, migração de dados ou classificação automática de crianças.

## Publicação DEV

Publicado em 20/10/2026 em https://172.17.2.42:5173/admin/aplicador/relatorio-terceira . Apenas backend-dev e frontend-dev foram reconstruídos/recriados, preservando a configuração Compose e os volumes. Conferência: tela HTTP 200, API sem sessão HTTP 401, protocolo V1 no backend ativo, fase 3, 98 crianças. Exemplo conferido: Q1 = 82 SIM (83,7%) e 16 NÃO (16,3%), base 98. Sete testes de backend e os testes existentes de frontend passaram; builds concluídos. Não houve publicação em produção.

## Visualização por item

Cada item Q1–Q9 possui gráfico de pizza à direita do texto, com legenda e percentuais sobre respostas válidas. O gráfico usa as contagens e os percentuais do protocolo, sem recalcular a avaliação. Ausências ficam no texto de cobertura; sem respostas válidas, exibe “Sem dados”. No celular, o gráfico passa para baixo do texto. SVG permite impressão/PDF e inclui descrição acessível por item. Categorias pequenas permanecem identificadas na legenda, mesmo quando o percentual não cabe na fatia. Nenhuma alteração nos dados ou nas regras do protocolo.

## Filtro por turma

O relatório permite `escolaId` e `turmaId`. Primeiro seleciona-se a escola, depois uma turma com aplicações registradas na terceira fase. A opção “Todas as turmas” mantém a análise da escola. Trocar de escola limpa a turma. A API valida que a turma pertence à escola e possui aplicações no período; turma sem escola é rejeitada. A regra de uma aplicação por criança é aplicada antes dos filtros. A turma selecionada acompanha o cabeçalho, texto baixado e impressão/PDF, e restringe todos os cálculos e pizzas. Uma turma sem concluídas recebe o estado sem dados. A API não permite trocar o período do protocolo.

A seção “Habilidades demonstradas” apresenta somente a síntese textual. Os gráficos de pizza ficam na análise completa “Resultados por habilidade — Q1 a Q9”, evitando repetição visual.
