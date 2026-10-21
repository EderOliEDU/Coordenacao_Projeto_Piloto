# Matriz dos instrumentos e limites de interpretação à luz de Ehri

Data: 19/10/2026. Versão de trabalho 1, para revisão pedagógica. Análise de conteúdo dos enunciados e regras documentadas; não constitui validação psicométrica nem classificação de crianças.

## Proveniência e cobertura

Catálogo de perguntas e opções consultado no banco DEV em transação somente leitura em 19/10/2026. Não foram consultadas respostas, áudios ou dados pessoais. A consulta confirmou 109 perguntas docentes: 58 com escala e 51 sem escala. A rota `backend/src/routes/formularios.ts` omite perguntas sem escala; portanto, sua presença no catálogo não comprova aplicação atual nem ausência de registros históricos. O catálogo DEV não certifica o estado de produção.

O catálogo do aplicador contém oito perguntas ativas; Q9 é o bloco próprio “Leitura de palavras” da interface, com dez palavras documentadas. As regras de Q2 e Q5 vêm de `docs/questao2-vogais.md` e `docs/questao5-consoantes.md`; não foi reexaminado o manual integral nesta etapa. Onde o procedimento não está definido, a interpretação permanece condicional. Q2 mantém o enunciado genérico de aliteração, mas a versão nova documenta cinco vogais avaliadas por figuras. Q5 registra uma consoante, SIM para três ou mais acertos em seis figuras e NÃO para dois ou menos; o banco não preserva o número exato de acertos por figura.

A coluna “habilidade” explicita o construto pretendido ou observável segundo o conteúdo disponível, não afirma que o item o mede com validade demonstrada. As interpretações e cruzamentos são propostas do projeto, não uma rubrica publicada por Ehri. IDs P correspondem ao id_pergunta docente real; IDs Q à ordem do instrumento do aplicador. Itens sem escala são mantidos para rastreabilidade, sem entrar como não dominados em análises atuais.

## Fundamentação e regras de leitura

Ehri (2014, seção “Phases in the development of word reading skills” e Tabela 1) descreve fases sobrepostas, conforme as conexões predominantes entre escrita e fala. Destaca consciência fonêmica, relações grafema–fonema e, na consolidação, unidades grafossilábicas e morfêmicas. Reconhecimento automático de palavras familiares também aparece na fase alfabética completa. Fonte primária consultada: https://doi.org/10.1080/10888438.2013.819356 ; texto: https://ct.thereadingleague.org/wp-content/uploads/sites/39/2021/11/Ehri-2014-Orthographic-Mapping-1.pdf .

Referências para continuidade: Ehri (2005), *Learning to Read Words: Theory, Findings, and Issues*, https://doi.org/10.1207/s1532799xssr0902_4 ; Sargiani, Ehri e Maluf (2022), estudo de instrução de decodificação CV em português brasileiro, https://doi.org/10.1002/rrq.432 . Não se reivindica leitura integral dessas duas referências nesta etapa nem validação dos instrumentos por esses estudos.

Aplicação metodológica proposta: manter separadas consciência lexical, silábica e fonêmica; distinguir conhecimento de letras, combinação para ler, escrita, compreensão, aspectos motores e rotina. Nenhum item isolado determina fase. Não converter PEA ou FLUXO em fases nem somar domínios heterogêneos numa nota de Ehri. Categorias silábicas de escrita de outro referencial não têm conversão automática.

## Matriz completa por pergunta

### Professor — Questionamentos Iniciais

| ID | Pergunta original | Situação / escala | Habilidade observável ou pretendida | Limite da conclusão | Cruzamento |
|---|---|---|---|---|---|
| P1 | PÚBLICO ALVO DA EDUCAÇÃO ESPECIAL? | Com escala no catálogo DEV; SN | Condição educacional registrada | Contexto para apoios e acessibilidade; não mede leitura nem determina fase. | — |
| P2 | EM ESTUDO DE CASO? | Com escala no catálogo DEV; SN | Situação de acompanhamento educacional | Não mede desempenho nem confirma diagnóstico ou fase. | — |
| P3 | Segue o Fluxo? | Com escala no catálogo DEV; FLUXO | Acompanhamento global das propostas e mediação necessária | Fluxo é amplo e contextual; não converter SF/SFP/NSF em fases. | — |

### Professor — Linguagem – Oralidade e Leitura

