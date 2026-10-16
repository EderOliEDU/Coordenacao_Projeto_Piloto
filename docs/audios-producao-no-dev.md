# Reprodução dos áudios de Produção no DEV

O backend do DEV procura o arquivo primeiro em `AUDIO_STORAGE_PATH`, seu armazenamento local de gravações. Se ele não existir, procura em `AUDIO_READONLY_STORAGE_PATH`, montado a partir do compartilhamento NFS de Produção. A autenticação e o vínculo da aplicação com o aplicador continuam sendo verificados pela API.

Uploads e a limpeza de arquivos usam exclusivamente o diretório local. O compartilhamento de Produção é montado com `ro` tanto nas opções NFS quanto no volume do container.

## Autorizar o DEV no servidor NFS

No servidor `192.168.0.121`, como root, criar uma autorização separada da utilizada pelo servidor de aplicação de Produção:

```bash
printf '%s\n' '/opt/projeto_piloto_app/data/audios 172.17.2.42(ro,sync,no_subtree_check,root_squash)' > /etc/exports.d/fonica-audios-dev.exports
exportfs -ra
```

## Ativar no DEV

No servidor `172.17.2.42`, configurar esta variável no `.env` da raiz do projeto (arquivo local, ignorado pelo Git):

```dotenv
COMPOSE_FILE=compose.yml:compose.dev-audios-producao.yml
```

Validar e publicar:

```bash
cd /opt/projeto_piloto_app/app
docker compose --profile dev config --quiet
sudo /usr/bin/docker compose --profile dev up -d --build backend-dev frontend-dev
```

O arquivo `compose.dev-audios-producao.yml` monta a origem `192.168.0.121:/opt/projeto_piloto_app/data/audios` em `/mnt/audios-producao`, somente no backend DEV. Não deve ser habilitado no servidor de Produção.

## Validação

Após ativar, conferir a reprodução de um áudio referenciado no banco DEV. Os testes de armazenamento podem ser executados após compilar o backend:

```bash
cd backend
npm run build
node --test tests/audioStorage.test.cjs
```

Os testes verificam a busca na origem, a precedência de novas gravações DEV, a preservação do arquivo original e a rejeição de caminhos fora dos diretórios configurados.
