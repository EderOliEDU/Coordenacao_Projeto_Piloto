# Questão 2 — cinco vogais

Alteração aprovada para o DEV em 16/10/2026. Cada vogal tem três figuras do material original. SIM exige identificar as duas figuras correspondentes; NÃO representa uma ou nenhuma. Não avaliada corresponde a `NULL`.

A apresentação libera as vogais na ordem A, E, I, O, U após salvar a resposta anterior. Apenas SIM e NÃO estão disponíveis; a API rejeita novas respostas NULL. Os NULL históricos são preservados. Avaliações concluídas mostram as vogais efetivamente respondidas.

| Vogal | Figuras | Correspondentes |
| --- | --- | --- |
| A | abelha, bola, abacaxi | abelha e abacaxi |
| E | estrela, elefante, tênis | estrela e elefante |
| I | casa, ímã, iguana | ímã e iguana |
| O | ovo, gato, orelha | ovo e orelha |
| U | bola, uva, unha | uva e unha |

A imagem original está em `frontend/public/questao2-vogais.jpg`. A tela mostra cada linha por enquadramento CSS, sem modificar a imagem. Origem: arquivo “Imagens Avaliação Aplicador Literação Questão 2.jpeg” fornecido pelo usuário no Drive.

## Dados e compatibilidade

A migração transacional `migracoes-prod/2026-10-16-questao2-vogais.sql` cria `avaliacao_aplicador_vogais`, com chave aplicação/pergunta/vogal. Respostas não apresentadas têm `acertou=NULL`; respondidas têm booleano, origem e data. A origem LEGADO preserva o critério do instrumento anterior e não afirma que as duas figuras foram avaliadas. Novos registros usam NOVO.

Os registros genéricos originais permanecem intactos para auditoria. A Q2 passa a ser lida e calculada exclusivamente pelos detalhes das vogais, evitando duplicidade. O endpoint genérico rejeita gravações da Q2 por clientes antigos e solicita atualizar a página.

Aplicações existentes recebem `versao_instrumento=1`; a criação de aplicações passa a usar o padrão 2. A versão 1 pode concluir com uma vogal avaliada, preservando a regra histórica; a versão 2 exige cinco. Conclusões anteriores não são reabertas. Uma versão não muda ao editar respostas.

O resumo da API e a view `avaliacao_aplicador_vogais_resumo` calculam desempenho como acertos/avaliadas; zero avaliadas resulta em desempenho NULL. Cobertura é avaliadas/5. Exemplo: SIM, NÃO, NULL, NULL, NULL resulta em desempenho 50%, cobertura 40%. Ao compor resultados por habilidades, a Q2 contribui uma única vez com esse desempenho, nunca cinco vezes nem pela resposta genérica histórica.

Salvar vogais, finalizar e liberar reservas usam a mesma trava da aplicação. Uma resposta de vogal não nula impede liberar a reserva. Vogais sem resposta não impedem a liberação de uma aplicação vazia.

## Verificação no DEV

Backup anterior à migração: `out/backups/questao2-20261016/dev-before.dump`, protegido com permissão 0600. Manifesto anterior, ensaio e resultado da aplicação ficam no mesmo diretório. O ensaio encontrou 99 respostas legadas: 66 SIM e 33 NÃO, todas preservadas na vogal registrada. As outras quatro vogais dessas avaliações permanecem NULL.

Executar o build do backend antes de `node --test backend/tests/vogais.integration.cjs`. O teste aplica a migração numa transação externa, usa os endpoints HTTP com PostgreSQL real e reverte todas as fixtures. Valida migração, valores NULL, cobertura/desempenho, regras por versão, autorização e proteção de reservas. Não executar simultaneamente com outros testes que mantenham transações abertas no mesmo banco.

Para testar pela tela: iniciar uma nova avaliação e conferir que apenas A aparece. Responder SIM ou NÃO, conferir a liberação de E e repetir. Recarregar e conferir persistência. Avaliar as cinco antes de finalizar. Abrir uma avaliação antiga concluída e conferir a resposta histórica e a edição bloqueada. Os testes de apresentação ficam em `frontend/tests/vogais.test.cjs`.

Antes de uma futura publicação em produção, fazer backup próprio, executar a migração com `psql -v ON_ERROR_STOP=1`, conceder os privilégios necessários à conta da aplicação nas novas tabela e view e publicar backend/frontend correspondentes. Reverter apenas o código antigo após novas respostas exigiria tratar essas respostas: o formato genérico não representa cinco vogais.