| ID | Pergunta original | Situação / escala | Habilidade observável ou pretendida | Limite da conclusão | Cruzamento |
|---|---|---|---|---|---|
| P4 | Identifica rimas? | Com escala no catálogo DEV; PEA | Identificação de semelhanças sonoras finais (rimas) | Não comprova segmentação fonêmica, decodificação ou fase. | Q1 |
| P5 | Identifica aliterações? | Com escala no catálogo DEV; PEA | Identificação de recorrências sonoras iniciais | Unidade sonora e materiais precisam ser conhecidos; não comprova análise de todos os fonemas. | Q2 (parcial) |
| P6 | A criança compreende que uma frase possui espaços separando as palavras? | Com escala no catálogo DEV; PEA | Conhecimento dos espaços como separadores na escrita | Não equivale a contar palavras oralmente; exige contato com frase escrita. | Q3 (complementar) |
| P7 | Identifica o som inicial das palavras? | Com escala no catálogo DEV; PEA | Identificação de unidade sonora inicial | “Som” pode significar fonema ou sílaba; registrar tarefa antes de inferir consciência fonêmica. | Q2/Q5 (parcial) |
| P8 | Identifica o som final das palavras? | Com escala no catálogo DEV; PEA | Identificação de unidade sonora final | Não confundir fonema, sílaba final e rima; enunciado não define unidade. | — |
| P9 | Identifica o som medial das palavras? | Com escala no catálogo DEV; PEA | Identificação de unidade sonora medial | Posição e unidade precisam ser definidas; não demonstra segmentação completa. | — |
| P10 | Reconhece as letras das vogais? | Sem escala; não exibida no fluxo atual; — | Reconhecimento visual de letras vocálicas | Reconhecer forma ou nome não comprova conhecer som. | — |
| P11 | Reconhece os sons das vogais? | Com escala no catálogo DEV; PEA | Conhecimento dos sons vocálicos; se houver letra apresentada, relação grafema–fonema | Confirmar estímulo visual e pronúncias aceitas; não generalizar a consoantes. | Q2 (parcial) |
| P12 | Realiza encontros vocálicos VV? | Com escala no catálogo DEV; PEA | Possível combinação de sequências de duas vogais | “Realiza” não distingue leitura, escrita ou repetição oral; definir procedimento. | Q9: PAI/BOI (parcial) |
| P13 | Realiza encontros vocálicos VVV? | Sem escala; não exibida no fluxo atual; — | Possível combinação de sequências de três vogais | Modalidade e tarefa indefinidas; não atribuir decodificação pelo enunciado. | — |
| P14 | Realiza encontros vocálicos VVVV? | Sem escala; não exibida no fluxo atual; — | Possível combinação de sequências de quatro vogais | Modalidade e tarefa indefinidas; não atribuir fase pelo comprimento. | — |
| P15 | Reconhece os sons das letras do alfabeto (maiúsculas)? | Com escala no catálogo DEV; PEA | Correspondências entre letras maiúsculas e sons | Amostra de letras e acertos precisam ser registrados; reconhecer som isolado não demonstra combinar sons. | Q5 (parcial) |
| P16 | Reconhece o nome das letras do alfabeto (maiúsculas)? | Sem escala; não exibida no fluxo atual; — | Nomeação de letras maiúsculas | Nome da letra não equivale a produção do fonema ou leitura. | — |
| P17 | Diferencia letras de números e outros símbolos? | Com escala no catálogo DEV; PEA | Discriminação de letras, números e outros símbolos | Conhecimento gráfico; não comprova relação letra–som. | Q6 (parcial) |
| P18 | Realiza a junção de CV? Com apoio! | Sem escala; não exibida no fluxo atual; — | Combinação CV com mediação, se tarefa de leitura | Descrever apoio e presença de escrita; desempenho mediado não demonstra autonomia. | Q9 (complementar) |
| P19 | Realiza a junção CV? | Com escala no catálogo DEV; PEA | Combinação CV; leitura apenas se houver estímulo escrito | Definir autonomia e modalidade; não generalizar a palavras ou estruturas complexas. | Q9 (complementar) |
| P20 | Realiza a junção de VCV? Com apoio! | Sem escala; não exibida no fluxo atual; — | Combinação VCV com mediação, se tarefa de leitura | Registrar apoio e estímulo; não demonstra leitura independente. | Q9: UVA/EMA (parcial) |
| P21 | Realiza a junção de VCV? | Sem escala; não exibida no fluxo atual; — | Combinação VCV, se tarefa de leitura | Confirmar modalidade, apoio e itens; não comprova automaticidade. | Q9: UVA/EMA (parcial) |
| P22 | Realiza a junção de CVCV? Com apoio! | Sem escala; não exibida no fluxo atual; — | Combinação CVCV com mediação, se tarefa de leitura | Pistas podem permitir resposta sem decodificação independente. | Q9: FITA/BULE/GALO/POTE (parcial) |
| P23 | Realiza a junção de CVCV? | Sem escala; não exibida no fluxo atual; — | Combinação CVCV, se tarefa de leitura | Confirmar estímulo e apoio; acerto isolado não prova generalização. | Q9: FITA/BULE/GALO/POTE (parcial) |
| P24 | Consegue separar sílabas oralmente? | Com escala no catálogo DEV; PEA | Segmentação oral em sílabas | Não equivale a segmentar fonemas nem a ler sílabas escritas. | Q4 (parcial) |
| P25 | Consegue separar sílabas? | Sem escala; não exibida no fluxo atual; — | Possível segmentação silábica | Enunciado não define se oral ou escrita; esclarecer antes de comparar. | Q4 (condicional) |
| P26 | Consegue juntar sílabas oralmente? | Sem escala; não exibida no fluxo atual; — | Síntese oral de sílabas | Não comprova síntese fonêmica ou leitura de palavra escrita. | — |
| P27 | Consegue juntar sílabas? | Sem escala; não exibida no fluxo atual; — | Possível síntese de sílabas | Modalidade indefinida; não inferir leitura ou consolidação. | — |
| P28 | Consegue diferenciar P, B e D? | Com escala no catálogo DEV; PEA | Possível discriminação de P, B e D | Pode avaliar forma, nome, som ou articulação; mistura contrastes e exige tarefa explícita. | Q5 (parcial) |
| P29 | Consegue diferenciar F e V? | Com escala no catálogo DEV; PEA | Possível discriminação de F e V | Distinguir contraste gráfico de contraste sonoro; não inferir causa clínica de erro. | Q5 (parcial) |
| P30 | Consegue diferenciar T e D? | Com escala no catálogo DEV; PEA | Possível discriminação de T e D | Distinguir contraste gráfico de contraste sonoro; não inferir causa clínica de erro. | Q5 (parcial) |

