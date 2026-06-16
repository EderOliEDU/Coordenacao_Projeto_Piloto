\set ON_ERROR_STOP on

-- Migração manual para produção
-- Projeto Instrução Fônica
-- Data: 2026-06-16
--
-- Cria o cadastro do cronograma de aplicação e a tabela que registra,
-- por turma, os itens já apresentados até o momento da avaliação.
--
-- Execução:
-- psql -h 192.168.0.121 -U postgres -d dbsemecel \
--   -f docs/2026-06-15-cronograma-turma-producao.sql

BEGIN;

DO $$
DECLARE
  tipo_turma text;
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
END
$$;

CREATE TABLE IF NOT EXISTS public.cronograma_aplicacao (
  id_cronograma_aplicacao integer NOT NULL,
  tema text NOT NULL,
  id_etapa integer,
  ordem integer,

  CONSTRAINT cronograma_aplicacao_pkey
    PRIMARY KEY (id_cronograma_aplicacao)
);

COMMENT ON TABLE public.cronograma_aplicacao IS
  'Cadastro dos conteúdos previstos no cronograma de aplicação por etapa.';

COMMENT ON COLUMN public.cronograma_aplicacao.id_etapa IS
  'Etapa/agrupamento ao qual o conteúdo se aplica.';

COMMENT ON COLUMN public.cronograma_aplicacao.ordem IS
  'Ordem de exibição do conteúdo no checklist.';

INSERT INTO public.cronograma_aplicacao (
  id_cronograma_aplicacao,
  tema,
  id_etapa,
  ordem
)
SELECT item.id_cronograma_aplicacao, item.tema, item.id_etapa, item.ordem
FROM (
  VALUES
    (1,  'Consciência de rimas',             5, 1),
    (21, 'Consciência de rimas',             4, 1),
    (2,  'Consciência de aliteração',        5, 2),
    (3,  'Consciência de frase',             5, 3),
    (4,  'Consciência de palavras',          5, 4),
    (5,  'Consciência de sílabas',           5, 5),
    (6,  'Vogais',                           5, 6),
    (7,  'Encontros vocálicos',              5, 7),
    (8,  'Letras F e J + vogais',            5, 8),
    (9,  'Letras L e M + vogais',            5, 9),
    (10, 'Letras N e R + vogais',            5, 10),
    (11, 'Letras S e V + vogais',            5, 11),
    (12, 'Letras X e Z + vogais',            5, 12),
    (13, 'Letras B e C + vogais',            5, 13),
    (14, 'Letras D e G + vogais',            5, 14),
    (15, 'Letras P e Q + vogais',            5, 15),
    (16, 'Letras T e H + vogais',            5, 16),
    (17, 'Diferenciação P, B e D',           5, 17),
    (18, 'Diferenciação F e V',              5, 18),
    (19, 'Diferenciação T e D',              5, 19),
    (22, 'Consciência de aliteração',        4, 2),
    (23, 'Consciência de frases',            4, 3),
    (24, 'Consciência de palavras',          4, 4),
    (25, 'Consciência de sílabas',           4, 5),
    (26, 'Introdução às vogais',             4, 6),
    (27, 'Associação som-letra do alfabeto', 4, 7)
) AS item(id_cronograma_aplicacao, tema, id_etapa, ordem)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.cronograma_aplicacao existente
  WHERE existente.id_cronograma_aplicacao = item.id_cronograma_aplicacao
);

CREATE INDEX IF NOT EXISTS cronograma_aplicacao_etapa_ordem_idx
  ON public.cronograma_aplicacao (id_etapa, ordem);

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

SELECT
  id_etapa,
  COUNT(*) AS total_itens,
  MIN(ordem) AS primeira_ordem,
  MAX(ordem) AS ultima_ordem
FROM public.cronograma_aplicacao
WHERE id_etapa IS NOT NULL
  AND ordem IS NOT NULL
GROUP BY id_etapa
ORDER BY id_etapa;

SELECT
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('cronograma_aplicacao', 'turma_cronograma_aplicacao')
ORDER BY table_name;
