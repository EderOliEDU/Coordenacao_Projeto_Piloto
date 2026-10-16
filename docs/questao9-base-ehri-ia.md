# Questão 9 — base bibliográfica e proposta de avaliação por IA

Data: 16/10/2026. Status: proposta para discussão e validação pedagógica; não implementada nem validada em áudios. Revisão dirigida de trabalhos centrais, não revisão sistemática de toda a produção de Ehri.

## Escopo e fontes

Objetivo: avaliar a estratégia de leitura registrada em cada áudio e comparar com a classificação do aplicador. O manual local é a regra operacional; a teoria ajuda a interpretar evidências e explicitar limites. Instruções de ensino presentes nos artigos não autorizam oferecer pistas durante a avaliação.

Manual consultado: Manual da Aplicadora, questão 9, páginas impressas 3–4. Palavras: UVA, EMA, FITA, BULE, GALO, POTE, JANELA, SAPATO, PAI, BOI. Confirmar versão do manual e inventário efetivo antes da implantação.

Bibliografia selecionada e alcance da consulta:

1. Ehri, L. C. (1995). Phases of development in learning to read words by sight. Journal of Research in Reading, 18(2), 116–125. Referência fundadora das fases; metadados consultados, sem leitura integral nesta revisão. https://doi.org/10.1111/j.1467-9817.1995.tb00077.x
2. Ehri, L. C. (2005). Learning to Read Words: Theory, Findings, and Issues. Scientific Studies of Reading, 9(2), 167–188. Resumo consultado: distinção entre estratégias para palavras desconhecidas e reconhecimento de palavras familiares. https://doi.org/10.1207/s1532799xssr0902_4
3. Ehri, L. C. (2014). Orthographic Mapping in the Acquisition of Sight Word Reading, Spelling Memory, and Vocabulary Learning. Scientific Studies of Reading, 18(1), 5–21. Texto consultado, especialmente seção das fases: reconhecimento automático já pode ocorrer na fase alfabética completa; consolidação envolve unidades maiores. https://doi.org/10.1080/10888438.2013.819356 — cópia: https://ct.thereadingleague.org/wp-content/uploads/sites/39/2021/11/Ehri-2014-Orthographic-Mapping-1.pdf
4. Ehri, L. C. (2020). The Science of Learning to Read Words: A Case for Systematic Phonics Instruction. Reading Research Quarterly, 55(S1), S45–S60. Texto consultado: sobreposição das fases, predominância das conexões e pesquisas em português. https://doi.org/10.1002/rrq.334
5. Gonzalez-Frey, S. M., & Ehri, L. C. (2021; publicação online em 2020). Connected Phonation is More Effective than Segmented Phonation for Teaching Beginning Readers to Decode Unfamiliar Words. Scientific Studies of Reading, 25(3), 272–285. Resumo consultado: decodificação também ocorre com fonação contínua. https://doi.org/10.1080/10888438.2020.1776290
6. Sargiani, R. A., Ehri, L. C., & Maluf, M. R. Orthographic mapping instruction to facilitate reading and spelling in Brazilian emergent readers. Publicação online em 2018. Resumo consultado: estudo com crianças brasileiras, comparando unidades fonêmicas e silábicas na instrução. https://doi.org/10.1017/S0142716418000371
7. Sargiani, R. A., Ehri, L. C., & Maluf, M. R. (2022; publicação online em 2021). Teaching Beginners to Decode Consonant–Vowel Syllables Using Grapheme–Phoneme Subunits Facilitates Reading and Spelling as Compared With Teaching Whole-Syllable Decoding. Reading Research Quarterly, 57(2), 629–648. Resumo consultado: experimento com 60 crianças brasileiras. Não é validação da nossa rubrica nem de IA. https://doi.org/10.1002/rrq.432

## Consequências conceituais