### Professor — Linguagem – Escrita

| ID | Pergunta original | Situação / escala | Habilidade observável ou pretendida | Limite da conclusão | Cruzamento |
|---|---|---|---|---|---|
| P31 | Apresenta coordenação motora fina ao recortar? | Com escala no catálogo DEV; PEA | Coordenação motora no recorte | Não mede relações entre escrita e fala nem fase de Ehri. | — |
| P32 | Apresenta coordenação motora fina ao desenhar? | Com escala no catálogo DEV; PEA | Controle motor no desenho | Não mede conhecimento alfabético. | — |
| P33 | Desenha com vários elementos? | Com escala no catálogo DEV; PEA | Variedade de elementos na produção gráfica | Desenho não demonstra codificação fonológica. | — |
| P34 | Centraliza o desenho? | Com escala no catálogo DEV; PEA | Organização espacial do desenho | Centralização não determina competência de leitura ou escrita alfabética. | — |
| P35 | Usa todo espaço para desenhar? | Com escala no catálogo DEV; PEA | Ocupação espacial no desenho | Uso do espaço depende da proposta; não determina fase. | — |
| P36 | Apresenta coordenação motora fina ao escrever? | Com escala no catálogo DEV; PEA | Execução motora da escrita | Separar controle do traço de conhecimento das correspondências letra–som. | Q8 (contexto) |
| P37 | Escreve o próprio nome com apoio do crachá? | Com escala no catálogo DEV; PEA | Reprodução do nome com modelo visual | Cópia pode ocorrer sem análise dos sons; registrar tipo de apoio. | Q7: COM_APOIO (parcial) |
| P38 | Escreve o próprio nome sem apoio? | Sem escala; não exibida no fluxo atual; — | Produção do nome sem modelo | Sequência familiar pode ser memorizada; não generalizar a palavras novas. | Q7: SEM_APOIO (parcial) |
| P39 | Escreve o nome composto com apoio do crachá? | Sem escala; não exibida no fluxo atual; — | Reprodução de nome composto com modelo | Complexidade e familiaridade variam; cópia não prova codificação fonológica. | Q7 (parcial) |
| P40 | Escreve o nome composto sem apoio? | Sem escala; não exibida no fluxo atual; — | Produção de nome composto sem modelo | Não generalizar de sequência conhecida ao sistema alfabético. | Q7 (parcial) |
| P41 | Escreve o nome completo com apoio do crachá? | Sem escala; não exibida no fluxo atual; — | Reprodução do nome completo com modelo | Apoio e extensão variam; não mede fase por si. | Q7 (parcial) |
| P42 | Escreve o nome completo sem apoio? | Com escala no catálogo DEV; PEA | Produção do nome completo sem modelo | Memória de sequência familiar não demonstra escrita produtiva de palavras novas. | Q7 (parcial) |
| P43 | Escreve as vogais? | Sem escala; não exibida no fluxo atual; — | Produção gráfica de vogais | Cópia, ditado de letra e ditado de som medem aspectos diferentes. | Q8 (complementar) |
| P44 | Escreve as consoantes? | Sem escala; não exibida no fluxo atual; — | Produção gráfica de consoantes | Sem saber o comando não se infere codificação fonológica. | Q8 (complementar) |
| P45 | Escreve com apoio de linhas? | Sem escala; não exibida no fluxo atual; — | Organização gráfica com linhas | Não mede correspondência grafema–fonema. | — |
| P46 | Escreve com apoio de linhas paralelas? | Sem escala; não exibida no fluxo atual; — | Organização gráfica com linhas paralelas | Apoio espacial não determina fase de leitura. | — |
| P47 | Escreve no caderno? | Com escala no catálogo DEV; PEA | Realização de escrita no suporte caderno | Não informa se copia ou escreve por análise sonora; não determina fase. | — |
| P48 | Respeita as margens do caderno? | Sem escala; não exibida no fluxo atual; — | Organização espacial nas margens | Não mede leitura de palavras ou codificação fonológica. | — |
| P49 | Escreve em 3 linhas? | Sem escala; não exibida no fluxo atual; — | Organização gráfica em três linhas | Confirmar significado de “3 linhas”; não mede fase. | — |
| P50 | Escreve em linhas paralelas? | Sem escala; não exibida no fluxo atual; — | Organização gráfica em linhas paralelas | Não mede conhecimento alfabético. | — |
| P51 | Utiliza espaço entre as palavras? | Com escala no catálogo DEV; PEA | Segmentação gráfica entre palavras | Pode decorrer de cópia; não comprova análise fonêmica nem escrita independente. | Q3 (complementar) |
| P52 | Realiza traçados com controle e direção adequada? | Sem escala; não exibida no fluxo atual; — | Controle e direção do traçado | Aspecto motor; não comprova domínio de letra–som. | — |
| P53 | Escreve da esquerda para direita? | Com escala no catálogo DEV; PEA | Direcionalidade convencional da escrita | Convenção de escrita; não determina decodificação ou fase. | — |
| P54 | Utiliza letra bastão? | Sem escala; não exibida no fluxo atual; — | Uso de determinado tipo de letra | Tipo gráfico não determina conhecimento alfabético. | — |
| P55 | Apresenta escrita no nível silábico? | Sem escala; não exibida no fluxo atual; — | Julgamento de escrita como “silábica” | Categoria de outro referencial; exige produção e critério explícito, sem equivalência automática com fase de Ehri. | Q8 (complementar, sem conversão) |

