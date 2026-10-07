-- Consulta: observacao final do questionario por escola e agrupamento.
-- Uso no DBeaver:
-- 1. Altere os valores da CTE "parametros".
-- 2. Execute o script completo.
--
-- O campo correto da observacao final do aluno e:
--   public.submissoes_pg.observacoes
--
-- Esta consulta NAO usa public.avaliacao_respostas.observacao, porque esse campo
-- acabou repetindo a mesma observacao para cada pergunta.

WITH parametros AS (
  SELECT
    '145'::text AS codigo_escola,          -- id_escola
    '5º Agrupamento'::text AS agrupamento, -- public.etapas.descricao
    NULL::integer AS fase_id,              -- exemplo: 1; deixe NULL para todas
    true::boolean AS somente_com_observacao
)
SELECT
  e.nome_escola AS nome_escola,
  et.descricao AS etapa_aluno,
  a.nome AS nome_aluno,
  s.observacoes AS observacao_final_questionario,

  -- Campos de conferencia, pode ocultar no DBeaver se nao precisar.
  e.id_escola,
  t.id_turma,
  ('Turma ' || et.descricao || ' ' || COALESCE(NULLIF(t.letra_turma::text, ''), t.id_turma::text)) AS turma,
  t.turno,
  af.id_fase,
  af.nome AS fase,
  s.status AS status_questionario,
  s.atualizada_em AS atualizado_em,
  a.id_aluno,
  a.cpf AS aluno_cpf
FROM public.submissoes_pg s
JOIN public.turmas t
  ON t.id_turma = s.id_turma
JOIN public.escolas e
  ON e.id_escola = t.id_escola
JOIN public.etapas et
  ON et.id_etapa = t.id_etapa
JOIN public.alunos a
  ON a.id_aluno = s.id_aluno
LEFT JOIN public.avaliacao_fases af
  ON af.id_fase = s.id_fase
CROSS JOIN parametros prm
WHERE e.projeto = 'PJINSTFONI'
  AND et.projeto = 'PJINSTFONI'
  AND e.id_escola::text = prm.codigo_escola
  AND lower(trim(et.descricao::text)) = lower(trim(prm.agrupamento))
  AND (prm.fase_id IS NULL OR s.id_fase = prm.fase_id)
  AND (
    prm.somente_com_observacao = false
    OR NULLIF(trim(COALESCE(s.observacoes, '')), '') IS NOT NULL
  )
ORDER BY
  e.nome_escola,
  et.descricao,
  t.letra_turma NULLS LAST,
  t.turno NULLS LAST,
  a.nome;

-- Consulta auxiliar para encontrar o codigo/id da escola.
/*
SELECT id_escola, nome_escola, projeto
FROM public.escolas
WHERE projeto = 'PJINSTFONI'
ORDER BY nome_escola;
*/

-- Consulta auxiliar para conferir os agrupamentos/etapas disponiveis.
/*
SELECT id_etapa, descricao, projeto
FROM public.etapas
WHERE projeto = 'PJINSTFONI'
ORDER BY descricao;
*/
