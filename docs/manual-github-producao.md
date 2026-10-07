# Manual: enviar atualizacoes ao GitHub e atualizar producao

Este fluxo parte da estacao Windows, onde o Codex altera os arquivos em:

```text
D:\Coordenção Projeto Piloto educação Infantil\Programas\app
```

Depois de testar no DEV, as alteracoes devem ir para o GitHub e, em seguida, serem baixadas no servidor de producao.

## 1. Conferir alteracoes na estacao Windows

Abra um terminal na pasta do projeto:

```bash
cd "D:\Coordenção Projeto Piloto educação Infantil\Programas\app"
```

Confira o que foi alterado:

```bash
git status
git diff
```

Para ver somente os nomes dos arquivos:

```bash
git status --short
```

## 2. Validar build antes do GitHub

Backend:

```bash
cd "D:\Coordenção Projeto Piloto educação Infantil\Programas\app\backend"
npm run build
```

Frontend:

```bash
cd "D:\Coordenção Projeto Piloto educação Infantil\Programas\app\frontend"
npm run build
```

Se estiver usando o runtime do Codex em vez do `npm` do Windows, a validacao equivalente e:

```powershell
cd "D:\Coordenção Projeto Piloto educação Infantil\Programas\app\backend"
& "C:\Users\eder.oliveira\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" node_modules\typescript\bin\tsc

cd "D:\Coordenção Projeto Piloto educação Infantil\Programas\app\frontend"
& "C:\Users\eder.oliveira\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" node_modules\typescript\bin\tsc
& "C:\Users\eder.oliveira\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" node_modules\vite\bin\vite.js build
```

## 3. Enviar para o GitHub

Volte para a raiz:

```bash
cd "D:\Coordenção Projeto Piloto educação Infantil\Programas\app"
```

Adicione somente os arquivos que devem entrar nesta entrega. Exemplo:

```bash
git add frontend/src/pages/SuperadminPage.tsx
git add backend/src/routes/superadmin.ts
git add scripts/shell/sync-dev-local.sh
git add scripts/shell/build-dev.sh
```

Evite usar `git add .` quando houver muitas alteracoes pendentes no projeto. Use apenas se voce revisou o `git status` e tem certeza de que tudo deve ir para o GitHub.

Confira o que entrou no commit:

```bash
git diff --cached
```

Crie o commit:

```bash
git commit -m "feat: atualizar painel superadmin"
```

Envie para o GitHub:

```bash
git push origin main
```

Se estiver trabalhando em outra branch, troque `main` pelo nome da branch atual.

## 4. Baixar atualizacoes no servidor de producao

Acesse o servidor de producao:

```bash
ssh coordenacao@192.168.0.122
```

Entre na pasta do app:

```bash
cd /opt/projeto_piloto_app/app
```

Confira a branch:

```bash
git branch --show-current
```

Baixe as atualizacoes do GitHub:

```bash
git fetch origin
git pull --ff-only origin main
```

Se a producao usa outra branch, troque `main` pelo nome correto.

### Atualizacao automatizada com backup do release atual

Depois que o arquivo `scripts/shell/sync-prod-github.sh` ja estiver no servidor de producao, prefira usar:

```bash
cd /opt/projeto_piloto_app/app
BRANCH=main ./scripts/shell/sync-prod-github.sh deploy
```

Se a producao ainda estiver em um commit antigo e o script ainda nao existir nesse caminho, busque o script temporariamente do GitHub:

```bash
cd /opt/projeto_piloto_app/app
git fetch origin main
git show origin/main:scripts/shell/sync-prod-github.sh > /tmp/sync-prod-github.sh
chmod +x /tmp/sync-prod-github.sh
BRANCH=main APP_DIR=/opt/projeto_piloto_app/app /tmp/sync-prod-github.sh deploy
```

Esse script:

- valida que esta no IP de producao `192.168.0.122`;
- cria uma copia do release atual em `/opt/projeto_piloto_app/releases`;
- guarda o hash do commit que estava rodando;
- baixa a branch configurada do GitHub com `git pull --ff-only`;
- executa `./scripts/shell/build-prod.sh`;
- mantem os ultimos backups de release para rollback.

Se precisar voltar para o que estava funcionando antes:

```bash
cd /opt/projeto_piloto_app/app
./scripts/shell/sync-prod-github.sh rollback
```

Para voltar para um backup especifico:

```bash
./scripts/shell/sync-prod-github.sh rollback /opt/projeto_piloto_app/releases/NOME-DA-PASTA
```

Depois de um rollback, a pasta do app fica no commit restaurado. No proximo deploy normal, rode novamente:

```bash
BRANCH=main ./scripts/shell/sync-prod-github.sh deploy
```

## 5. Rebuildar producao

Na producao, rode:

```bash
./scripts/shell/build-prod.sh
```

O script deve:

- validar que esta no IP de producao `192.168.0.122`;
- preservar arquivos `.env`;
- parar a stack de producao;
- rebuildar backend e frontend;
- subir os containers;
- executar smoke tests locais e publicos.

## 6. Atualizar atribuicoes/designacoes em producao

As atribuicoes geradas a partir de `public.designacoes` sao dados do banco. Elas nao sao copiadas pelo GitHub.

Depois do deploy em producao, acesse:

```text
https://fonica.rondonopolis.mt.gov.br/
```

Entre com usuario superadministrador e abra a pagina **Superadmin**.

Na area **Atribuicoes por designacoes**, clique em:

```text
Atualizar atribuicoes
```

O sistema vai comparar `public.designacoes` com `public.atribuicao_professor`, somente para o projeto `PJINSTFONI`, e mostrar:

- novas atribuicoes;
- atribuicoes excluidas;
- atribuicoes que ja existiam;
- pendencias ignoradas.

Se a tela retornar `0 nova(s), 0 excluida(s)`, a producao ja esta sincronizada.

## 7. Conferir resultado

Verifique os containers:

```bash
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Teste o frontend local:

```bash
curl -sSI http://127.0.0.1:5173/ | head
```

Teste a API sem token. O esperado e `401 Unauthorized`:

```bash
curl -sSI http://127.0.0.1:5173/api/turmas | head
```

Teste a URL publica:

```bash
curl -sSI https://fonica.rondonopolis.mt.gov.br/ | head
```

Depois acesse no navegador:

```text
https://fonica.rondonopolis.mt.gov.br/
```

## 8. Se algo der errado

Veja logs do backend:

```bash
sudo docker logs --tail=100 app-backend-prod-1
```

Veja logs do frontend:

```bash
sudo docker logs --tail=100 app-frontend-prod-1
```

Veja logs do Caddy, se estiver em uso:

```bash
sudo docker logs --tail=100 app-caddy-1
```

Para voltar manualmente para o commit anterior:

```bash
git log --oneline -5
git checkout <hash-do-commit-anterior>
./scripts/shell/build-prod.sh
```

Depois, para voltar para a branch normal:

```bash
git checkout main
```

## Observacoes importantes

- Nao envie arquivos `.env` para o GitHub.
- Sempre teste no DEV antes de atualizar producao.
- Use `git diff --cached` antes do commit para evitar mandar arquivos indesejados.
- Em producao, prefira `git pull --ff-only` para evitar merges acidentais no servidor.
- O script `scripts/shell/sync-dev-local.sh` e apenas para teste em DEV antes do GitHub; producao deve receber codigo via GitHub.
