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
- Q7: com apoio, sem apoio e não escreve. Q8: quatro classificações originais de escrita mais NÃO ESCREVEU, descritas como julgamento registrado; sem atribuir uma fase global nova. Percentuais sobre respostas válidas da questão.
- Q9: cinco categorias originais por palavra. Percentuais sobre as classificações registradas da palavra. NAO_RESPONDEU é uma categoria; não equivale à ausência de registro ou áudio. A redação não afirma ter revisado gravações.
- Cada item apresenta base, avaliadas, ausentes, resultados e limite da conclusão. Sem dados: percentual nulo, frase “Não há evidência registrada suficiente para esta habilidade”. Percentuais numéricos arredondados a uma casa decimal; podem somar 99,9% ou 100,1% por arredondamento.

A redação é determinística: a mesma entrada gera o mesmo texto e os mesmos cálculos. O sistema não chama modelo de IA nem envia dados a terceiros para criar os relatórios. A função de cálculo não atribui nota geral, diagnóstico, prontidão ou evolução.

## Estrutura do relatório exportado

1. Identificação do protocolo e versão, recorte, base e data de geração.
2. Regras de cálculo e interpretação.
3. Resultados e limites por item Q1–Q9, incluindo vogais e palavras.
4. Habilidades demonstradas, com quantidade e denominador por tarefa. Com apoio é explicitamente qualificado.
5. Continuidade pedagógica por regras fixas: novas oportunidades no mesmo domínio quando há NÃO; acompanhamento do nome quando com apoio/não escreve; retomada de relações letra–som e combinação nos registros de leitura com uso ausente/parcial dos sons. São orientações gerais para revisão pedagógica, sem diagnóstico causal ou prescrição individualizada.
6. Itens com dados insuficientes, em quantidade e base.
7. Síntese de limites para a transição ao Ensino Fundamental.

O texto completo pode ser baixado em TXT. A tela organizada por tópicos pode ser impressa/salva como PDF pelo navegador. Metadados de protocolo e recorte acompanham a exportação. O relatório não é salvo como registro imutável no banco: baixar o arquivo preserva o resultado daquela geração; nova consulta pode refletir novos dados. Mudanças futuras de regra exigem versionar o protocolo e seus testes.

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

As questões Q1–Q5 mantêm gráficos de pizza individuais na janela de detalhamento. Na tela principal, Q1–Q5 aparecem compiladas em barras; Q6, Q7 e Q8 têm pizzas próprias e Q9 reúne as classificações por palavra, com legenda e percentuais sobre registros válidos. O gráfico usa as contagens e os percentuais do protocolo, sem recalcular a avaliação. Ausências ficam no texto de cobertura; sem respostas válidas, exibe “Sem dados”. No celular, o gráfico passa para baixo do texto. SVG permite impressão/PDF e inclui descrição acessível por item. Categorias pequenas permanecem identificadas na legenda, mesmo quando o percentual não cabe na fatia. Nenhuma alteração nos dados ou nas regras do protocolo.

## Filtro por turma

O relatório permite `escolaId` e `turmaId`. Primeiro seleciona-se a escola, depois uma turma com aplicações registradas na terceira fase. A opção “Todas as turmas” mantém a análise da escola. Trocar de escola limpa a turma. A API valida que a turma pertence à escola e possui aplicações no período; turma sem escola é rejeitada. A regra de uma aplicação por criança é aplicada antes dos filtros. A turma selecionada acompanha o cabeçalho, texto baixado e impressão/PDF, e restringe todos os cálculos e pizzas. Uma turma sem concluídas recebe o estado sem dados. A API não permite trocar o período do protocolo.

A síntese “Habilidades demonstradas” permanece no relatório TXT. A tela principal apresenta os cinco tópicos, evitando repetir a análise de cada item fora de sua seção ou janela de detalhamento.

### Detalhamento da Q7 no relatório

A tabela cruza o tipo de nome registrado (só o nome, nome composto ou nome completo) com a realização com apoio ou sem apoio. Registros sem tipo informado ficam em uma linha própria, sem inferir o tipo de escrita. A quantidade que não escreveu e a ausência de resposta permanecem distintas. O detalhamento acompanha os filtros do relatório e consta também no arquivo de texto e na impressão.


## Interface por tópicos — 06/11/2026

