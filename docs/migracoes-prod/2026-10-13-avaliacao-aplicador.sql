-- Estrutura do módulo de aplicadores validada no DB-DEV em 13/10/2026.
-- Não copia alunos, usuários, atribuições, aplicações, respostas ou áudios do DEV.
-- Pré-requisitos: cadastros do projeto, usuarios_acessos e avaliacao_fases já existentes.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL search_path = public;
SELECT pg_advisory_xact_lock(hashtext('release-avaliacao-aplicador'));

CREATE TABLE IF NOT EXISTS public.avaliacao_aplicador_perguntas (
  id_pergunta bigserial NOT NULL,
  codigo character varying(50) NOT NULL,
  ordem integer NOT NULL,
  habilidade character varying(100) NOT NULL,
  pergunta text NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT avaliacao_aplicador_perguntas_pkey PRIMARY KEY (id_pergunta),
  CONSTRAINT avaliacao_aplicador_perguntas_codigo_key UNIQUE (codigo),
  CONSTRAINT avaliacao_aplicador_perguntas_ordem_key UNIQUE (ordem)
);

CREATE TABLE IF NOT EXISTS public.avaliacao_aplicador_opcoes (
  id_opcao bigserial NOT NULL,
  id_pergunta bigint NOT NULL,
  codigo character varying(50) NOT NULL,
  descricao character varying(200) NOT NULL,
  detalhamento text,
  ordem integer NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  CONSTRAINT avaliacao_aplicador_opcoes_pergunta_fkey FOREIGN KEY (id_pergunta) REFERENCES public.avaliacao_aplicador_perguntas(id_pergunta) ON DELETE RESTRICT,
  CONSTRAINT avaliacao_aplicador_opcoes_pkey PRIMARY KEY (id_opcao),
  CONSTRAINT avaliacao_aplicador_opcoes_codigo_unique UNIQUE (id_pergunta, codigo),
  CONSTRAINT avaliacao_aplicador_opcoes_pergunta_opcao_unique UNIQUE (id_pergunta, id_opcao)
);

CREATE TABLE IF NOT EXISTS public.avaliacao_aplicador_leitura_palavras (
  id_palavra serial NOT NULL,
  palavra text NOT NULL,
  ordem integer NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  CONSTRAINT avaliacao_aplicador_leitura_palavras_pkey PRIMARY KEY (id_palavra),
  CONSTRAINT uq_avaliacao_aplicador_leitura_ordem UNIQUE (ordem),
  CONSTRAINT uq_avaliacao_aplicador_leitura_palavra UNIQUE (palavra)
);

CREATE TABLE IF NOT EXISTS public.avaliacao_aplicador_atribuicoes (
  id_atribuicao bigserial NOT NULL,
  id_fase integer NOT NULL,
  id_turma integer NOT NULL,
  cpf_aplicador text NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  criado_por text,
  criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  atualizado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT avaliacao_aplicador_atribuicoes_cpf_check CHECK ((cpf_aplicador ~ '^[0-9]{11}$'::text)),
  CONSTRAINT avaliacao_aplicador_atribuicoes_aplicador_fkey FOREIGN KEY (cpf_aplicador) REFERENCES public.professores(profissional_cpf) ON DELETE RESTRICT,
  CONSTRAINT avaliacao_aplicador_atribuicoes_fase_fkey FOREIGN KEY (id_fase) REFERENCES public.avaliacao_fases(id_fase) ON DELETE RESTRICT,
  CONSTRAINT avaliacao_aplicador_atribuicoes_turma_fkey FOREIGN KEY (id_turma) REFERENCES public.turmas(id_turma) ON DELETE RESTRICT,
  CONSTRAINT avaliacao_aplicador_atribuicoes_pkey PRIMARY KEY (id_atribuicao)
);

