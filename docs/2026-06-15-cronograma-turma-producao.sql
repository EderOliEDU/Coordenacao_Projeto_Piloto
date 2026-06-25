\set ON_ERROR_STOP on

-- Migração manual para produção
-- Projeto Instrução Fônica
-- Data: 2026-06-15
--
-- Cria a tabela que registra, por turma, os itens do cronograma já
-- apresentados até o momento da avaliação.
--
-- Execução:
-- psql -h 192.168.0.121 -U postgres -d dbsemecel \
--   -f docs/2026-06-15-cronograma-turma-producao.sql

BEGIN;

-- Interrompe antes de alterar o banco se as estruturas utilizadas pela
-- aplicação não existirem ou tiverem tipos incompatíveis.
DO $$
DECLARE
  tipo_turma text;
  tipo_cronograma text;
BEGIN
  SELECT data_type
    INTO tipo_turma
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'turmas'
    AND column_name = 'id_turma';

  IF tipo_turma IS NULL THEN
    RAISE EXCEPTION
      'Migração cancelada: public.turmas.id_turma não foi encontrada';
  END IF;

  IF tipo_turma <> 'integer' THEN
    RAISE EXCEPTION
      'Migração cancelada: public.turmas.id_turma deve ser integer, mas é %',
      tipo_turma;
  END IF;

  SELECT data_type
    INTO tipo_cronograma
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'cronograma_aplicacao'
    AND column_name = 'id_cronograma_aplicacao';

  IF tipo_cronograma IS NULL THEN
    RAISE EXCEPTION
      'Migração cancelada: public.cronograma_aplicacao.id_cronograma_aplicacao não foi encontrada';
  END IF;

  IF tipo_cronograma <> 'integer' THEN
    RAISE EXCEPTION
      'Migração cancelada: public.cronograma_aplicacao.id_cronograma_aplicacao deve ser integer, mas é %',
      tipo_cronograma;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.turma_cronograma_aplicacao (
  id_turma integer NOT NULL,
  id_cronograma_aplicacao integer NOT NULL,
  cpf_professor text NOT NULL,
  atualizado_em timestamp with time zone NOT NULL DEFAULT NOW(),

  CONSTRAINT turma_cronograma_aplicacao_pkey
    PRIMARY KEY (id_turma, id_cronograma_aplicacao),

  CONSTRAINT turma_cronograma_aplicacao_turma_fkey
    FOREIGN KEY (id_turma)
    REFERENCES public.turmas (id_turma)
    ON DELETE CASCADE
);

COMMENT ON TABLE public.turma_cronograma_aplicacao IS
  'Itens do cronograma de aplicação apresentados a cada turma.';

COMMENT ON COLUMN public.turma_cronograma_aplicacao.id_turma IS
  'Turma para a qual o conteúdo foi apresentado.';

COMMENT ON COLUMN public.turma_cronograma_aplicacao.id_cronograma_aplicacao IS
  'Item correspondente em public.cronograma_aplicacao.';

COMMENT ON COLUMN public.turma_cronograma_aplicacao.cpf_professor IS
  'CPF da professora que realizou a última atualização.';

COMMENT ON COLUMN public.turma_cronograma_aplicacao.atualizado_em IS
  'Data e hora da última atualização do registro.';

CREATE INDEX IF NOT EXISTS turma_cronograma_aplicacao_item_idx
  ON public.turma_cronograma_aplicacao (id_cronograma_aplicacao);

COMMIT;

-- Verificação exibida ao final da execução.
SELECT
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'turma_cronograma_aplicacao';

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'turma_cronograma_aplicacao'
ORDER BY ordinal_position;
