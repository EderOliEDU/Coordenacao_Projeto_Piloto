-- Corrige o mapeamento da importacao de alunos usando os de/para oficiais.
-- Objetivo:
-- 1. usar public.de_para_escolas para resolver id_escola;
-- 2. usar public.de_para_turmas para resolver id_etapa, multi-etapa e letra;
-- 3. usar import_alunos_csv_staging.turno_original para distinguir turmas;
-- 4. atualizar staging, dados textuais dos alunos e enturmacao_aluno.
--
-- Rode primeiro os SELECTs de conferencia no final do arquivo. Se o resultado
-- estiver correto, execute dentro de uma transacao e finalize com COMMIT.

BEGIN;

WITH mapa AS (
  SELECT
    s.id_import,
    s.id_aluno,
    dpe.id_escola,
    dpe.escola_corrigida,
    dpt.id_etapas AS id_etapa,
    dpt.id_multi_etapas AS id_multi_etapa,
    dpt.turma_corrigida,
    UPPER(TRIM(s.turno_original)) AS turno_corrigido
  FROM public.import_alunos_csv_staging s
  JOIN public.de_para_escolas dpe
    ON TRIM(dpe.escola_original) = TRIM(s.escola_original)
  JOIN public.de_para_turmas dpt
    ON REGEXP_REPLACE(UPPER(TRIM(dpt.turma_original)), '[^[:alnum:]]+', '', 'g')
     = REGEXP_REPLACE(UPPER(TRIM(s.turma_original)), '[^[:alnum:]]+', '', 'g')
  WHERE s.id_aluno IS NOT NULL
    AND NULLIF(TRIM(s.turno_original), '') IS NOT NULL
)
UPDATE public.turmas t
SET turno = mapa.turno_corrigido
FROM mapa
WHERE t.id_escola = mapa.id_escola
  AND t.id_etapa = mapa.id_etapa
  AND COALESCE(t.id_multi_etapa, -1) = COALESCE(mapa.id_multi_etapa, -1)
  AND TRIM(t.letra_turma) = TRIM(mapa.turma_corrigida)
  AND NULLIF(TRIM(COALESCE(t.turno, '')), '') IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.turmas existente
    WHERE existente.id_escola = t.id_escola
      AND existente.id_etapa = t.id_etapa
      AND COALESCE(existente.id_multi_etapa, -1) = COALESCE(t.id_multi_etapa, -1)
      AND TRIM(existente.letra_turma) = TRIM(t.letra_turma)
      AND UPPER(TRIM(existente.turno)) = mapa.turno_corrigido
  );

WITH mapa AS (
  SELECT
    s.id_import,
    s.id_aluno,
    dpe.id_escola,
    dpe.escola_corrigida,
    dpt.id_etapas AS id_etapa,
    dpt.id_multi_etapas AS id_multi_etapa,
    dpt.turma_corrigida,
    UPPER(TRIM(s.turno_original)) AS turno_corrigido
  FROM public.import_alunos_csv_staging s
  JOIN public.de_para_escolas dpe
    ON TRIM(dpe.escola_original) = TRIM(s.escola_original)
  JOIN public.de_para_turmas dpt
    ON REGEXP_REPLACE(UPPER(TRIM(dpt.turma_original)), '[^[:alnum:]]+', '', 'g')
     = REGEXP_REPLACE(UPPER(TRIM(s.turma_original)), '[^[:alnum:]]+', '', 'g')
  WHERE s.id_aluno IS NOT NULL
    AND NULLIF(TRIM(s.turno_original), '') IS NOT NULL
),
turma_destino AS (
  SELECT
    mapa.*,
    t.id_turma
  FROM mapa
  JOIN public.turmas t
    ON t.id_escola = mapa.id_escola
   AND t.id_etapa = mapa.id_etapa
   AND COALESCE(t.id_multi_etapa, -1) = COALESCE(mapa.id_multi_etapa, -1)
   AND TRIM(t.letra_turma) = TRIM(mapa.turma_corrigida)
   AND UPPER(TRIM(t.turno)) = mapa.turno_corrigido
)
UPDATE public.import_alunos_csv_staging s
SET
  id_escola = turma_destino.id_escola,
  id_etapa = turma_destino.id_etapa,
  id_multi_etapa = turma_destino.id_multi_etapa,
  turma_corrigida = turma_destino.turma_corrigida,
  id_turma = turma_destino.id_turma