O título “Protocolo de Análise da Terceira Avaliação” aparece antes dos filtros. A tela principal reúne cinco tópicos: Consciência Fonológica (Q1–Q5), Fases da escrita (Q8), Fases da Leitura (Q9), Nome (Q7, gráfico e tabela de tipo/apoio) e Diferenciação Letras × Números (Q6). As regras ficam recolhidas em “Sobre o protocolo e os cálculos”.

Consciência Fonológica apresenta um único gráfico de barras com uma linha por questão, calculada sobre os registros válidos de cada questão. Q2 reúne as cinco vogais; Q5 utiliza somente o resultado geral, sem somar novamente os detalhes por consoante. Ausências continuam separadas. Não se calcula uma nota global a partir dessas bases diferentes.

“Ver questões 1 a 5 separadamente” abre uma janela modal com as análises anteriores, incluindo todas as vogais e consoantes. A janela mantém o recorte de escola/turma, permite fechar pelo botão ou Escape e usa o comportamento de foco do diálogo nativo do navegador.

O gráfico de leitura reúne as classificações registradas por palavra. Seu denominador é o número de registros válidos de leitura, não o número de crianças; uma criança pode contribuir com várias palavras. As classificações originais são preservadas, sem atribuir nova fase global à criança. “Não respondeu” e registro ausente permanecem distintos.

A exportação TXT mantém o relatório completo e suas sínteses. A impressão da tela principal segue os tópicos; com a janela de detalhamento aberta, imprime seu conteúdo. A organização visual não modifica os dados nem as regras do protocolo.

Testes da compilação visual: `node frontend/tests/relatorioTerceira.test.cjs`. Cobrem soma de vogais, exclusão da duplicação de Q5, categorias de leitura, denominadores e ausência de respostas. Os testes existentes do protocolo permanecem válidos.

## Índice complementar TAREFAS-Q1-Q5-V1 — 10/11/2026

Indicador operacional de desempenho nas tarefas Q1–Q5, separado da rubrica descritiva TERCEIRA-AVALIACAO-V1; não é escala validada de consciência fonológica ou classificação de Ehri. Q5 inclui relação letra–som; o título não presume um único construto.

Seleciona a aplicação concluída mais recente de cada criança na fase, antes dos filtros de escola/turma, seguindo o desempate existente. Q1, Q3, Q4 e Q5: SIM=1 e NÃO=0; Q2 (regra atualizada em 17/11/2026): acertos/(TRUE+FALSE), somente vogais com resposta válida; uma vogal válida basta, NULL não é erro e todas NULL resultam em sem dados. A resposta genérica histórica de Q2 não substitui as vogais. Registros duplicados/ambíguos ou ausentes impedem a avaliação completa.

Índice individual = (Q1+Q2+Q3+Q4+Q5)/5*100. Média do recorte = média dos índices completos, sem arredondamento intermediário; apresentação com uma casa decimal. Cada criança e cada questão têm peso igual. Sem completas: média nula, nunca zero. A cobertura informa completas, incompletas e base de crianças com aplicação concluída, não o total de matrículas. Para todas as turmas, agrega crianças diretamente, sem média de médias de turmas. Q6–Q9 e a classificação existente de turmas Q1–Q8 não são modificadas.

A API retorna somente o índice agregado e cobertura. Tela, impressão e TXT incluem o indicador; o detalhamento existente por questão permanece disponível e usa sua própria base de respostas válidas. Nenhuma resposta ou classificação é gravada.

A tela principal apresenta uma única pontuação consolidada de 0 a 100 e cobertura; as barras Q1–Q5 foram retiradas desse bloco. Resultados por questão ficam apenas em “Ver detalhamento”.

## Colunas por escola — 11/11/2026

Consciência Fonológica apresenta a pontuação Q1–Q5 por escola, calculada no mesmo snapshot somente leitura e com a mesma seleção de aplicação por criança. Linhas: média aritmética das pontuações escolares exibidas, máximo e mínimo; escolas sem completas ficam sem pontuação e fora das referências. A média entre escolas tem peso igual por escola e difere do índice coletivo ponderado por crianças. Filtros de escola/turma restringem colunas e referências. A escala é fixa 0–100; cobertura aparece na tabela e título de cada coluna. Sem dados não vira zero. Linhas coincidentes se sobrepõem. Outros painéis preservados.

## Correção de referência e drill-through

