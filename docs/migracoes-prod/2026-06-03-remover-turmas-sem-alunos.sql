-- Remove turmas do projeto PJINSTFONI que nao possuem alunos vinculados.
--
-- O script:
-- 1. identifica turmas sem alunos em public.enturmacao_aluno;
-- 2. confirma se nenhuma delas continua referenciada em import_alunos_csv_staging;
-- 3. move submissoes_pg dessas turmas para a turma atual do aluno, quando existir;
-- 4. remove atribuicoes de professor dessas turmas vazias;
-- 5. remove as turmas vazias.
--
-- Rode primeiro com ROLLBACK. Se a conferencia estiver correta, troque
-- ROLLBACK por COMMIT.

BEGIN;

CREATE TEMP TABLE tmp_turmas_sem_alunos AS
SELECT
  t.id_turma,
  e.nome_escola,
  et.descricao AS etapa,
  t.letra_turma,
  t.turno
FROM public.turmas t
JOIN public.escolas e ON e.id_escola = t.id_escola
JOIN public.etapas et ON et.id_etapa = t.id_etapa
LEFT JOIN public.enturmacao_aluno ea ON ea.id_turma = t.id_turma
WHERE e.projeto = 'PJINSTFONI'
  AND et.projeto = 'PJINSTFONI'
GROUP BY t.id_turma, e.nome_escola, et.descricao, t.letra_turma, t.turno
HAVING COUNT(ea.id_aluno) = 0;

-- Conferencia antes da exclusao.
SELECT COUNT(*) AS turmas_sem_alunos_para_remover
FROM tmp_turmas_sem_alunos;

SELECT COUNT(*) AS referencias_na_staging
FROM public.import_alunos_csv_staging s
JOIN tmp_turmas_sem_alunos tsa ON tsa.id_turma = s.id_turma;

SELECT
  'atribuicao_professor' AS tabela,
  COUNT(*) AS vinculos
FROM public.atribuicao_professor ap
JOIN tmp_turmas_sem_alunos tsa ON tsa.id_turma = ap.id_turma
UNION ALL
SELECT
  'submissoes_pg' AS tabela,
  COUNT(*) AS vinculos
FROM public.submissoes_pg sp
JOIN tmp_turmas_sem_alunos tsa ON tsa.id_turma = sp.id_turma;

-- Move submissoes para a turma atual do aluno antes de apagar as turmas vazias.
WITH mover AS (
  SELECT
    sp.id AS submissao_id,
    ea.id_turma AS nova_turma
  FROM public.submissoes_pg sp
  JOIN tmp_turmas_sem_alunos tsa ON tsa.id_turma = sp.id_turma
  JOIN public.enturmacao_aluno ea ON ea.id_aluno = sp.id_aluno
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.submissoes_pg existente
    WHERE existente.cpf_professor = sp.cpf_professor
      AND existente.id_turma = ea.id_turma
      AND existente.id_aluno = sp.id_aluno
      AND existente.formulario_id = sp.formulario_id
      AND existente.id <> sp.id
  )
)
UPDATE public.submissoes_pg sp
SET id_turma = mover.nova_turma
FROM mover
WHERE sp.id = mover.submissao_id;

-- Se sobrar submissao em turma vazia, ela precisa de analise manual.
SELECT
  sp.id,
  sp.id_turma,
  sp.id_aluno,
  sp.cpf_professor,
  sp.formulario_id,
  sp.status
FROM public.submissoes_pg sp
JOIN tmp_turmas_sem_alunos tsa ON tsa.id_turma = sp.id_turma
ORDER BY sp.id;

DELETE FROM public.atribuicao_professor ap
USING tmp_turmas_sem_alunos tsa
WHERE ap.id_turma = tsa.id_turma;

DELETE FROM public.turmas t
USING tmp_turmas_sem_alunos tsa
WHERE t.id_turma = tsa.id_turma
  AND NOT EXISTS (
    SELECT 1
    FROM public.enturmacao_aluno ea
    WHERE ea.id_turma = t.id_turma
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.import_alunos_csv_staging s
    WHERE s.id_turma = t.id_turma
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.submissoes_pg sp
    WHERE sp.id_turma = t.id_turma
  );

-- Conferencia depois da exclusao.
WITH restantes AS (
  SELECT t.id_turma
  FROM public.turmas t
  JOIN public.escolas e ON e.id_escola = t.id_escola
  JOIN public.etapas et ON et.id_etapa = t.id_etapa
  LEFT JOIN public.enturmacao_aluno ea ON ea.id_turma = t.id_turma
  WHERE e.projeto = 'PJINSTFONI'
    AND et.projeto = 'PJINSTFONI'
  GROUP BY t.id_turma
  HAVING COUNT(ea.id_aluno) = 0
)
SELECT COUNT(*) AS turmas_sem_alunos_restantes
FROM restantes;

-- Se a conferencia estiver correta, troque ROLLBACK por COMMIT.
ROLLBACK;
