-- =============================================================================
-- Migração PostgreSQL: projPiloto
-- Adiciona colunas de autenticação à tabela public.usuarios e cria tabelas
-- de dados escolares (escolas, turmas, alunos) se ainda não existirem.
--
-- Execute como o usuário dono do banco (ex.: userprojetopiloto):
--   psql -h 172.17.2.40 -U userprojetopiloto -d projPiloto -f migrate-pg.sql
-- =============================================================================

-- ── 1) Adicionar colunas de autenticação em public.usuarios ─────────────────
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS senha_hash         text,
  ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT true;

-- Índice único parcial em CPF (ignora linhas com CPF NULL)
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_cpf_unique
  ON public.usuarios (cpf)
  WHERE cpf IS NOT NULL;

-- ── 2) Tabela de escolas ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.escolas (
  id_escola   serial PRIMARY KEY,
  nome_escola text   NOT NULL,
  CONSTRAINT escolas_nome_escola_key UNIQUE (nome_escola)
);

-- ── 3) Tabela de turmas ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.turmas (
  id_turma   serial PRIMARY KEY,
  nome_turma text    NOT NULL,
  turno      text,
  id_escola  integer NOT NULL REFERENCES public.escolas (id_escola) ON DELETE CASCADE,
  CONSTRAINT turmas_nome_turno_escola_key UNIQUE (nome_turma, turno, id_escola)
);

-- ── 4) Tabela de alunos ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alunos (
  id_aluno  serial PRIMARY KEY,
  inep      text,
  nome      text    NOT NULL,
  cpf       text,
  situacao  text,
  id_turma  integer REFERENCES public.turmas (id_turma) ON DELETE SET NULL
);

-- Índice único parcial em alunos.cpf (ignora linhas com CPF NULL)
CREATE UNIQUE INDEX IF NOT EXISTS alunos_cpf_unique
  ON public.alunos (cpf)
  WHERE cpf IS NOT NULL;
