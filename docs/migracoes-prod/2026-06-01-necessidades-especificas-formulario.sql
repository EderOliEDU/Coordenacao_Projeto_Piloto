-- Necessidades especificas do aluno no formulario de observacao.
-- Usado pelo bloco "Questionamentos Iniciais" quando o aluno e PAEE
-- ou quando precisa de apoio pedagogico mesmo nao sendo PAEE.

CREATE TABLE IF NOT EXISTS public.aluno_necessidades_contexto (
  id_aluno integer NOT NULL,
  id_turma integer NOT NULL,
  cpf_professor text NOT NULL,
  paee boolean,
  estudo_caso boolean,
  apoio_pedagogico boolean,
  criada_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  atualizada_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT aluno_necessidades_contexto_pkey
    PRIMARY KEY (id_aluno, id_turma, cpf_professor)
);

ALTER TABLE public.aluno_necessidades_contexto
  ADD COLUMN IF NOT EXISTS estudo_caso boolean;

CREATE TABLE IF NOT EXISTS public.aluno_necessidades_especificas (
  id_aluno_necespecifica bigserial PRIMARY KEY,
  id_aluno integer NOT NULL,
  id_turma integer NOT NULL,
  cpf_professor text NOT NULL,
  id_necespecifica integer,
  tipo text NOT NULL,
  descricao_outros text,
  criada_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT aluno_necessidades_especificas_tipo_check
    CHECK (tipo IN ('PAEE', 'APOIO')),
  CONSTRAINT aluno_necessidades_especificas_necespecifica_fkey
    FOREIGN KEY (id_necespecifica)
    REFERENCES public."necessidades_específicas" (id_necespecifica)
);

CREATE INDEX IF NOT EXISTS idx_aluno_necessidades_especificas_aluno_turma
  ON public.aluno_necessidades_especificas (id_aluno, id_turma);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aluno_necessidades_especificas_unica
  ON public.aluno_necessidades_especificas (id_aluno, id_turma, cpf_professor, id_necespecifica)
  WHERE id_necespecifica IS NOT NULL;