CREATE TABLE IF NOT EXISTS public.avaliacao_aplicador_aplicacoes (
  id_aplicacao bigserial NOT NULL,
  id_aluno integer NOT NULL,
  id_turma integer NOT NULL,
  cpf_aplicador text NOT NULL,
  status text DEFAULT 'PENDENTE'::text NOT NULL,
  criado_por text,
  criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  iniciado_em timestamp with time zone,
  concluido_em timestamp with time zone,
  atualizado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  id_fase integer,
  observacao text,
  CONSTRAINT avaliacao_aplicador_aplicacoes_cpf_check CHECK ((cpf_aplicador ~ '^[0-9]{11}$'::text)),
  CONSTRAINT avaliacao_aplicador_aplicacoes_status_check CHECK ((status = ANY (ARRAY['PENDENTE'::text, 'EM_ANDAMENTO'::text, 'CONCLUIDA'::text, 'CANCELADA'::text]))),
  CONSTRAINT avaliacao_aplicador_aplicacoes_aluno_fkey FOREIGN KEY (id_aluno) REFERENCES public.alunos(id_aluno) ON DELETE RESTRICT,
  CONSTRAINT avaliacao_aplicador_aplicacoes_aplicador_fkey FOREIGN KEY (cpf_aplicador) REFERENCES public.professores(profissional_cpf) ON DELETE RESTRICT,
  CONSTRAINT avaliacao_aplicador_aplicacoes_fase_fkey FOREIGN KEY (id_fase) REFERENCES public.avaliacao_fases(id_fase) ON DELETE RESTRICT,
  CONSTRAINT avaliacao_aplicador_aplicacoes_turma_fkey FOREIGN KEY (id_turma) REFERENCES public.turmas(id_turma) ON DELETE RESTRICT,
  CONSTRAINT avaliacao_aplicador_aplicacoes_pkey PRIMARY KEY (id_aplicacao)
);

CREATE TABLE IF NOT EXISTS public.avaliacao_aplicador_respostas (
  id_resposta bigserial NOT NULL,
  id_aplicacao bigint NOT NULL,
  id_pergunta bigint NOT NULL,
  id_opcao bigint NOT NULL,
  respondido_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  atualizado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  letra_aplicada character varying(1),
  CONSTRAINT avaliacao_aplicador_respostas_aplicacao_fkey FOREIGN KEY (id_aplicacao) REFERENCES public.avaliacao_aplicador_aplicacoes(id_aplicacao) ON DELETE RESTRICT,
  CONSTRAINT avaliacao_aplicador_respostas_opcao_pergunta_fkey FOREIGN KEY (id_pergunta, id_opcao) REFERENCES public.avaliacao_aplicador_opcoes(id_pergunta, id_opcao) ON DELETE RESTRICT,
  CONSTRAINT avaliacao_aplicador_respostas_pergunta_fkey FOREIGN KEY (id_pergunta) REFERENCES public.avaliacao_aplicador_perguntas(id_pergunta) ON DELETE RESTRICT,
  CONSTRAINT avaliacao_aplicador_respostas_pkey PRIMARY KEY (id_resposta),
  CONSTRAINT avaliacao_aplicador_respostas_unique UNIQUE (id_aplicacao, id_pergunta)
);

CREATE TABLE IF NOT EXISTS public.avaliacao_aplicador_leitura_respostas (
  id_resposta bigserial NOT NULL,
  id_aplicacao bigint NOT NULL,
  id_palavra integer NOT NULL,
  classificacao text NOT NULL,
  audio_arquivo text,
  audio_mime_type text,
  audio_tamanho bigint,
  respondido_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  atualizado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT ck_leitura_classificacao CHECK ((classificacao = ANY (ARRAY['NAO_UTILIZA_SONS'::text, 'UTILIZA_ALGUNS_SONS'::text, 'DECODIFICA'::text, 'LE_AUTONOMIA'::text, 'NAO_RESPONDEU'::text]))),
  CONSTRAINT fk_leitura_aplicacao FOREIGN KEY (id_aplicacao) REFERENCES public.avaliacao_aplicador_aplicacoes(id_aplicacao) ON DELETE RESTRICT,
  CONSTRAINT fk_leitura_palavra FOREIGN KEY (id_palavra) REFERENCES public.avaliacao_aplicador_leitura_palavras(id_palavra) ON DELETE RESTRICT,
  CONSTRAINT avaliacao_aplicador_leitura_respostas_pkey PRIMARY KEY (id_resposta),
  CONSTRAINT uq_leitura_aplicacao_palavra UNIQUE (id_aplicacao, id_palavra)
);

