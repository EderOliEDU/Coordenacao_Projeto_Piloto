# Piloto EI - Coordenacao Projeto Piloto Educacao Infantil

Sistema de acompanhamento de aprendizagem da Educacao Infantil, utilizado por professores para organizar turmas, cronogramas e registros pedagogicos do Projeto Piloto.

## Visao Geral

- **Backend**: Node.js + Express + acesso direto ao PostgreSQL com `pg`
- **Frontend**: React + Vite + TypeScript
- **Autenticacao**: JWT + LDAP/Active Directory e login por CPF
- **Banco de dados**: PostgreSQL existente da SEMECEL
- **Importacao de dados**: CSV via API ou CLI, gravando diretamente no PostgreSQL

> Importante: o projeto **nao usa Prisma**. Referencias a Prisma, Prisma Client, migrations Prisma, `npx prisma generate` ou SQLite devem ser tratadas como legado e removidas/corrigidas. O driver correto para o banco e `pg`.

## Ambientes

### Desenvolvimento

| Item | Valor |
|------|-------|
| Servidor DEV | `bd-dev` |
| IP DEV | `172.17.2.42` |
| Caminho no servidor | `/opt/projeto_piloto_app/app` |
| Frontend DEV | `http://172.17.2.42:5173` |
| Backend DEV | `http://172.17.2.42:3001` |
| Branch de atualizacao | `codex/cronograma-turma-login` |

Tudo que for feito para teste e validacao diaria deve ser tratado como **DEV**. Nao use comandos de producao, nem `scripts/shell/build-prod.sh`, salvo pedido explicito.

### Producao

| Item | Valor |
|------|-------|
| Servidor da aplicacao | `192.168.0.122` |
| Servidor do banco | `192.168.0.121` |

## Estrutura

```text
backend/    API REST Express e acesso direto ao PostgreSQL
frontend/   Interface web React/Vite
docs/       Diagramas, documentos e migracoes
scripts/    Scripts de apoio; arquivos shell ficam em scripts/shell/
```

## Configuracao do Backend

O backend usa variaveis locais de ambiente. Em DEV, o arquivo esperado e:

```text
backend/.env_dev
```

Esse arquivo e local do servidor e pode nao estar versionado no GitHub.

Variaveis principais:

| Variavel | Descricao |
|----------|-----------|
| `PORT` | Porta do backend, normalmente `3001` |
| `JWT_SECRET` | Segredo para assinatura dos tokens JWT |
| `JWT_EXPIRES_IN` | Validade do token, exemplo `8h` |
| `LDAP_URL` | URL do servidor LDAP/AD |
| `LDAP_BASE_DN` | Base DN de busca |
| `LDAP_BIND_DN` | DN da conta de servico |
| `LDAP_BIND_PASSWORD` | Senha da conta de servico |
| `LDAP_SEARCH_FILTER` | Filtro de busca LDAP |
| `LDAP_MOCK` | `true` para modo de teste |
| `PILOTO_PG_HOST` | Host do PostgreSQL |
| `PILOTO_PG_PORT` | Porta do PostgreSQL, normalmente `5432` |
| `PILOTO_PG_DB` | Nome do banco PostgreSQL |
| `PILOTO_PG_USER` | Usuario do PostgreSQL |
| `PILOTO_PG_PASSWORD` | Senha do PostgreSQL |
| `PILOTO_PG_SSL` | `true` quando SSL for necessario |
| `RESULTADOS_ALLOWED_CPFS` | CPFs liberados para tela de resultados |
| `SUPERADMIN_CPFS` | CPFs extras liberados para superadministracao |

O CPF `65495934172` e superadministrador padrao no codigo.

## Execucao em Desenvolvimento

No servidor DEV:

```bash
cd /opt/projeto_piloto_app/app
./scripts/shell/build-dev.sh
```

O script deve:

1. Parar os containers DEV.
2. Rebuildar backend e frontend.
3. Subir:
   - `app-backend-dev-1`
   - `app-frontend-dev-1`
4. Validar:
   - `/` retorna `200 OK`
   - `/api/turmas` sem token retorna `401 Unauthorized`
   - Nginx usa `proxy_pass http://backend-dev:3001/api/;`

Se os scripts `.sh` vierem com quebra de linha Windows:

```bash
sed -i 's/\r$//' scripts/shell/build-dev.sh scripts/shell/stop-dev.sh scripts/shell/start-dev.sh
chmod +x scripts/shell/build-dev.sh scripts/shell/stop-dev.sh scripts/shell/start-dev.sh
```

