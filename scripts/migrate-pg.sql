-- Migração PostgreSQL projPiloto
-- Executar UMA VEZ no banco PostgreSQL para adicionar as colunas de autenticação
-- Comando: psql -h <host> -U <user> -d projPiloto -f scripts/migrate-pg.sql

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS senha_hash text,
  ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT true;

-- Índice único parcial para CPF não nulo e não vazio
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_cpf_key
  ON public.usuarios (cpf)
  WHERE cpf IS NOT NULL AND btrim(cpf) <> '';