FROM turma_destino
WHERE s.id_import = turma_destino.id_import;

WITH staging_unica AS (
  SELECT DISTINCT ON (id_aluno)
    id_aluno,
    escola_original,
    serie_original,
    turma_original,
    turno_original
  FROM public.import_alunos_csv_staging
  WHERE id_aluno IS NOT NULL
  ORDER BY id_aluno, id_import DESC
)
UPDATE public.alunos a
SET
  escola = staging_unica.escola_original,
  serie = staging_unica.serie_original,
  turma = staging_unica.turma_original,
  turno = UPPER(TRIM(staging_unica.turno_original))
FROM staging_unica
WHERE a.id_aluno = staging_unica.id_aluno;

WITH staging_unica AS (
  SELECT DISTINCT ON (id_aluno)
    id_aluno,
    id_turma
  FROM public.import_alunos_csv_staging
  WHERE id_aluno IS NOT NULL
    AND id_turma IS NOT NULL
  ORDER BY id_aluno, id_import DESC
)
UPDATE public.enturmacao_aluno ea
SET id_turma = staging_unica.id_turma
FROM staging_unica
WHERE ea.id_aluno = staging_unica.id_aluno
  AND ea.id_turma <> staging_unica.id_turma;

-- Conferencia 1: registros da staging que ainda ficaram sem turma resolvida.
SELECT
  s.escola_original,
  s.turma_original,
  s.turno_original,
  COUNT(*) AS alunos_sem_turma_resolvida
FROM public.import_alunos_csv_staging s
WHERE s.id_aluno IS NOT NULL
  AND s.id_turma IS NULL
GROUP BY s.escola_original, s.turma_original, s.turno_original
ORDER BY alunos_sem_turma_resolvida DESC, s.escola_original, s.turma_original, s.turno_original;

-- Conferencia 2: turmas do projeto que ainda ficaram com quantidade muito alta.
SELECT
  e.nome_escola,
  et.descricao AS etapa,
  t.letra_turma,
  t.turno,
  COUNT(DISTINCT ea.id_aluno) AS alunos
FROM public.turmas t
JOIN public.escolas e ON e.id_escola = t.id_escola
JOIN public.etapas et ON et.id_etapa = t.id_etapa
LEFT JOIN public.enturmacao_aluno ea ON ea.id_turma = t.id_turma
WHERE e.projeto = 'PJINSTFONI'
  AND et.projeto = 'PJINSTFONI'
GROUP BY e.nome_escola, et.descricao, t.letra_turma, t.turno
HAVING COUNT(DISTINCT ea.id_aluno) >= 35
ORDER BY alunos DESC, e.nome_escola, et.descricao, t.letra_turma, t.turno;

-- Conferencia 3: resumo geral das turmas com alunos apos a correcao.
SELECT
  e.nome_escola,
  et.descricao AS etapa,
  t.letra_turma,
  t.turno,
  COUNT(DISTINCT ea.id_aluno) AS alunos
FROM public.turmas t
JOIN public.escolas e ON e.id_escola = t.id_escola
JOIN public.etapas et ON et.id_etapa = t.id_etapa
JOIN public.enturmacao_aluno ea ON ea.id_turma = t.id_turma
WHERE e.projeto = 'PJINSTFONI'
  AND et.projeto = 'PJINSTFONI'
GROUP BY e.nome_escola, et.descricao, t.letra_turma, t.turno
ORDER BY e.nome_escola, et.descricao, t.letra_turma, t.turno;

-- Se a conferencia estiver correta, troque ROLLBACK por COMMIT.
ROLLBACK;