- Mapeamento ortográfico conecta grafia e pronúncia na memória, com associações de significado; não equivale a decorar a aparência visual da palavra. Não é um processo diretamente observável em um áudio isolado.
- Fases descrevem padrões predominantes de conhecimento, com sobreposição. Classificação de uma tentativa não determina, sozinha, fase global da criança.
- Na fase alfabética completa já pode haver reconhecimento automático de palavras conhecidas (Ehri, 2014). Portanto, `LE_AUTONOMIA` não comprova fase consolidada.
- Consolidação envolve unidades recorrentes maiores, incluindo sílabas e morfemas. Silabação audível isolada também não comprova consolidação.
- A bibliografia sustenta constructos de aprendizagem, não limiares de segundos, probabilidades de IA ou regras acústicas prontas para estas dez palavras.
- Estudos de instrução em português fortalecem a pertinência da base teórica, mas não validam automaticamente o instrumento ou um classificador de áudio.

O manual associa as quatro categorias a fases. Proposta: preservar suas categorias por palavra e apresentar eventual síntese das fases como associação pedagógica do instrumento, com limites explícitos, sem equivalência diagnóstica automática.

## Rubrica operacional proposta

Regras abaixo são adaptação do manual para especificação, não um algoritmo publicado por Ehri.

| Código existente | Evidência necessária | Limite |
|---|---|---|
| NAO_UTILIZA_SONS | Tentativa interpretável sem relação letra–som consistente demonstrada | Um erro ou resposta curta não basta para concluir ausência de uso funcional; ambiguidade exige revisão |
| UTILIZA_ALGUNS_SONS | Correspondências parciais identificáveis sem chegar à palavra completa | Dizer nomes de letras deve ser registrado separadamente de produzir sons; não contar letras nomeadas como fonemas dominados |
| DECODIFICA | Chega à palavra completa usando relações letra–som, por segmentação, combinação ou fonação contínua observável | Pausas não são obrigatórias; leitura lenta correta pode pertencer aqui |
| LE_AUTONOMIA | Palavra correta sem montagem explícita observável, em registro suficiente para julgar | Ausência de segmentação audível não prova processamento automático interno; encaminhar casos ambíguos |
| NAO_RESPONDEU | Ausência de tentativa ou recusa em oportunidade documentada de resposta | Silêncio curto, áudio ausente ou arquivo vazio não comprovam ausência de resposta |

Não decidir pela velocidade. Não usar um limite fixo de latência para separar decodificação e autonomia. A latência só é mensurável com marco documentado de apresentação da palavra; início do arquivo não é necessariamente esse marco.

## Entradas, evidências e saída

Entradas mínimas: áudio original, palavra efetivamente exibida, identificadores pseudonimizados, versão do manual/rubrica, informação sobre integridade da gravação. Metadados opcionais: marco de apresentação, contexto de aplicação e observações autorizadas do aplicador.

A análise inicial deve receber áudio e palavra, sem a classificação do aplicador, para reduzir ancoragem. Comparar com a marcação humana em etapa posterior.

Registrar separadamente:

- Qualidade: voz infantil identificável, truncamento, ruído, sobreposição e suficiência do registro.
- Sequência ouvida: preservar tentativas, sons, sílabas, pausas e autocorreções; não normalizar tudo para a palavra esperada.
- Resultado: chegou à palavra completa, não chegou ou indeterminado.
- Estratégia: segmentação, combinação, fonação contínua, nomeação de letras, leitura sem montagem explícita ou indeterminada.
- Intervenção adulta: fala relevante observada e seu momento; distinguir comando neutro de fornecimento de som/sílaba/palavra. Ausência de pista no arquivo não garante ausência fora dele.
- Evidências: intervalos temporais e descrição verificável; não inventar transcrições ou tempos.

Saída sugerida:

```json
{
  "palavra": "SAPATO",
  "rubricaVersao": "q9-proposta-1",
  "statusAnalise": "CLASSIFICAVEL",
  "classificacaoIA": "DECODIFICA",
  "evidencias": [],
  "chegouPalavraCompleta": true,
  "estrategiaObservada": ["SEGMENTACAO_SILABICA", "COMBINACAO"],
  "intervencaoAdulta": "NAO_OBSERVADA",
  "limitacoes": [],
  "comparacaoAplicador": "DIVERGENTE",
  "revisaoHumana": true
}
```