### Professor — Linguagem – Compreensão Leitora

| ID | Pergunta original | Situação / escala | Habilidade observável ou pretendida | Limite da conclusão | Cruzamento |
|---|---|---|---|---|---|
| P105 | Compreende o que foi lido/ouvido? | Com escala no catálogo DEV; PEA | Compreensão de conteúdo lido ou ouvido | Separar escuta de leitura própria; escuta não comprova decodificação. | — |
| P106 | Identifica personagens da história? | Com escala no catálogo DEV; PEA | Identificação de personagens | Depende da modalidade e da história; não determina leitura independente. | — |
| P107 | Reconhece início, meio e fim da narrativa? | Com escala no catálogo DEV; PEA | Reconhecimento da estrutura narrativa | Não determina fase de leitura de palavras. | — |
| P108 | Relata sequência dos acontecimentos? | Com escala no catálogo DEV; PEA | Relato da sequência narrativa | Envolve compreensão, memória e expressão oral; não isola decodificação. | — |
| P109 | Identifica o local onde a história acontece? | Com escala no catálogo DEV; PEA | Identificação do cenário da história | Depende de escuta/leitura e pistas; não determina fase de Ehri. | — |

### Professor — Matemática

| ID | Pergunta original | Situação / escala | Habilidade observável ou pretendida | Limite da conclusão | Cruzamento |
|---|---|---|---|---|---|
| P56 | Compara objetos por cor, tamanho e forma? | Com escala no catálogo DEV; PEA | Comparação de atributos perceptivos | Domínio matemático; fora da classificação de fases de leitura. | — |
| P57 | Utiliza termos como maior/menor, igual/diferente? | Com escala no catálogo DEV; PEA | Uso de termos comparativos | Vocabulário relacional; não mede fase de leitura. | — |
| P58 | Consegue classificar objetos por categorias? | Sem escala; não exibida no fluxo atual; — | Classificação por categorias | Não mede conhecimento alfabético. | — |
| P59 | Relaciona objetos por semelhança? | Sem escala; não exibida no fluxo atual; — | Relações de semelhança | Não mede fase de leitura. | — |
| P60 | Realiza pareamento por cor, forma ou função? | Sem escala; não exibida no fluxo atual; — | Pareamento por atributos ou função | Não demonstra correspondências grafema–fonema. | — |
| P61 | Agrupa objetos por características? | Sem escala; não exibida no fluxo atual; — | Agrupamento por características | Não mede fase de leitura. | — |
| P62 | Explica o critério utilizado na classificação? | Sem escala; não exibida no fluxo atual; — | Explicitação de critério classificatório | Linguagem e classificação; não mede leitura de palavras. | — |
| P63 | Organiza objetos em sequência (maior para menor, por exemplo)? | Sem escala; não exibida no fluxo atual; — | Seriação de objetos | Não mede fase de leitura. | — |
| P64 | Segue uma regra de ordenação? | Sem escala; não exibida no fluxo atual; — | Aplicação de regra de ordenação | Não mede leitura ou escrita alfabética. | — |
| P65 | Reconhece padrões? | Sem escala; não exibida no fluxo atual; — | Reconhecimento de padrões | Padrão matemático não equivale a padrão ortográfico. | — |
| P66 | Consegue completar sequências? | Com escala no catálogo DEV; PEA | Completamento de sequências | Não generalizar a consolidação ortográfica. | — |
| P67 | Cria padrões simples? | Sem escala; não exibida no fluxo atual; — | Criação de padrões | Não mede padrões grafossilábicos ou morfêmicos por si. | — |
| P68 | Recita números de 1 a 10 no mínimo? | Com escala no catálogo DEV; PEA | Recitação da sequência numérica | Recitar não comprova cardinalidade nem leitura. | — |
| P69 | Conta objetos corretamente? | Sem escala; não exibida no fluxo atual; — | Contagem de objetos | Conferir correspondência um a um; fora das fases de leitura. | — |
| P70 | Relaciona número à quantidade? | Com escala no catálogo DEV; PEA | Associação numeral–quantidade | Não equivale a correspondência letra–som. | — |
| P71 | Inicia contagem a partir de outro número? | Sem escala; não exibida no fluxo atual; — | Continuação da sequência numérica | Não mede fase de leitura. | — |
| P72 | Compreende que o último número indica a quantidade total? | Sem escala; não exibida no fluxo atual; — | Princípio de cardinalidade | Não mede conhecimento alfabético. | — |
| P73 | Compara quantidades (mais/menos)? | Sem escala; não exibida no fluxo atual; — | Comparação de quantidades | Não mede fase de leitura. | — |
| P74 | Reconhece quantidades sem contar (pequenos números)? | Com escala no catálogo DEV; PEA | Reconhecimento imediato de pequenas quantidades | Não equivale a reconhecimento automático de palavras. | — |
| P75 | Percebe que a quantidade não muda com a posição? | Sem escala; não exibida no fluxo atual; — | Invariância de quantidade diante de rearranjo espacial | Não mede fase de leitura. | — |
| P76 | Reconhece números de 0 a 10 no mínimo? | Com escala no catálogo DEV; PEA | Reconhecimento de numerais | Reconhecimento de símbolos numéricos não demonstra leitura alfabética. | — |
| P77 | Escreve números até 9? | Sem escala; não exibida no fluxo atual; — | Produção gráfica de numerais até 9 | Não demonstra escrita alfabética. | — |
| P78 | Inicia a escrita até 15? | Sem escala; não exibida no fluxo atual; — | Possível escrita de sequência numérica até 15 | Enunciado omite objeto explícito; confirmar comando. Não mede fase de leitura. | — |
| P79 | Ordena números em sequência crescente? | Sem escala; não exibida no fluxo atual; — | Ordenação crescente de numerais | Não mede fase de leitura. | — |
| P80 | Ordena objetos por quantidade? | Sem escala; não exibida no fluxo atual; — | Ordenação por quantidade | Não mede conhecimento alfabético. | — |
| P81 | Reconhece formas geométricas básicas? | Com escala no catálogo DEV; PEA | Reconhecimento de formas geométricas | Não mede fase de leitura. | — |
| P82 | Nomeia círculo, quadrado, triângulo e retângulo, no mínimo? | Sem escala; não exibida no fluxo atual; — | Nomeação de formas geométricas | Vocabulário geométrico não comprova leitura dos nomes. | — |
| P83 | Identifica formas no ambiente? | Sem escala; não exibida no fluxo atual; — | Identificação de formas no ambiente | Não mede fase de leitura. | — |
| P84 | Utiliza formas para criar figuras? | Sem escala; não exibida no fluxo atual; — | Composição de figuras com formas | Não mede fase de leitura. | — |
| P85 | Compreende posições (dentro/fora, em cima/embaixo)? | Com escala no catálogo DEV; PEA | Compreensão de relações espaciais | Não determina conhecimento das correspondências letra–som. | — |
| P86 | Identifica o que vem antes e depois? | Com escala no catálogo DEV; PEA | Identificação de relações de anterioridade e posterioridade | Contexto temporal, espacial ou numérico precisa ser conhecido; não mede fase. | — |
| P87 | Utiliza linguagem espacial corretamente? (em cima/embaixo, dentro/fora, entre, direita/esquerda...) | Com escala no catálogo DEV; PEA | Uso de linguagem espacial | Vocabulário e orientação; não determina fase de leitura. | — |