A média de referência passa a usar a média das crianças completas do recorte (ponderação pelas completas e precisão sem arredondamento intermediário), substituindo a média simples entre escolas. Maior/menor continuam sendo os extremos das colunas exibidas. Geral: colunas de escolas; clique abre turmas; clique em turma aplica o recorte a todos os painéis. Caminho de navegação e histórico do navegador permitem retornar. Na turma única as referências coincidem, por definição. Ausência não vale zero. Mantida a aplicação mais recente por criança antes de restringir escola/turma.

## Referências globais e painéis de cinco

As linhas usam toda a terceira avaliação do projeto, com as mesmas aplicações únicas e completas: máximo/mínimo de escolas no nível escolar e de todas as turmas no nível de turmas. Média segue peso igual por criança completa. Não dependem de escola, turma ou página selecionada. A consulta global e os resultados locais usam o mesmo snapshot READ ONLY. Paginação de cinco colunas com navegação inferior. Ao abrir turma, o card informa os nomes disponíveis nas atribuições docentes; sem cadastro, mostra “Professora não informada”; múltiplas professoras são preservadas.

Apresentação: escolas ordenadas por pontuação exata decrescente antes da paginação; empate por nome e sem pontuação ao final. Turmas mostram identificação sem turno e nomes das professoras no rótulo da coluna, sem card separado.

## Classificação fixa das turmas do projeto — 12/11/2026

Novo painel independente dos recortes de escola/turma, incluindo todas as turmas com aplicação concluída na terceira avaliação. Mesma seleção de uma aplicação por criança e fórmula Q1–Q5, snapshot somente leitura e referências globais de turmas. Ordenação por pontuação exata decrescente; empate por escola e id da turma; turmas sem completas ficam ao final sem pontuação. Cinco turmas por página, sem drill-through neste painel. Rótulos com escola, turma sem turno e professoras; nenhuma identidade de criança é retornada. Mesmo em recorte local vazio o painel global permanece disponível.

## Dashboard visual — versão nova

A rota /admin/aplicador/relatorio-terceira usa uma nova página inspirada no modelo visual fornecido. A página anterior permanece intacta em /admin/aplicador/relatorio-terceira-old, com a mesma autorização administrativa. O tema azul do menu é restrito à nova rota.

Consciência Fonológica mantém o índice Q1–Q5. Q8, Q9, Nome e Letras × Números apresentam percentuais da categoria selecionada, sem somar categorias em uma pontuação nova. Q9 usa registros por palavra; os demais usam respostas válidas por questão. Ausência e não respondeu/não escreveu permanecem distintas. As referências globais usam a média ponderada pelas bases válidas, máximo e mínimo dos grupos globais. Todas as categorias disponíveis podem ser selecionadas. Paginação de cinco grupos, ordenação decrescente, navegação escola → turma e classificação fixa de turmas preservadas. As novas distribuições agrupam respostas da mesma aplicação única por criança e snapshot READ ONLY do relatório.

## Visão em uma tela

Em desktop (viewport mínimo 1000 × 640), o novo dashboard usa uma grade de 3 colunas × 2 linhas para os cinco domínios e a classificação fixa de turmas. A altura acompanha a área disponível da janela, sem esconder o conteúdo com overflow de página. Paginação compacta Anterior/Próximo mantém cinco grupos por painel. Rótulos abreviados têm nomes completos no tooltip e janela de dados; contexto e metodologia foram movidos para janelas acessíveis, fecháveis por Escape. Em telas menores, mantém fluxo responsivo para preservar legibilidade. Sem mudanças nos cálculos e na página antiga.

## Pizzas nos cinco painéis

Os cinco domínios do dashboard recebem pizzas do mesmo componente ResultadoPizza da página antiga, com as mesmas cores, categorias, denominadores válidos e regra de ausência. As pizzas agregam todo o recorte escola/turma e não só a página de cinco colunas. Escrita, leitura, nome e letras × números mostram todas as categorias. Em Consciência Fonológica, a pizza tem seleção de questão Q1–Q5; Q2 reúne respostas válidas por vogal, sem usar a resposta genérica histórica. Nunca se transforma a pontuação média Q1–Q5 em uma pizza de acertos/erros. Seleção da categoria nas colunas não restringe a distribuição da pizza. Clique/Enter amplia a pizza e mostra legenda completa e cobertura. O painel fixo global de turmas conserva somente as colunas.

## Cabeçalho e critério de Nome — 13/11/2026

