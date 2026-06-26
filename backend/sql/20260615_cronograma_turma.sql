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

CREATE INDEX IF NOT EXISTS turma_cronograma_aplicacao_item_idx
  ON public.turma_cronograma_aplicacao (id_cronograma_aplicacao);
