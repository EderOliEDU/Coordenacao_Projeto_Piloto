BEGIN;
SET LOCAL lock_timeout='10s';
LOCK TABLE public.avaliacao_aplicador_respostas, public.avaliacao_aplicador_aplicacoes IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE audit_respostas ON COMMIT DROP AS
SELECT id_resposta, to_jsonb(r)-'nome_escrito' AS conteudo FROM public.avaliacao_aplicador_respostas r;
CREATE TEMP TABLE audit_aplicacoes ON COMMIT DROP AS
SELECT id_aplicacao, to_jsonb(a)-'exige_detalhe_nome' AS conteudo FROM public.avaliacao_aplicador_aplicacoes a;

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

DO $$ BEGIN
IF EXISTS (SELECT 1 FROM audit_respostas b FULL JOIN public.avaliacao_aplicador_respostas r USING(id_resposta)
WHERE b.conteudo IS DISTINCT FROM (to_jsonb(r)-'nome_escrito')) THEN RAISE EXCEPTION 'Respostas históricas divergentes'; END IF;
IF EXISTS (SELECT 1 FROM audit_aplicacoes b FULL JOIN public.avaliacao_aplicador_aplicacoes a USING(id_aplicacao)
WHERE b.conteudo IS DISTINCT FROM (to_jsonb(a)-'exige_detalhe_nome')) THEN RAISE EXCEPTION 'Aplicações históricas divergentes'; END IF;
IF (SELECT count(*) FROM public.avaliacao_aplicador_opcoes o JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta) WHERE p.codigo='NIVEL_ESCRITA' AND o.codigo='NAO_ESCREVEU' AND o.ativo) <> 1 THEN RAISE EXCEPTION 'Opção da questão 8 não confirmada'; END IF;
END $$;
COMMIT;
