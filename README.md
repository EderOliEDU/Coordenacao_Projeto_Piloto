# Coordenação Projeto Piloto — Backend

Sistema de avaliação educacional: backend Node.js + Express + TypeScript com **autenticação por CPF** via PostgreSQL (`projPiloto`) e **formulários/submissões** via Prisma/SQLite.

---

## Arquitetura de bancos de dados

| Banco | Tecnologia | Responsabilidade |
|---|---|---|
| `projPiloto` (PostgreSQL) | `pg` (acesso direto) | Autenticação de professores por CPF; cadastro de usuários, escolas, turmas e alunos |
| `dev.db` (SQLite) | Prisma ORM | Formulários, seções, perguntas, escalas, submissões e respostas |

---

## Requisitos

- Node.js ≥ 20
- npm ≥ 9
- PostgreSQL `projPiloto` acessível com as colunas `senha_hash` e `must_change_password` (ver `scripts/migrate-pg.sql`)

---

## Configuração rápida (desenvolvimento)

```bash
# 1) Entrar no diretório do backend
cd backend

# 2) Copiar e editar variáveis de ambiente
cp .env.example .env
# Edite .env com as credenciais reais do PostgreSQL

# 3) Instalar dependências
npm install

# 4) Aplicar migrações SQLite e rodar seed
npm run migrate   # cria/atualiza o banco SQLite
npm run seed      # insere admin, escalas e formulário v1

# 5) Iniciar servidor de desenvolvimento
npm run dev       # porta 3001 por padrão
```

### Migração PostgreSQL (executar uma vez)

```bash
psql -h <host> -U <user> -d projPiloto -f scripts/migrate-pg.sql
```

---

## Variáveis de ambiente (`backend/.env`)

| Variável | Descrição | Padrão |
|---|---|---|
| `PORT` | Porta HTTP | `3001` |
| `NODE_ENV` | Ambiente | `development` |
| `JWT_SECRET` | Chave secreta JWT | *(obrigatório)* |
| `DATABASE_URL` | URL do SQLite | `file:./dev.db` |
| `PILOTO_PG_HOST` | Host do PostgreSQL | `localhost` |
| `PILOTO_PG_PORT` | Porta do PostgreSQL | `5432` |
| `PILOTO_PG_DATABASE` | Nome do banco | `projPiloto` |
| `PILOTO_PG_USER` | Usuário | `postgres` |
| `PILOTO_PG_PASSWORD` | Senha | *(obrigatório)* |
| `PILOTO_PG_SSL` | SSL: `false` / `true` / `strict` | `false` |
| `ADMIN_PASSWORD` | Senha do admin SQLite (seed) | `admin123` |

---

## API — Autenticação

### `POST /api/auth/login`

Autentica professor por CPF. Na primeira vez, a senha provisória é a data de nascimento (`DDMMAAAA`).

**Body:**
```json
{ "cpf": "12345678901", "senha": "01011990" }
```

**Resposta 200:**
```json
{
  "token": "<JWT>",
  "user": {
    "googleId": "...",
    "nome": "Prof. Fulano",
    "cpf": "12345678901",
    "idUnidade": 5,
    "mustChangePassword": true
  }
}
```

**Erros:** `400` (campos faltando/CPF inválido) · `401` (credenciais incorretas) · `429` (rate limit)

---

### `POST /api/auth/change-password`

Troca a senha do usuário autenticado. Define `must_change_password = false`.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{ "senhaAtual": "01011990", "novaSenha": "MinhaNovasenha1!" }
```

**Resposta 200:**
```json
{ "message": "Senha alterada com sucesso." }
```

**Erros:** `400` (campos faltando/nova senha muito curta) · `401` (token inválido ou senha atual incorreta)

---

### `GET /api/health`

Verifica se o servidor está no ar.

---

## Deploy com Docker

```bash
# Copiar variáveis e editar
cp backend/.env.example .env

# Subir serviço
docker-compose up -d --build
```

O container executa `prisma migrate deploy` automaticamente antes de iniciar.

---

## Scripts úteis

```bash
# Dentro de backend/
npm run dev          # servidor com hot-reload
npm run build        # compilar TypeScript → dist/
npm run start        # iniciar build compilado
npm run migrate      # criar/aplicar migração Prisma
npm run seed         # popular banco SQLite inicial
npm run db:studio    # abrir Prisma Studio (UI do banco)
```

---

## Docs — Escalas de Resposta e Regra de UI

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