-- Evolução de instalações anteriores, sem modificar registros históricos.
ALTER TABLE public.avaliacao_aplicador_aplicacoes ADD COLUMN IF NOT EXISTS id_fase integer REFERENCES public.avaliacao_fases(id_fase);
ALTER TABLE public.avaliacao_aplicador_aplicacoes ADD COLUMN IF NOT EXISTS observacao text;
ALTER TABLE public.avaliacao_aplicador_respostas ADD COLUMN IF NOT EXISTS letra_aplicada character varying(1);

-- Se houver aplicações ativas duplicadas, a criação falha e a transação é revertida.
DROP INDEX IF EXISTS public.idx_aplicador_aplicacao_unica;
CREATE UNIQUE INDEX idx_aplicador_aplicacao_unica ON public.avaliacao_aplicador_aplicacoes USING btree (id_fase, id_aluno, id_turma) WHERE ((status <> 'CANCELADA'::text) AND (id_fase IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_aplicador_aplicacoes_aluno ON public.avaliacao_aplicador_aplicacoes USING btree (id_aluno);
CREATE INDEX IF NOT EXISTS idx_aplicador_aplicacoes_cpf_status ON public.avaliacao_aplicador_aplicacoes USING btree (cpf_aplicador, status);
CREATE INDEX IF NOT EXISTS idx_aplicador_aplicacoes_fase ON public.avaliacao_aplicador_aplicacoes USING btree (id_fase);
CREATE INDEX IF NOT EXISTS idx_aplicador_aplicacoes_turma ON public.avaliacao_aplicador_aplicacoes USING btree (id_turma);
CREATE UNIQUE INDEX IF NOT EXISTS avaliacao_aplicador_atribuicoes_unique ON public.avaliacao_aplicador_atribuicoes USING btree (id_fase, id_turma, cpf_aplicador);
CREATE INDEX IF NOT EXISTS idx_aplicador_respostas_aplicacao ON public.avaliacao_aplicador_respostas USING btree (id_aplicacao);

-- Permite cadastrar o perfil APLICADOR nas instalações antigas.
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='public.usuarios_acessos'::regclass
    AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%perfil%' AND pg_get_constraintdef(oid) NOT ILIKE '%id_escola%' AND pg_get_constraintdef(oid) NOT ILIKE '%APLICADOR%'
  LOOP EXECUTE format('ALTER TABLE public.usuarios_acessos DROP CONSTRAINT %I', item.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.usuarios_acessos'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%perfil%' AND pg_get_constraintdef(oid) NOT ILIKE '%id_escola%' AND pg_get_constraintdef(oid) ILIKE '%APLICADOR%') THEN
    ALTER TABLE public.usuarios_acessos ADD CONSTRAINT usuarios_acessos_perfil_check CHECK (perfil IN ('SUPERADMIN','ADMINISTRADOR','COORDENADOR','DIRETOR','APLICADOR'));
  END IF; END $$;
ALTER TABLE public.usuarios_acessos DROP CONSTRAINT IF EXISTS usuarios_acessos_escopo_check;
ALTER TABLE public.usuarios_acessos ADD CONSTRAINT usuarios_acessos_escopo_check CHECK (
  (perfil IN ('SUPERADMIN','ADMINISTRADOR','APLICADOR') AND id_escola IS NULL)
  OR (perfil IN ('COORDENADOR','DIRETOR') AND id_escola IS NOT NULL)
);
-- Migração das atribuições anteriores, baseada apenas nas aplicações deste banco.
-- Não reativa atribuições já desativadas, nem importa qualquer registro do DEV.
INSERT INTO public.avaliacao_aplicador_atribuicoes
  (id_fase,id_turma,cpf_aplicador,ativo,criado_por,criado_em,atualizado_em)
SELECT id_fase,id_turma,cpf_aplicador,true,min(criado_por),min(criado_em),max(atualizado_em)
FROM public.avaliacao_aplicador_aplicacoes
WHERE id_fase IS NOT NULL AND status <> 'CANCELADA'
GROUP BY id_fase,id_turma,cpf_aplicador
ON CONFLICT (id_fase,id_turma,cpf_aplicador) DO NOTHING;
COMMIT;
