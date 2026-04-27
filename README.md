# Docs — Escalas de Resposta e Regra de UI

Este diretório contém o diagrama PlantUML que modela o formulário versionado e a forma como as perguntas são respondidas pelos professores.

## Arquivo
- `diagrama-classes-perguntas.puml`: diagrama de classes do modelo de perguntas/escala/respostas.

## Conceitos principais

### Formulário versionado
As perguntas podem mudar por versão. Por isso o modelo inclui:
- `Formulario` (com `versao`)
- `SecaoFormulario`
- `Pergunta`

Cada pergunta pertence a uma seção e o formulário pode ser publicado por versão.

### Escalas/Legendas reutilizáveis
Em vez de “fixar” opções em cada pergunta, usamos uma entidade de escala:
- `EscalaResposta`
- `OpcaoEscala`

A pergunta aponta para a escala (`Pergunta.escalaId`), permitindo reutilização e alteração por versão.

## Escala 1 — Linguagem (por cores)
Usada **somente** para os itens:
- LINGUAGEM – ORALIDADE E LEITURA (Consciência fonológica e fonêmica)
- LINGUAGEM – ESCRITA
- LINGUAGEM – COMPREENSÃO LEITORA

### Opções (chave → cor)
- PEA-ND  → `#F39C12`
- PEA-NDA → `#E67E22`
- PEA-TD  → `#F1C40F`
- PEA-PD  → `#3498DB`
- PEA-D   → `#2ECC71`

### Regra de UI (obrigatória)
- No formulário, **não exibir texto nas opções**.
- Cada opção deve aparecer apenas como um **swatch/botão colorido**.
- A “Legenda” (descrições completas) deve ficar em um painel separado **“Consultar legenda”**.

## Escala 2 — Fluxo
Usada para:
- MATEMÁTICA
- SENSO DE ORGANIZAÇÃO - CUIDADO DE SI, DO OUTRO E DO AMBIENTE

Opções:
- SF: segue o fluxo
- SFP: segue o fluxo parcialmente
- NSF: não segue o fluxo

(Se desejado, cores podem ser adicionadas futuramente, mas não são obrigatórias.)

## Respostas
- Uma `Submissao` representa o preenchimento para um aluno em uma turma/escola e versão do formulário.
- Uma `Resposta` referencia:
  - a `Pergunta`
  - a `OpcaoEscala` escolhida (múltipla escolha **única**)