Se ainda aparecer erro de shebang como `#!/usr/bin/env: Arquivo ou diretorio inexistente`, remova BOM/caracter invisivel:

```bash
python3 - <<'PY'
from pathlib import Path
for name in ["scripts/shell/build-dev.sh", "scripts/shell/stop-dev.sh", "scripts/shell/start-dev.sh"]:
    p = Path(name)
    data = p.read_bytes()
    data = data.replace(b"\xef\xbb\xbf", b"").replace(b"\r\n", b"\n")
    p.write_bytes(data)
PY
chmod +x scripts/shell/build-dev.sh scripts/shell/stop-dev.sh scripts/shell/start-dev.sh
```

## Atualizacao Pelo GitHub

A branch usada para atualizar DEV e:

```text
codex/cronograma-turma-login
```

Fluxo para publicar alteracoes:

```bash
git status
git add ARQUIVOS_ALTERADOS
git commit -m "Mensagem da alteracao"
git push origin codex/cronograma-turma-login
```

Se o push direto do ambiente do Codex falhar, use o fluxo validado com clone temporario HTTPS:

```bash
git clone https://github.com/EderOliEDU/Coordenacao_Projeto_Piloto.git projeto-temp
cd projeto-temp
git checkout codex/cronograma-turma-login
```

Depois aplique as alteracoes no clone temporario, confira e publique:

```bash
git diff
git diff --check
git status
git add ARQUIVOS_ALTERADOS
git commit -m "Mensagem da alteracao"
git push origin codex/cronograma-turma-login
```

## Atualizacao do Servidor DEV

Depois do push no GitHub:

```bash
cd /opt/projeto_piloto_app/app
git fetch origin
git reset --hard origin/codex/cronograma-turma-login
./scripts/shell/build-dev.sh
```

Se `backend/.env_dev` nao existir apos o `reset --hard`, restaure do backup ou recrie antes do build:

```bash
cp /tmp/.env_dev.backup backend/.env_dev
```

## Importacao de Dados via CSV

A importacao CSV continua disponivel para atualizacao de dados no PostgreSQL. Ela nao usa Prisma.

### Via API

```text
POST /api/admin/importar/:tipo
Authorization: Bearer <token>
Content-Type: multipart/form-data
arquivo: <arquivo.csv>
```

Tipos aceitos:

```text
escolas
etapas
turmas
professores
alocacoes
alunos
```

### Via CLI

```bash
cd backend
npm run import:csv -- --tipo alunos --arquivo /caminho/alunos.csv
```

### Colunas aceitas

O importador aceita os nomes atuais do PostgreSQL e alguns aliases comuns.

**escolas.csv**

```csv
id_escola,nome_escola,projeto
1,EMEI Exemplo,PJINSTFONI
```

**etapas.csv**

```csv
id_etapa,descricao,projeto
1,Pre I,PJINSTFONI
```

**turmas.csv**

```csv
id_turma,id_escola,id_etapa,letra_turma,turno
10,1,1,A,MANHA
```

**professores.csv**

```csv
profissional_cpf,profissional_nome,profissional_nome_social,profissional_dt_nascimento,profissional_e_mail
12345678900,Nome do Professor,,1980-01-01,professor@exemplo.local
```

**alocacoes.csv**

```csv
cpf_professor,id_turma
12345678900,10
```

**alunos.csv**

```csv
id_aluno,nome,cpf,inep,situacao,id_turma,escola,serie,turma,turno
100,Nome do Aluno,,123456789,ATIVO,10,EMEI Exemplo,Pre I,A,MANHA
```

## Autenticacao

O backend suporta login em `POST /api/auth/login`.

### Login LDAP/AD

Use `login` e `senha` de rede.

### Login por CPF

Quando `login` contem 11 digitos, o backend consulta `public.professores` no PostgreSQL e valida a senha armazenada na coluna `senha`.

Senhas suportadas:

- bcrypt (`$2...`)
- MD5 legado
- texto puro legado, apenas como compatibilidade

## Superadministracao

Usuarios com permissao `superadmin` acessam:

```text
/superadmin
```

Funcoes:

- Buscar professor por nome, CPF ou e-mail.
- Resetar senha para `NULL`.
- Alterar senha por CPF.

As rotas ficam em:

```text
/api/superadmin
```

## Licenca

Uso interno - Secretaria Municipal de Educacao.
