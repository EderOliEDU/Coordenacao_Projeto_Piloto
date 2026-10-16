-- Aplicar ao publicar o controle de sessões. O backend também cria a estrutura
-- automaticamente no primeiro login, quando possui permissão de CREATE.
CREATE TABLE IF NOT EXISTS public.auth_sessoes (
  id uuid PRIMARY KEY,
  cpf_usuario text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultima_atividade_em timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_sinal_em timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em timestamptz NOT NULL,
  encerrada_em timestamptz
);
CREATE INDEX IF NOT EXISTS auth_sessoes_expira_idx ON public.auth_sessoes (expira_em);
