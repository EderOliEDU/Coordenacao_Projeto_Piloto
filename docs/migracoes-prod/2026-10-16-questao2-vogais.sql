-- Executar com ON_ERROR_STOP. A transação preserva integralmente os registros antigos.
BEGIN;
SET LOCAL lock_timeout = '10s';
LOCK TABLE public.avaliacao_aplicador_aplicacoes IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.avaliacao_aplicador_respostas IN SHARE MODE;

ALTER TABLE public.avaliacao_aplicador_aplicacoes
  ADD COLUMN IF NOT EXISTS versao_instrumento smallint NOT NULL DEFAULT 1
    CHECK (versao_instrumento IN (1, 2));
ALTER TABLE public.avaliacao_aplicador_aplicacoes ALTER COLUMN versao_instrumento SET DEFAULT 2;

CREATE TABLE IF NOT EXISTS public.avaliacao_aplicador_vogais (
  id_aplicacao bigint NOT NULL REFERENCES public.avaliacao_aplicador_aplicacoes(id_aplicacao),
  id_pergunta bigint NOT NULL REFERENCES public.avaliacao_aplicador_perguntas(id_pergunta),
  vogal char(1) NOT NULL CHECK (vogal IN ('A','E','I','O','U')),
  acertou boolean,
  origem text NOT NULL CHECK (origem IN ('LEGADO','NOVO','NAO_APRESENTADA')),
  respondido_em timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_aplicacao, id_pergunta, vogal),
  CHECK ((acertou IS NULL AND origem = 'NAO_APRESENTADA' AND respondido_em IS NULL)
    OR (acertou IS NOT NULL AND origem IN ('LEGADO','NOVO') AND respondido_em IS NOT NULL))
);

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.avaliacao_aplicador_respostas r
    JOIN public.avaliacao_aplicador_perguntas p USING (id_pergunta)
    JOIN public.avaliacao_aplicador_opcoes o USING (id_opcao)
    WHERE p.codigo = 'ALITERACAO'
      AND (upper(trim(coalesce(r.letra_aplicada,''))) NOT IN ('A','E','I','O','U')
        OR o.codigo NOT IN ('SIM','NAO'))
  ) THEN RAISE EXCEPTION 'Há respostas legadas da Q2 inválidas; revisar antes de migrar'; END IF;
END $$;

INSERT INTO public.avaliacao_aplicador_vogais
  (id_aplicacao,id_pergunta,vogal,acertou,origem,respondido_em,atualizado_em)
SELECT a.id_aplicacao,p.id_pergunta,v.vogal,
  CASE WHEN upper(trim(r.letra_aplicada))=v.vogal THEN o.codigo='SIM' END,
  CASE WHEN upper(trim(r.letra_aplicada))=v.vogal THEN 'LEGADO' ELSE 'NAO_APRESENTADA' END,
  CASE WHEN upper(trim(r.letra_aplicada))=v.vogal THEN r.respondido_em END,
  COALESCE(r.atualizado_em,CURRENT_TIMESTAMP)
FROM public.avaliacao_aplicador_aplicacoes a
CROSS JOIN public.avaliacao_aplicador_perguntas p
CROSS JOIN (VALUES ('A'),('E'),('I'),('O'),('U')) v(vogal)
LEFT JOIN public.avaliacao_aplicador_respostas r ON r.id_aplicacao=a.id_aplicacao AND r.id_pergunta=p.id_pergunta
LEFT JOIN public.avaliacao_aplicador_opcoes o ON o.id_opcao=r.id_opcao
WHERE p.codigo='ALITERACAO' AND a.versao_instrumento=1
ON CONFLICT DO NOTHING;

-- Uma única habilidade por aplicação. NULL não entra no denominador.
CREATE OR REPLACE VIEW public.avaliacao_aplicador_vogais_resumo AS
SELECT id_aplicacao,id_pergunta,
  count(acertou)::integer AS avaliadas,
  count(*) FILTER (WHERE acertou IS TRUE)::integer AS acertos,
  count(*) FILTER (WHERE acertou IS FALSE)::integer AS erros,
  avg(acertou::integer) AS desempenho,
  count(acertou)::numeric / 5 AS cobertura
FROM public.avaliacao_aplicador_vogais GROUP BY id_aplicacao,id_pergunta;
COMMIT;