### Professor — Senso de Organização

| ID | Pergunta original | Situação / escala | Habilidade observável ou pretendida | Limite da conclusão | Cruzamento |
|---|---|---|---|---|---|
| P88 | Organiza a mochila no lugar destinado na sala? | Com escala no catálogo DEV; PEA | Organização da mochila em local combinado | Rotina e autonomia contextual; não mede leitura. | — |
| P89 | Organiza a mochila na posição orientada? | Sem escala; não exibida no fluxo atual; — | Posicionamento orientado da mochila | Não mede conhecimento alfabético. | — |
| P90 | Organiza o calçado lado a lado no lugar destinado na sala? | Com escala no catálogo DEV; PEA | Organização do calçado em local combinado | Não mede fase de leitura. | — |
| P91 | Organiza as garrafinhas de água no lugar destinado na sala? | Com escala no catálogo DEV; PEA | Organização da garrafa no espaço da sala | Não mede fase de leitura. | — |
| P92 | Organiza as garrafinhas de água no lugar destinado no espaço externo? | Sem escala; não exibida no fluxo atual; — | Organização da garrafa em espaço externo | Não mede fase de leitura. | — |
| P93 | Ao levantar da mesa, coloca a cadeira no lugar? | Sem escala; não exibida no fluxo atual; — | Reposicionamento da cadeira | Não mede fase de leitura. | — |
| P94 | Organiza seus materiais após o uso? | Com escala no catálogo DEV; PEA | Organização dos materiais após uso | Não mede leitura; contextualiza condições de trabalho. | — |
| P95 | Cuida dos seus pertences? | Com escala no catálogo DEV; PEA | Cuidado com pertences | Não mede conhecimento alfabético. | — |
| P96 | Realiza atividades com independência? | Com escala no catálogo DEV; PEA | Independência nas atividades propostas | Dependente da atividade e dos apoios; não equivale a leitura autônoma. | — |
| P97 | Participa da rotina sem necessidade constante de ajuda? | Com escala no catálogo DEV; PEA | Autonomia nas rotinas | Autonomia cotidiana não comprova decodificação. | — |
| P98 | Compreende e respeita combinados da sala? | Com escala no catálogo DEV; PEA | Participação em combinados | Não determina fase de leitura. | — |
| P99 | Ao sair do ambiente, deixa organizado? | Com escala no catálogo DEV; PEA | Organização do ambiente ao sair | Não mede fase de leitura. | — |
| P100 | Nos momentos de saída coletiva, anda? | Sem escala; não exibida no fluxo atual; — | Conduta na saída coletiva, conforme orientação | Enunciado requer explicitação do esperado; não mede leitura. | — |
| P101 | No lanche, senta à mesa? | Com escala no catálogo DEV; PEA | Participação na rotina do lanche | Não mede fase de leitura. | — |
| P102 | No lanche, utiliza os utensílios corretamente? | Com escala no catálogo DEV; PEA | Uso de utensílios | Não mede conhecimento alfabético. | — |
| P103 | No lanche, ao comer tem o cuidado de manter a mesa limpa? | Com escala no catálogo DEV; PEA | Cuidado com limpeza da mesa | Não mede fase de leitura. | — |
| P104 | No lanche, ao comer tem o cuidado de manter o chão limpo? | Com escala no catálogo DEV; PEA | Cuidado com limpeza do chão | Não mede fase de leitura. | — |

