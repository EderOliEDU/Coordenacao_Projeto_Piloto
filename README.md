# Piloto EI – Coordenação Projeto Piloto Educação Infantil

Sistema de acompanhamento de aprendizagem de alunos da Educação Infantil (EI), utilizado por professores para registro e envio de formulários de avaliação.

## Visão Geral

- **Backend**: Node.js + Express + Prisma ORM + SQLite
- **Frontend**: React + Vite (TypeScript)
- **Autenticação**: JWT + LDAP/Active Directory (com modo mock para desenvolvimento)
- **Importação de dados**: Scripts CLI para importação via CSV

## Pré-requisitos

- Node.js 18+
- npm 9+

## Estrutura

```
backend/    → API REST (Express + Prisma)
frontend/   → Interface web (React + Vite)
docs/       → Diagramas e documentação técnica
```

## Configuração e Execução

### Backend

```bash
cd backend
cp .env.example .env
# Edite .env conforme necessário (LDAP_MOCK=true para dev)
npm install
npx prisma migrate dev --name init
npx ts-node --project tsconfig.seed.json prisma/seed.ts
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Acesse: http://localhost:5173

### Variáveis de Ambiente (backend/.env)

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Caminho do banco SQLite (`file:./dev.db`) |
| `JWT_SECRET` | Segredo para assinatura dos tokens JWT |
| `JWT_EXPIRES_IN` | Validade do token (ex: `8h`) |
| `LDAP_URL` | URL do servidor AD/LDAP |
| `LDAP_BASE_DN` | Base DN de busca |
| `LDAP_BIND_DN` | DN da conta de serviço |
| `LDAP_BIND_PASSWORD` | Senha da conta de serviço |
| `LDAP_SEARCH_FILTER` | Filtro de busca (ex: `(sAMAccountName={{username}})`) |
| `LDAP_MOCK` | `"true"` para modo dev (qualquer senha aceita) |
| `PORT` | Porta do servidor (padrão: 3001) |

## Importação de Dados via CSV

### Via API (multipart/form-data)

```
POST /api/admin/importar/:tipo
Authorization: Bearer <token>
Content-Type: multipart/form-data
arquivo: <arquivo.csv>
```

Tipos: `escolas`, `turmas`, `professores`, `alocacoes`, `alunos`

### Via CLI

```bash
cd backend
npx ts-node src/scripts/importCsv.ts --tipo alunos --arquivo /caminho/alunos.csv
```

### Formatos CSV

**escolas.csv**
```csv
nome,municipio,uf
Escola Municipal X,São Paulo,SP
```

**turmas.csv**
```csv
nome,codigo,anoLetivo,turno,escolaNome
Turma A,T001,2024,MANHA,Escola Municipal X
```

**professores.csv**
```csv
nome,login,email,matricula
João Silva,joao.silva,joao@escola.local,MAT001
```

**alocacoes.csv**
```csv
professorLogin,turmaNome
joao.silva,Turma A
```

**alunos.csv**
```csv
nome,matricula,dataNascimento,sexo,turmaNome
Pedro Santos,ALU001,2017-03-15,M,Turma A
```

## Seed

O seed popula o banco com:
- 3 escalas de resposta: `ESC_PEA_COR` (cores), `ESC_FLUXO`, `ESC_SIM_NAO`
- 1 formulário ativo "Formulário Piloto EI" v1.0.0 com 6 seções e ~20 perguntas

```bash
cd backend && npx ts-node --project tsconfig.seed.json prisma/seed.ts
```

## Diagrama de Classes

Ver: `docs/diagrama-classes-formulario-v4.puml`

## Fluxo do Usuário

1. Professor acessa `/login` e entra com credenciais de rede
2. Vê suas turmas atribuídas em `/turmas`
3. Acessa uma turma e vê a lista de alunos
4. Clica em um aluno para preencher o formulário
5. Responde as perguntas usando seletores de cor (PEA) ou botões de texto (Fluxo/Sim-Não)
6. Salva como rascunho ou envia definitivamente

## Licença

Uso interno – Secretaria de Educação.
