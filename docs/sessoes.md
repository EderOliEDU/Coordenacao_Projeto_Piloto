# Sessões de acesso

O login emite um JWT com identificador de sessão (`sid`) registrado em `auth_sessoes`. A API exige uma sessão ativa vinculada ao CPF, além da assinatura e validade do JWT. Tokens de versões anteriores exigem um novo login.

- `SESSION_IDLE_TIMEOUT_SECONDS`: 1800 por padrão (30 minutos sem interação).
- `SESSION_PRESENCE_TIMEOUT_SECONDS`: 120 por padrão (dois minutos sem sinal do navegador).
- `JWT_EXPIRES_IN`: mantém o limite absoluto já configurado para o token.

O navegador armazena token, perfil e modo de conferência em `sessionStorage`, sem migrar os dados antigos de `localStorage`. Teclado, cliques, entrada e rolagem atualizam a atividade. Um sinal a cada 30 segundos mantém a presença; sinais sem interação não renovam o prazo de inatividade. Respostas 401 encerram o acesso tanto nas páginas com Axios quanto nas que usam fetch.

Ao sair pelo menu, o servidor revoga a sessão e o navegador remove os dados locais. Atualizar a página preserva a sessão válida. Fechar a aba ou o navegador encerra o armazenamento normal daquela aba; como não existe aviso de fechamento garantido pelos navegadores, a API também rejeita tokens após dois minutos sem sinais. Restauração de abas ou suspensão prolongada do navegador continua sujeita aos prazos do servidor.

A tabela pode ser criada com `docs/migracoes-prod/2026-10-15-auth-sessoes.sql`. Testes:

```bash
cd backend
npm run build
node --test tests/liberarReserva.integration.cjs
cd ../frontend
node --test tests/session.test.cjs
```