A escola selecionada aparece no cabeçalho; ao selecionar turma, aparecem turma e professoras cadastradas. A seleção continua compartilhada entre os cinco domínios e não afeta o painel fixo global. Cada painel com pizza divide a área gráfica útil em 2fr/1fr.

O novo painel Nome usa o critério conjunto SEM_APOIO + NOME_COMPLETO. Coluna = quantidade que atingiu o critério / registros Q7 avaliáveis * 100. A pizza compara esse grupo com os demais resultados avaliáveis. Entram na base registros COM_APOIO/SEM_APOIO com tipo NOME, NOME_COMPOSTO ou NOME_COMPLETO e NAO_ESCREVE. Quem escreveu sem tipo de nome informado fica fora do denominador; não é convertido em erro. A base e a cobertura aparecem nos detalhes. As categorias originais e o relatório antigo são preservados.

A identificação da escola foi movida do cabeçalho geral para uma faixa dentro de cada painel, imediatamente acima das áreas dos gráficos. O painel fixo identifica explicitamente todas as escolas. Os rótulos de turma passam a mostrar o primeiro nome por extenso de cada professora, sem iniciais; nomes completos continuam nos detalhes e tooltip.

## Totais, rótulos de leitura e comparação de Nome

Os indicadores gerais contam crianças distintas atualmente enturmadas em escolas e etapas PJINSTFONI. Avaliadas = cadastradas no projeto com ao menos uma aplicação CONCLUIDA na terceira avaliação; não avaliadas = total menos avaliadas; cobertura = avaliadas/total. A fonte é o cadastro de enturmação atual, no mesmo snapshot READ ONLY. Não entram outras escolas/etapas da rede, duplicações de matrícula ou aplicações não concluídas. Cards globais de total, avaliadas, não avaliadas, escolas e cobertura independem do recorte. Card de pontuação mantém o recorte atual.

Nome já usa proporção de critério atingido por registros avaliáveis, ordenação percentual e média global ponderada por criança. Acrescentam-se quantidades n/denominador sobre as colunas e n na tabela. Exemplo: 15/17=88,2%, 17/22=77,3%; agregado=32/39=82,1%, sem média simples das turmas.

No novo dashboard, categorias Q9 recebem os rótulos de apresentação solicitados: NAO_UTILIZA_SONS → Pré-alfabética; UTILIZA_ALGUNS_SONS → Alfabética parcial; DECODIFICA → Alfabética completa; LE_AUTONOMIA → Alfabética consolidada. NAO_RESPONDEU preservado. Códigos e dados originais, por palavra, e rótulos da versão antiga permanecem. A apresentação não atribui uma fase global validada à criança.

## Auditoria de origem e unidade da leitura

Conferência no DEV: 813 crianças distintas e 44 turmas; zero aplicações em escolas/etapas de outro projeto, zero crianças avaliadas fora do cadastro do projeto e zero duplicações por aplicação/palavra. Q9: 8.130 registros (813 crianças × 10 palavras), dos quais 4.547 UTILIZA_ALGUNS_SONS, apresentados como Alfabética parcial (55,9%). Não são 4.547 crianças. Uma criança pode contribuir com categorias diferentes em palavras diferentes.

As consultas-base, catálogos de escolas/turmas e cobertura passam a exigir explicitamente escola.projeto e etapa.projeto = PJINSTFONI. A interface de leitura identifica quantidades como leituras por palavra, incluindo legendas, tooltip e detalhes; não altera contagens para criar uma classificação global por criança.


### Agrupamentos no dashboard
O seletor Todos / 4º / 5º agrupamento usa o identificador da etapa da turma (4 e 5). Restringe colunas, pizzas, referências e índice composto, sem alterar respostas. Os indicadores de cadastro/cobertura usam crianças distintas enturmadas no agrupamento e aplicações concluídas na terceira fase. A seleção de agrupamento limpa escola/turma e reinicia a paginação. A seleção de escola/turma continua sem restringir o comparativo geral das turmas dentro do agrupamento.
O sexto painel apresenta o índice composto existente em colunas, cinco por página e em ordem decrescente. Média aritmética entre turmas classificadas, extremos entre as mesmas turmas. Os componentes e a metodologia permanecem em diálogo. Turmas sem algum componente não recebem zero nem entram nas referências.
Na verificação DEV de 13/11/2026: 4º = 875 cadastradas e 0 concluídas; 5º = 948 cadastradas e 813 concluídas. O agrupamento sem avaliações apresenta ausência de dados.