Exemplo de formato, não resultado real. Evidências devem ser preenchidas a partir do áudio. `statusAnalise` deve também admitir `INCONCLUSIVO` e `APLICACAO_COMPROMETIDA`; nesses casos, `classificacaoIA` pode ser nula. Esses estados não são novas categorias pedagógicas. Quando não for possível comparar, usar `NAO_COMPARAVEL`, sem forçar concordância/divergência.

Não exibir percentual de confiança como probabilidade de acerto antes de calibração independente. Registrar versões do modelo, instruções e rubrica para auditoria. Preservar classificação original, sugestão e decisão revisada em campos distintos.

## Casos a discutir com a equipe pedagógica

Exemplos construídos, sem validação em gravações:

- SAPATO: “sa… pa… to… sapato”, sem pista adulta → evidência de DECODIFICA.
- SAPATO: “s… sa…” e encerra sem completar → possível UTILIZA_ALGUNS_SONS, se o áudio demonstrar correspondência.
- SAPATO lido corretamente, sem montagem audível → candidato a LE_AUTONOMIA; não determina fase global.
- Apenas palavra final após silêncio longo → pode não permitir separar decodificação silenciosa e reconhecimento automático.
- Palavra correta após adulto fornecer primeiro som → marcar comprometimento da aplicação e revisar, em vez de atribuir autonomia.
- Arquivo silencioso ou cortado → INCONCLUSIVO, sem converter automaticamente para NAO_RESPONDEU.
- Autocorreção espontânea dentro da primeira tentativa → preservar toda a sequência; definir com a equipe como delimitar tentativa, repetição e reinício.
- Tentativa relacionada aos sons, mas com erro final → não equivale automaticamente a adivinhação.

Definir um inventário de pronúncias aceitas em português brasileiro, revisado por especialista, antes de pontuar erros. Separar variação linguística, possíveis particularidades de fala e evidência de leitura. A IA não deve atribuir causa clínica a uma produção sonora. Tempos, distância fonética ou similaridade de transcrição podem apoiar descrição, mas não substituem a rubrica.

## Preparação e validação

1. Fechar rubrica com equipe pedagógica, incluindo ambiguidade, autocorreção, letra versus som e intervenção adulta.
2. Construir amostra de áudios reais cobrindo todas as palavras, categorias e condições de gravação. Fazer duas avaliações independentes, inicialmente sem acesso à marcação original; adjudicar divergências.
3. Separar desenvolvimento, calibração e teste por criança; evitar que gravações da mesma criança apareçam em treino e teste. Avaliar também generalização entre escolas/aplicadores quando possível.
4. Medir matriz de confusão, precisão e sensibilidade por categoria, concordância com referência, taxa de inconclusivos e cobertura de classificação. Dar atenção à confusão DECODIFICA × LE_AUTONOMIA. Não interpretar concordância com o aplicador como prova de correção.
5. Analisar resultados por palavra, qualidade de áudio e grupos relevantes quando houver dados suficientes. Não excluir os inconclusivos do relatório para inflar desempenho.
6. Definir metas e critérios de liberação antes do teste final com base no custo pedagógico dos erros. Não há meta numérica extraída de Ehri para este sistema.
7. Começar em modo de apoio à revisão. Só decidir sobre ajuste fino depois de medir o desempenho de uma solução inicial e entender seus erros.

Ler bibliografia orienta rubrica e instruções; não treina automaticamente o modelo. O desempenho depende de avaliação empírica com as gravações e rótulos revisados do projeto.

## Situação da aplicação

Na inspeção do fluxo existente, há gravação e classificação por palavra. O backend documenta exceção de áudio para NAO_RESPONDEU. Nesses registros sem áudio, a IA deve declarar ausência de evidência sonora, sem validar automaticamente a marcação humana. Nenhuma alteração de código ou envio de gravações foi realizado para este estudo.
