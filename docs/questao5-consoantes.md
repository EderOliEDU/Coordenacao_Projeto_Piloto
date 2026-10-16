# Questão 5 — figuras por consoante

Melhoria solicitada em 16/10/2026 para o DEV. Ao selecionar uma consoante, a tela exibe a respectiva página do arquivo ALFABETO.pdf fornecido pelo usuário. O PDF tem quinze páginas na ordem B, C, D, F, J, L, M, N, P, R, S, T, V, X, Z; cada página contém seis figuras.

É exigida apenas uma consoante por avaliação, escolhida pelo aplicador, e uma única resposta SIM/NÃO sobre suas seis figuras.

Os arquivos em `frontend/public/questao5-consoantes/` são renderizações JPEG das páginas originais, geradas com `pdftoppm -jpeg -jpegopt quality=88 -scale-to 1600`. O componente gira a página 90 graus para leitura, sem recriar as figuras.

As opções mostram explicitamente:

- SIM — Acertou 3 ou mais figuras.
- NÃO — Acertou 2 ou menos figuras.

A decisão é registrada pelo aplicador. A questão continua armazenando uma consoante e o ID da opção SIM/NÃO no formato existente. Esta mudança não converte respostas antigas nem afirma que elas foram coletadas usando o novo critério.

Trocar a consoante remove a seleção de resposta da tela e exige registrar um novo SIM/NÃO. A consoante e a resposta só são enviadas juntas após essa nova escolha. Recarregar antes de responder recupera o último par efetivamente salvo, sem transferir automaticamente a avaliação para outra consoante. Repetir a escolha da mesma letra preserva a resposta atual.

Validação: build do frontend; `node frontend/tests/consoantes.test.cjs`; conferência das quinze páginas, critérios e bloqueios; teste integrado de salvamento da Q5 com SIM/NÃO e respectiva consoante, com rollback das fixtures no DEV.