### Aplicador — Rimas

| ID | Pergunta original | Situação / escala | Habilidade observável ou pretendida | Limite da conclusão | Cruzamento |
|---|---|---|---|---|---|
| Q1 | A criança identifica rimas? | Ativa no catálogo DEV; SIM/NÃO | Identificação de rimas nas tarefas propostas | SIM/NÃO não informa variedade ou consistência; não comprova consciência fonêmica ou fase. | P4 |

### Aplicador — Aliteração

| ID | Pergunta original | Situação / escala | Habilidade observável ou pretendida | Limite da conclusão | Cruzamento |
|---|---|---|---|---|---|
| Q2 | A criança identifica aliterações das vogais? | Ativa no catálogo DEV; SIM/NÃO | Identificação de figuras cujos nomes compartilham a vogal inicial | Tarefa sonora com figuras não comprova reconhecimento da letra escrita; vocabulário e nomeação das imagens influem. Não generalizar às consoantes. | P5/P7/P11 (parcial) |

### Aplicador — Consciência de palavras

| ID | Pergunta original | Situação / escala | Habilidade observável ou pretendida | Limite da conclusão | Cruzamento |
|---|---|---|---|---|---|
| Q3 | A criança consegue contar/separar oralmente as palavras de uma frase? | Ativa no catálogo DEV; SIM/NÃO | Segmentação lexical oral de frase | Não equivale a reconhecer espaços em texto; contagem exige também resposta numérica. Não demonstra segmentação em fonemas. | P6/P51 (complementar) |

### Aplicador — Consciência silábica

| ID | Pergunta original | Situação / escala | Habilidade observável ou pretendida | Limite da conclusão | Cruzamento |
|---|---|---|---|---|---|
| Q4 | A criança identifica a quantidade de sílabas de uma palavra? | Ativa no catálogo DEV; SIM/NÃO | Segmentação e contagem silábica oral | Contar sílabas não comprova análise fonêmica, decodificação ou uso de unidades consolidadas. | P24 (parcial); P25 sem escala |

### Aplicador — Relação letra-som

| ID | Pergunta original | Situação / escala | Habilidade observável ou pretendida | Limite da conclusão | Cruzamento |
|---|---|---|---|---|---|
| Q5 | A criança identifica o som da consoante? | Ativa no catálogo DEV; SIM/NÃO | Identificação de figuras relacionadas ao som inicial da consoante selecionada, conforme procedimento | Apenas uma consoante e resultado binário: não comprova domínio do alfabeto, produção isolada do som nem combinação para ler. Confirmar apresentação de grafema no manual. | P15/P7 (parcial); P28–P30 apenas se contraste efetivamente testado |

