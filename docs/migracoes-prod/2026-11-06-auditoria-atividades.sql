BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout = '10s';
CREATE TEMP TABLE auditoria_preservacao_release(tabela text PRIMARY KEY, quantidade bigint, assinatura text) ON COMMIT DROP;
DO $$
DECLARE tabela text; quantidade bigint; assinatura text;
BEGIN
 FOREACH tabela IN ARRAY ARRAY['submissoes_pg','avaliacao_respostas','aluno_necessidades_contexto',
  'aluno_necessidades_especificas','avaliacao_aplicador_aplicacoes','avaliacao_aplicador_respostas',
  'avaliacao_aplicador_vogais','avaliacao_aplicador_leitura_respostas','auditoria_atividades'] LOOP
  IF to_regclass('public.' || tabela) IS NOT NULL THEN
  EXECUTE format($consulta$SELECT count(*),md5(COALESCE(string_agg(md5(to_jsonb(r)::text),'' ORDER BY md5(to_jsonb(r)::text)),'')) FROM public.%I r$consulta$,tabela)
    INTO quantidade,assinatura;
   INSERT INTO auditoria_preservacao_release VALUES(tabela,quantidade,assinatura);
  ELSIF tabela <> 'auditoria_atividades' THEN
   RAISE EXCEPTION 'Pré-requisito ausente: %',tabela;
  END IF;
 END LOOP;
END;
$$;
CREATE TABLE IF NOT EXISTS public.auditoria_atividades (
 id bigserial PRIMARY KEY,
 ocorrido_em timestamptz NOT NULL DEFAULT clock_timestamp(),
 requisicao_id uuid NOT NULL,
 autor_cpf text NOT NULL,
 autor_nome text NOT NULL,
 responsavel_cpf text NOT NULL,
 tipo text NOT NULL CHECK (tipo IN ('FORMULARIO','VERIFICACAO')),
 evento text NOT NULL CHECK (evento IN ('CONFIRMACAO','ALTERACAO')),
 fase_id integer NOT NULL,
 turma_id integer,
 aluno_id integer,
 aplicacao_id integer,
 metodo text NOT NULL,
 rota text NOT NULL,
 ip text,
 antes jsonb,
 depois jsonb
);
CREATE INDEX IF NOT EXISTS auditoria_atividades_contexto_idx
 ON public.auditoria_atividades (fase_id,turma_id,aluno_id,ocorrido_em DESC,id DESC);
CREATE INDEX IF NOT EXISTS auditoria_atividades_autor_idx
 ON public.auditoria_atividades (autor_cpf,ocorrido_em DESC,id DESC);
CREATE OR REPLACE FUNCTION public.proteger_auditoria_atividades() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'O histórico de auditoria não pode ser alterado ou apagado';
END;
$$;
DROP TRIGGER IF EXISTS auditoria_atividades_imutavel ON public.auditoria_atividades;
CREATE TRIGGER auditoria_atividades_imutavel BEFORE UPDATE OR DELETE OR TRUNCATE
 ON public.auditoria_atividades FOR EACH STATEMENT EXECUTE FUNCTION public.proteger_auditoria_atividades();
DO $$
DECLARE anterior record; quantidade bigint; assinatura text;
BEGIN
 FOR anterior IN SELECT * FROM auditoria_preservacao_release LOOP
  EXECUTE format($consulta$SELECT count(*),md5(COALESCE(string_agg(md5(to_jsonb(r)::text),'' ORDER BY md5(to_jsonb(r)::text)),'')) FROM public.%I r$consulta$,anterior.tabela)
   INTO quantidade,assinatura;
  IF quantidade IS DISTINCT FROM anterior.quantidade OR assinatura IS DISTINCT FROM anterior.assinatura THEN
   RAISE EXCEPTION 'Dados divergentes após migração: %',anterior.tabela;
  END IF;
  RAISE NOTICE 'Preservado: % (% registros)',anterior.tabela,quantidade;
 END LOOP;
END;
$$;
COMMIT;
