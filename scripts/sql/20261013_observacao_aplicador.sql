BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE public.avaliacao_aplicador_aplicacoes ADD COLUMN IF NOT EXISTS observacao text;
COMMIT;