### Aplicador — Letras e números

| ID | Pergunta original | Situação / escala | Habilidade observável ou pretendida | Limite da conclusão | Cruzamento |
|---|---|---|---|---|---|
| Q6 | A criança diferencia letras de números? | Ativa no catálogo DEV; SIM/NÃO | Discriminação de letras e números apresentados | Não comprova nomeação, som das letras ou leitura; conjunto de símbolos mais restrito que P17. | P17 (parcial) |

### Aplicador — Nome

| ID | Pergunta original | Situação / escala | Habilidade observável ou pretendida | Limite da conclusão | Cruzamento |
|---|---|---|---|---|---|
| Q7 | A criança escreve o próprio nome? | Ativa no catálogo DEV; COM_APOIO / SEM_APOIO / NAO_ESCREVE | Produção do próprio nome e dependência de apoio | Apoio não especifica modalidade; sem apoio pode refletir sequência memorizada. Não comprova codificação de palavras novas. | P37/P42 (parcial); P38–P41 sem escala |

### Aplicador — Escrita

| ID | Pergunta original | Situação / escala | Habilidade observável ou pretendida | Limite da conclusão | Cruzamento |
|---|---|---|---|---|---|
| Q8 | A criança realiza a escrita utilizando seus conhecimentos sobre as letras e seus sons? | Ativa no catálogo DEV; Quatro rótulos de fases | Julgamento do aplicador sobre uso de letras e sons na escrita | O banco armazena rótulo de fase, não evidência suficiente para confirmá-la. Descrições misturam leitura e escrita; exigir amostras e rubrica. | Sem item docente ativo equivalente de escrita de palavras; P36/P37/P42 são complementares |

### Aplicador — Leitura de palavras

| ID | Pergunta original | Situação / escala | Habilidade observável ou pretendida | Limite da conclusão | Cruzamento |
|---|---|---|---|---|---|
| Q9 | Leitura de palavras [título da interface; bloco fora do catálogo de perguntas] | Bloco próprio no código e documentação; NAO_UTILIZA_SONS / UTILIZA_ALGUNS_SONS / DECODIFICA / LE_AUTONOMIA / NAO_RESPONDEU | Resultado e estratégia observável por palavra, com áudio quando disponível | Não confirma fase global, automaticidade interna ou compreensão; separar falta de áudio, ausência de resposta e interferência adulta. Não há pseudopalavras ou amostra ampla de estruturas. | P19 (complementar); P12 (parcial); P21/P23 sem escala |

## Q9 — matriz por estímulo documentado

As dez palavras são estímulos da mesma questão; não são dez instrumentos independentes. Estruturas abaixo são descrições ortográficas simples, não um inventário fonológico completo. V = letra vocálica; C = letra consonantal. A familiaridade deve ser verificada, não inferida do comprimento. Confirmar o inventário efetivamente aplicado antes da análise de respostas.

| Palavra | Estrutura escrita | Evidência a examinar | Limite específico |
|---|---|---|---|
| UVA | VCV | Relações letra–som e combinação da sequência | Palavra curta e possivelmente familiar não prova generalização |
| EMA | VCV | Relações letra–som e combinação da sequência | Mesma estrutura de UVA não torna os itens equivalentes em dificuldade |
| FITA | CVCV | Correspondências e combinação até a palavra completa | Acerto não distingue sozinho decodificação de reconhecimento familiar |
| BULE | CVCV | Correspondências e combinação | Considerar pronúncias regionais; não decidir por correspondência literal com transcrição |
| GALO | CVCV | Correspondências e combinação | Não demonstra domínio de G em outros contextos |
| POTE | CVCV | Correspondências e combinação | Considerar variação de vogais e de realização de T na fala brasileira |
| JANELA | CVCVCV | Manutenção e combinação ao longo de três sílabas | Extensão maior não comprova fase consolidada |
| SAPATO | CVCVCV | Sequência, combinação e autocorreções | Silabação audível não comprova consolidação |
| PAI | CVV | Tratamento da sequência vocálica na leitura da palavra | Não confundir duas letras vocálicas com duas sílabas; não generalizar a todos os encontros |
| BOI | CVV | Tratamento da sequência vocálica na leitura da palavra | Palavra curta correta não comprova reconhecimento automático generalizado |

Preservar a marcação original por palavra e a análise revisada separadamente. Não transformar ruído, áudio ausente ou truncado em NAO_RESPONDEU. Não decidir DECODIFICA versus LE_AUTONOMIA apenas por velocidade. Ver detalhamento em `docs/questao9-base-ehri-ia.md`.

## Matriz de correspondência para comparação entre fontes

“Parcial” indica construto relacionado, com tarefas ou abrangência diferentes; “complementar” indica evidência distinta que ajuda a interpretar o perfil. Nenhum par tem equivalência de escore demonstrada.

