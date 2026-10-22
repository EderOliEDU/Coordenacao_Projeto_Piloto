BEGIN;
SET LOCAL lock_timeout='10s';
ALTER TABLE public.avaliacao_aplicador_respostas
  ADD COLUMN IF NOT EXISTS nome_escrito text
    CHECK (nome_escrito IN ('NOME','NOME_COMPOSTO','NOME_COMPLETO'));
-- Não inferir o detalhamento das respostas históricas.
ALTER TABLE public.avaliacao_aplicador_aplicacoes
  ADD COLUMN IF NOT EXISTS exige_detalhe_nome boolean NOT NULL DEFAULT false;
ALTER TABLE public.avaliacao_aplicador_aplicacoes
  ALTER COLUMN exige_detalhe_nome SET DEFAULT true;
INSERT INTO public.avaliacao_aplicador_opcoes(id_pergunta,codigo,descricao,detalhamento,ordem,ativo)
SELECT id_pergunta,'NAO_ESCREVEU','NÃO ESCREVEU',NULL,5,true
FROM public.avaliacao_aplicador_perguntas WHERE codigo='NIVEL_ESCRITA'
ON CONFLICT(id_pergunta,codigo) DO UPDATE SET descricao=EXCLUDED.descricao,ativo=true;
COMMIT;
