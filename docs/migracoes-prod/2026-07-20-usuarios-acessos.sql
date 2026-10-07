-- Perfis de acesso do Projeto Instrucao Fonica.
-- Esta tabela substitui listas soltas para gerenciar SUPERADMIN, ADMINISTRADOR,
-- COORDENADOR e DIRETOR em um unico lugar.
--
-- Regras:
-- - SUPERADMIN e ADMINISTRADOR nao usam id_escola e acessam o escopo geral.
-- - COORDENADOR e DIRETOR usam id_escola e acessam somente suas escolas.

CREATE TABLE IF NOT EXISTS public.usuarios_acessos (
  id_usuario_acesso bigserial PRIMARY KEY,
  cpf_usuario text NOT NULL,
  perfil text NOT NULL,
  id_escola integer,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT usuarios_acessos_cpf_check
    CHECK (cpf_usuario ~ '^[0-9]{11}$'),
  CONSTRAINT usuarios_acessos_perfil_check
    CHECK (perfil IN ('SUPERADMIN', 'ADMINISTRADOR', 'COORDENADOR', 'DIRETOR')),
  CONSTRAINT usuarios_acessos_escopo_check
    CHECK (
      (perfil IN ('SUPERADMIN', 'ADMINISTRADOR') AND id_escola IS NULL)
      OR
      (perfil IN ('COORDENADOR', 'DIRETOR') AND id_escola IS NOT NULL)
    ),
  CONSTRAINT usuarios_acessos_escola_fkey
    FOREIGN KEY (id_escola)
    REFERENCES public.escolas (id_escola)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_acessos_unico
  ON public.usuarios_acessos (cpf_usuario, perfil, COALESCE(id_escola, -1));

CREATE INDEX IF NOT EXISTS idx_usuarios_acessos_cpf_perfil_ativo
  ON public.usuarios_acessos (cpf_usuario, perfil, ativo);

CREATE INDEX IF NOT EXISTS idx_usuarios_acessos_escola_perfil_ativo
  ON public.usuarios_acessos (id_escola, perfil, ativo);

COMMENT ON TABLE public.usuarios_acessos IS
  'Define perfis de acesso ao sistema e escopos por escola quando aplicavel.';

COMMENT ON COLUMN public.usuarios_acessos.cpf_usuario IS
  'CPF normalizado, somente numeros, com 11 digitos.';

COMMENT ON COLUMN public.usuarios_acessos.perfil IS
  'Perfil de acesso: SUPERADMIN, ADMINISTRADOR, COORDENADOR ou DIRETOR.';

COMMENT ON COLUMN public.usuarios_acessos.id_escola IS
  'Obrigatorio para COORDENADOR e DIRETOR; nulo para SUPERADMIN e ADMINISTRADOR.';

COMMENT ON COLUMN public.usuarios_acessos.ativo IS
  'Quando false, remove o acesso sem apagar o historico do vinculo.';

DO $$
BEGIN
  IF to_regclass('public.coordenadores_escola') IS NOT NULL THEN
    INSERT INTO public.usuarios_acessos (cpf_usuario, perfil, id_escola, ativo, criado_em, atualizado_em)
    SELECT cpf_coordenador, 'COORDENADOR', id_escola, ativo, criado_em, atualizado_em
    FROM public.coordenadores_escola
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Exemplos:
-- INSERT INTO public.usuarios_acessos (cpf_usuario, perfil) VALUES ('00000000000', 'SUPERADMIN');
-- INSERT INTO public.usuarios_acessos (cpf_usuario, perfil) VALUES ('00000000000', 'ADMINISTRADOR');
-- INSERT INTO public.usuarios_acessos (cpf_usuario, perfil, id_escola) VALUES ('00000000000', 'COORDENADOR', 123);
-- INSERT INTO public.usuarios_acessos (cpf_usuario, perfil, id_escola) VALUES ('00000000000', 'DIRETOR', 123);