| Aplicador | Professor com escala atual | Relação e regra de comparação |
|---|---|---|
| Q1 Rimas | P4 | Mesmo domínio pretendido; comparar relatos e tarefas preservando PEA e SIM/NÃO |
| Q2 Vogais por figuras | P5, P7, P11 | Parcial; identificação sonora em figuras não comprova ligação à letra escrita |
| Q3 Palavras de frase oral | P6, P51 | Complementar; segmentação lexical oral, espaços reconhecidos e espaços produzidos são evidências diferentes |
| Q4 Contagem de sílabas | P24 | Parcial; separar oralmente e informar quantidade não são tarefas idênticas |
| Q5 Consoante por figuras | P15, P7 | Parcial; uma consoante não representa o conjunto do alfabeto |
| Q6 Letras e números | P17 | Parcial; P17 inclui outros símbolos |
| Q7 Nome próprio | P37, P42 | Parcial; apoio visual e extensão do nome devem coincidir antes de comparar |
| Q8 Escrita letra–som | Sem equivalente direto atual | P36 é motor e P37/P42 tratam nome; não confirmam codificação de palavras novas |
| Q9 Leitura de palavras | P19; P12 para parte dos estímulos | Complementar/parcial; CV e VV não equivalem a leitura de toda a lista |

## Lacunas e prioridades

1. Consciência fonêmica: P7–P9 não explicitam a unidade sonora. Não há no catálogo do aplicador tarefa explícita de segmentar todos os fonemas e sintetizar fonemas de palavras. Confirmar o manual antes de concluir ausência absoluta de tarefa. Para futura versão, definir tarefas específicas e exemplos de respostas aceitas.
2. Letras e sons: Q5 amostra uma consoante e permite escolha do aplicador. Comparações entre crianças podem refletir letras e dificuldades diferentes. Preservar letra e procedimento; não estimar domínio de todas as consoantes.
3. Decodificação: Q9 usa palavras reais, predominantemente estruturas simples; não isola familiaridade. Eventual ampliação com palavras pouco familiares e pseudopalavras exige elaboração e piloto em português brasileiro, como nova versão, sem reclassificar o histórico.
4. Escrita produtiva: Q8 demanda amostra de escrita, comando, apoio, palavra-alvo e critério por correspondência observada. Rótulos de fases existentes são julgamentos registrados. A descrição pré-alfabética atual (“Não compreende os sons das letras”) é absoluta demais para uma fase predominante; a completa não exige leitura sempre lenta; consolidação não se reduz à rapidez.
5. Compreensão: P105 agrega lido e ouvido. Preservar modalidade para distinguir compreensão oral e de leitura própria. As fases de reconhecimento de palavras não constituem avaliação completa de alfabetização ou compreensão.
6. Escalas docentes: PEA descreve níveis e necessidade de apoio; não presumir distâncias iguais entre categorias. FLUXO contextualiza participação. Relatar distribuições por habilidade antes de propor índices.
7. Integridade histórica: Q2 LEGADO e NOVO não têm o mesmo procedimento. Na regra atual, desempenho = acertos/vogais avaliadas, cobertura = avaliadas/5; zero avaliadas significa desempenho indefinido. Q5 não permite recuperar retroativamente acertos por figura ou certificar uso do critério novo. Usar versão, data e documentação disponíveis; quando insuficientes, declarar comparabilidade desconhecida.
8. Qualidade: separar não aplicado, não respondido, evidência insuficiente, com apoio e tentativa incorreta. Não converter todos em zero. Não imputar respostas aos 51 itens sem escala.

## Protocolo mínimo de uso com os dados coletados

- Parear criança, turma, período, datas reais, versão e habilidade. O campo id_fase do sistema representa etapa/calendário de avaliação, não fase de aprendizagem de Ehri.
- Registrar enunciado, tarefa, estímulo, modalidade, apoio, resposta original e referência à evidência quando existir. Não reconstruir detalhes ausentes a partir do rótulo.
- Comparar por habilidade e registrar: convergência qualitativa, diferença a investigar ou não comparável. Não calcular concordância exata entre PEA e SIM/NÃO mediante conversão arbitrária.
- Para Q9, usar revisão independente de uma amostra de áudios por dois avaliadores, preservando tentativas e pistas adultas e adjudicando diferenças. Concordar com o aplicador não comprova correção.
- Emitir síntese de habilidades demonstradas, em desenvolvimento e sem evidência suficiente. Hipótese de fase exige padrão de evidências e justificativa; não há neste documento pontuação de corte validada.
- Escolher intervenções e reavaliar habilidades específicas; mudanças de tarefa ou apoio devem acompanhar a interpretação de evolução.

## Verificação desta entrega

Cobertura: 109/109 perguntas do catálogo docente, 8/8 perguntas do catálogo do aplicador, bloco Q9 e seus dez estímulos documentados. Enunciados docentes e do aplicador preservados sem reescrita. Não foram alterados código, banco, instrumentos ou respostas. CSV acompanhante contém 118 linhas de perguntas/blocos; os dez estímulos aparecem detalhados neste documento.
