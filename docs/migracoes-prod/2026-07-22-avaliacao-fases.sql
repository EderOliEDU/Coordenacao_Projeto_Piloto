-- Fases de avaliacao do Projeto Instrucao Fonica.
-- Permite manter historico da 1a fase e registrar novas reavaliacoes.

BEGIN;

CREATE TABLE IF NOT EXISTS public.avaliacao_fases (
  id_fase serial PRIMARY KEY,
  nome text NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 1,
  descricao text,
  criada_em timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizada_em timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT avaliacao_fases_periodo_check CHECK (data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS idx_avaliacao_fases_periodo_ativo
  ON public.avaliacao_fases (ativo, data_inicio, data_fim);

INSERT INTO public.avaliacao_fases (id_fase, nome, data_inicio, data_fim, ativo, ordem, descricao)
VALUES (1, '1a Fase', DATE '2026-06-01', DATE '2026-07-03', true, 1, 'Fase inicial criada para preservar os registros ja existentes.')
ON CONFLICT (id_fase) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.avaliacao_fases', 'id_fase'),
  GREATEST((SELECT COALESCE(MAX(id_fase), 1) FROM public.avaliacao_fases), 1),
  true
);

ALTER TABLE public.submissoes_pg
  ADD COLUMN IF NOT EXISTS id_fase integer;

ALTER TABLE public.avaliacao_respostas
  ADD COLUMN IF NOT EXISTS id_fase integer;

ALTER TABLE public.avaliacao_respostas
  ADD COLUMN IF NOT EXISTS id_turma integer;

ALTER TABLE public.aluno_necessidades_contexto
  ADD COLUMN IF NOT EXISTS id_fase integer;

ALTER TABLE public.aluno_necessidades_especificas
  ADD COLUMN IF NOT EXISTS id_fase integer;

UPDATE public.submissoes_pg
SET id_fase = 1
WHERE id_fase IS NULL;

UPDATE public.avaliacao_respostas ar
SET id_fase = COALESCE(ar.id_fase, sp.id_fase, 1),
    id_turma = COALESCE(ar.id_turma, sp.id_turma)
FROM public.submissoes_pg sp
WHERE regexp_replace(ar.cpf_professor::text, '\D', '', 'g') = regexp_replace(sp.cpf_professor::text, '\D', '', 'g')
  AND ar.id_aluno = sp.id_aluno
  AND ar.id_fase IS NULL;

UPDATE public.avaliacao_respostas
SET id_fase = 1
WHERE id_fase IS NULL;

UPDATE public.aluno_necessidades_contexto
SET id_fase = 1
WHERE id_fase IS NULL;

UPDATE public.aluno_necessidades_especificas
SET id_fase = 1
WHERE id_fase IS NULL;

ALTER TABLE public.submissoes_pg
  ALTER COLUMN id_fase SET DEFAULT 1;

ALTER TABLE public.avaliacao_respostas
  ALTER COLUMN id_fase SET DEFAULT 1;

ALTER TABLE public.aluno_necessidades_contexto
  ALTER COLUMN id_fase SET DEFAULT 1;

ALTER TABLE public.aluno_necessidades_especificas
  ALTER COLUMN id_fase SET DEFAULT 1;

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.submissoes_pg'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%cpf_professor%'
      AND pg_get_constraintdef(oid) ILIKE '%id_turma%'
      AND pg_get_constraintdef(oid) ILIKE '%id_aluno%'
      AND pg_get_constraintdef(oid) ILIKE '%formulario_id%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%id_fase%'
  LOOP
    EXECUTE format('ALTER TABLE public.submissoes_pg DROP CONSTRAINT IF EXISTS %I', item.conname);
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.submissoes_pg_cpf_professor_id_turma_id_aluno_formulario_id_key;
DROP INDEX IF EXISTS public.idx_submissoes_pg_unica;

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT idx.relname AS index_name
    FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    JOIN pg_class tbl ON tbl.oid = i.indrelid
    JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
    CROSS JOIN LATERAL (
      SELECT array_agg(att.attname::text ORDER BY cols.ord) AS columns
      FROM unnest(i.indkey) WITH ORDINALITY AS cols(attnum, ord)
      JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = cols.attnum
    ) c
    WHERE ns.nspname = 'public'
      AND tbl.relname = 'submissoes_pg'
      AND i.indisunique = true
      AND c.columns @> ARRAY['cpf_professor', 'id_turma', 'id_aluno', 'formulario_id']
      AND NOT c.columns @> ARRAY['id_fase']
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', item.index_name);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_submissoes_pg_unica_fase
  ON public.submissoes_pg (cpf_professor, id_turma, id_aluno, formulario_id, id_fase);

CREATE INDEX IF NOT EXISTS idx_submissoes_pg_fase_turma_aluno
  ON public.submissoes_pg (id_fase, id_turma, id_aluno);

CREATE INDEX IF NOT EXISTS idx_avaliacao_respostas_fase_turma_aluno
  ON public.avaliacao_respostas (id_fase, id_turma, id_aluno, cpf_professor);

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.aluno_necessidades_contexto'::regclass
      AND contype = 'p'
  LOOP
    EXECUTE format('ALTER TABLE public.aluno_necessidades_contexto DROP CONSTRAINT IF EXISTS %I', item.conname);
  END LOOP;
END $$;

ALTER TABLE public.aluno_necessidades_contexto
  ADD CONSTRAINT aluno_necessidades_contexto_pkey
  PRIMARY KEY (id_aluno, id_turma, cpf_professor, id_fase);

DROP INDEX IF EXISTS public.idx_aluno_necessidades_especificas_unica;

CREATE UNIQUE INDEX IF NOT EXISTS idx_aluno_necessidades_especificas_unica_fase
  ON public.aluno_necessidades_especificas (id_aluno, id_turma, cpf_professor, id_fase, id_necespecifica)
  WHERE id_necespecifica IS NOT NULL;

-- Exemplo para cadastrar a proxima fase:
-- INSERT INTO public.avaliacao_fases (nome, data_inicio, data_fim, ativo, ordem)
-- VALUES ('2a Fase', DATE '2026-07-04', DATE '2026-08-07', true, 2);

COMMIT;
