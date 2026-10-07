-- Garante um unico vinculo professor-turma em public.atribuicao_professor.

DELETE FROM public.atribuicao_professor ap
USING public.atribuicao_professor duplicada
WHERE ap.id_atribuicao > duplicada.id_atribuicao
  AND regexp_replace(ap.cpf_professor::text, '\D', '', 'g') = regexp_replace(duplicada.cpf_professor::text, '\D', '', 'g')
  AND ap.id_turma = duplicada.id_turma;

CREATE UNIQUE INDEX IF NOT EXISTS idx_atribuicao_professor_cpf_turma_unica
  ON public.atribuicao_professor (
    regexp_replace(cpf_professor::text, '\D', '', 'g'),
    id_turma
  );
