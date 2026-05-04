# Coordenação Projeto Piloto — Educação Infantil

Sistema de avaliação educacional para o **Projeto Piloto da Educação Infantil**.

📄 **Documento de referência do projeto:**
[PROJETO PLANO PILOTO DA EDUCAÇÃO INFANTIL ok.pdf](https://github.com/EderOliEDU/Coordenacao_Projeto_Piloto/blob/main/PROJETO%20PLANO%20PILOTO%20PILOTO%20DA%20EDUCA%C3%87%C3%83O%20INFANTIL%20ok.pdf)

---

## Arquitetura

| Banco | Tecnologia | Responsabilidade |
|---|---|---|
| `projPiloto` (PostgreSQL) | `pg` (acesso direto) | Autenticação de professores por CPF; dados de usuários |
| `dev.db` / `prod.db` (SQLite) | Prisma ORM | Formulários, seções, perguntas, escalas, submissões e respostas |

### Estrutura do projeto

```
├── backend/             # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── app.ts       # Express app com todas as rotas
│   │   ├── server.ts    # Startup com verificação de conexões
│   │   ├── db/
│   │   │   ├── pg.ts    # Pool PostgreSQL (projPiloto)
│   │   │   └── prisma.ts# Singleton Prisma (SQLite)
│   │   ├── middleware/
│   │   │   ├── jwtAuth.ts      # authenticateJWT + requireAdmin
│   │   │   └── rateLimiter.ts  # Rate limiters
│   │   └── routes/
│   │       ├── auth.ts         # Login CPF + Login admin
│   │       ├── turmas.ts       # Turmas e alunos
│   │       ├── formularios.ts  # Formulário ativo
│   │       ├── submissoes.ts   # CRUD submissões
│   │       ├── importacao.ts   # Importação CSV (admin)
│   │       └── consolidacao.ts # Consolidação de respostas (admin)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── .env.example
├── frontend/            # React + Vite + TypeScript
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.tsx        # Login professor (CPF) ou admin
│       │   ├── TurmasPage.tsx       # Lista de turmas
│       │   ├── AlunosPage.tsx       # Lista de alunos da turma
│       │   ├── FormularioPage.tsx   # Preenchimento do formulário
│       │   └── ConsolidacaoPage.tsx # Painel admin (somente admin)
│       └── components/
│           ├── EscalaSelector.tsx
│           └── LegendaPanel.tsx
├── scripts/
│   └── migrate-pg.sql   # Migração PostgreSQL (executar 1x)
└── docker-compose.yml
```

---

## Configuração rápida (desenvolvimento)

### Pré-requisitos

- Node.js ≥ 20
- npm ≥ 9
- Acesso ao PostgreSQL `projPiloto`

### Backend

```bash
cd backend

# 1) Copiar e editar variáveis de ambiente
cp .env.example .env
# Edite .env com as credenciais reais

# 2) Instalar dependências
npm install

# 3) Gerar Prisma client e aplicar migrações SQLite
npm run migrate   # cria/atualiza o banco SQLite
npm run seed      # insere escalas, formulário e seções

# 4) Iniciar servidor de desenvolvimento
npm run dev       # porta 3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev       # porta 5173
```

### Migração PostgreSQL (executar uma vez no servidor)

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
| `CORS_ORIGIN` | Origens CORS permitidas | `http://localhost:5173` |
| `PILOTO_PG_HOST` | Host do PostgreSQL | `localhost` |
| `PILOTO_PG_PORT` | Porta do PostgreSQL | `5432` |
| `PILOTO_PG_DATABASE` | Nome do banco | `projPiloto` |
| `PILOTO_PG_USER` | Usuário PostgreSQL | `postgres` |
| `PILOTO_PG_PASSWORD` | Senha PostgreSQL | *(obrigatório)* |
| `PILOTO_PG_SSL` | SSL: `false` / `true` / `strict` | `false` |
| `ADMIN_USER` | Usuário administrador | `admin` |
| `ADMIN_PASSWORD` | Senha do administrador | *(obrigatório)* |

---

## API — Autenticação

### `POST /api/auth/login`

Aceita dois fluxos:

**Fluxo professor (CPF + PostgreSQL):**
```json
{ "cpf": "12345678901", "senha": "01011990" }
```
- No primeiro acesso, a senha provisória é a data de nascimento (`DDMMAAAA`)
- O sistema grava `senha_hash` automaticamente no primeiro login

**Fluxo admin (via `.env`):**
```json
{ "usuario": "admin", "senha": "sua_senha_admin" }
```

**Resposta 200:**
```json
{
  "token": "<JWT>",
  "user": {
    "nome": "Prof. Fulano",
    "cpf": "12345678901",
    "role": "PROFESSOR",
    "mustChangePassword": false
  }
}
```

O campo `role` pode ser `"ADMIN"` ou `"PROFESSOR"`.

---

### `POST /api/auth/change-password`

Troca a senha do professor autenticado. Não disponível para admin (use `ADMIN_PASSWORD`).

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{ "senhaAtual": "01011990", "novaSenha": "NovaSenha123!" }
```

---

## Página de Consolidação (Admin only)

### Acesso

1. Na tela de login, clique em **"Administrador"**
2. Informe: `usuário = admin`, `senha = valor de ADMIN_PASSWORD no .env`
3. Após login, você será redirecionado automaticamente para `/admin/consolidacao`

> ⚠️ A rota `/admin/consolidacao` é **protegida por role**. Usuários com role `PROFESSOR` são redirecionados para `/turmas`. O botão não aparece no menu para não-admins.

### Funcionalidades

- **Filtros**: escola, turma, status (rascunho/enviada), período (data início/fim)
- **Indicadores**: total de submissões, contagem e percentual por status
- **Tabela**: escola, turma, aluno, matrícula, status, nº de respostas, datas, professores
- **Exportar CSV**: baixar os dados filtrados como `.csv` compatível com Excel

### Endpoints admin (requerem token com `role: ADMIN`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/admin/consolidacao` | Dados consolidados com filtros opcionais |
| `GET` | `/api/admin/consolidacao/escolas` | Lista escolas (para filtro) |
| `GET` | `/api/admin/consolidacao/turmas` | Lista turmas (para filtro) |
| `GET` | `/api/admin/consolidacao/csv` | Exportar dados como CSV |
| `POST` | `/api/admin/importar/:tipo` | Importar CSV (escolas/turmas/professores/alunos) |

Parâmetros de filtro para `/consolidacao` e `/consolidacao/csv`:

| Param | Tipo | Descrição |
|---|---|---|
| `escolaId` | string | UUID da escola no SQLite |
| `turmaId` | string | UUID da turma no SQLite |
| `status` | string | `RASCUNHO` ou `ENVIADA` |
| `dataInicio` | YYYY-MM-DD | Data mínima de criação |
| `dataFim` | YYYY-MM-DD | Data máxima de criação |

---

## Deploy com Docker

```bash
# Copiar e editar variáveis (na raiz do projeto)
cp backend/.env.example .env
# Edite .env com todos os valores reais

# Subir serviços
docker-compose up -d --build

# Verificar logs
docker-compose logs -f backend

# Acessar
# Frontend: http://localhost:5173
# Backend health: http://localhost:3001/api/health
```

---

## Escalas de Resposta

### Escala 1 — PEA (Práticas Experienciadas Avaliadas) — por cores

Usada nas seções de **Linguagem** (Oralidade/Leitura, Escrita, Compreensão Leitora).

> **Regra de UI:** exibir apenas como swatches coloridos, sem texto. Legenda disponível em painel "Consultar legenda".

| Chave | Cor | Descrição |
|---|---|---|
| `PEA-NDA` | 🟠 `#F39C12` | prática experienciada – não domina ainda |
| `PEA-TD` | 🟡 `#F1C40F` | prática experienciada – tem dificuldade |
| `PEA-PD` | 🔵 `#3498DB` | prática experienciada – tem pouca dificuldade |
| `PEA-D` | 🟢 `#2ECC71` | prática experienciada – domina |

### Escala 2 — Fluxo de Aprendizagem

Usada em **Matemática** e **Senso de Organização**.

| Chave | Rótulo | Descrição |
|---|---|---|
| `SF` | SF | segue o fluxo |
| `SFP` | SFP | segue o fluxo parcialmente |
| `NSF` | NSF | não segue o fluxo |

### Escala 3 — Sim / Não

Usada em **Perguntas Gerais** (PAEE, estudo de caso).

---

## Scripts úteis

```bash
# Backend
cd backend
npm run dev          # servidor com hot-reload (porta 3001)
npm run build        # compilar TypeScript → dist/
npm run start        # iniciar build compilado
npm run migrate      # criar/aplicar migração Prisma
npm run seed         # popular banco SQLite inicial
npm run db:studio    # abrir Prisma Studio (UI do banco)

# Frontend
cd frontend
npm run dev          # servidor Vite (porta 5173)
npm run build        # build de produção
```
