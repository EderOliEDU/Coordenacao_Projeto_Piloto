import { getPgPool } from './pgPool'

export interface UserPermissions {
  administrador: boolean
  resultados: boolean
  superadmin: boolean
  coordenador?: boolean
  diretor?: boolean
}

export type PerfilAcesso = 'SUPERADMIN' | 'ADMINISTRADOR' | 'COORDENADOR' | 'DIRETOR'

export function normalizarCpf(value: string) {
  return (value || '').replace(/\D/g, '')
}

function parseCpfList(value: string | undefined) {
  return (value || '')
    .split(',')
    .map((cpf) => normalizarCpf(cpf))
    .filter(Boolean)
}

export function canViewResultados(cpf: string) {
  return getResultadosAllowedCpfs().includes(normalizarCpf(cpf))
}

export function getResultadosAllowedCpfs() {
  return parseCpfList(process.env.RESULTADOS_ALLOWED_CPFS)
}

let acessosTableEnsured = false

export async function ensureUsuariosAcessosTable() {
  if (acessosTableEnsured) return

  const pool = getPgPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.usuarios_acessos (
      id_usuario_acesso bigserial PRIMARY KEY,
      cpf_usuario text NOT NULL,
      perfil text NOT NULL,
      id_escola integer,
      ativo boolean NOT NULL DEFAULT true,
      criado_em timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT usuarios_acessos_cpf_check CHECK (cpf_usuario ~ '^[0-9]{11}$'),
      CONSTRAINT usuarios_acessos_perfil_check CHECK (perfil IN ('SUPERADMIN', 'ADMINISTRADOR', 'COORDENADOR', 'DIRETOR')),
      CONSTRAINT usuarios_acessos_escopo_check CHECK (
        (perfil IN ('SUPERADMIN', 'ADMINISTRADOR') AND id_escola IS NULL)
        OR
        (perfil IN ('COORDENADOR', 'DIRETOR') AND id_escola IS NOT NULL)
      ),
      CONSTRAINT usuarios_acessos_escola_fkey FOREIGN KEY (id_escola)
        REFERENCES public.escolas (id_escola)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_acessos_unico
      ON public.usuarios_acessos (cpf_usuario, perfil, COALESCE(id_escola, -1));

    CREATE INDEX IF NOT EXISTS idx_usuarios_acessos_cpf_perfil_ativo
      ON public.usuarios_acessos (cpf_usuario, perfil, ativo);

    CREATE INDEX IF NOT EXISTS idx_usuarios_acessos_escola_perfil_ativo
      ON public.usuarios_acessos (id_escola, perfil, ativo);

    DO $$
    BEGIN
      IF to_regclass('public.coordenadores_escola') IS NOT NULL THEN
        INSERT INTO public.usuarios_acessos (cpf_usuario, perfil, id_escola, ativo, criado_em, atualizado_em)
        SELECT cpf_coordenador, 'COORDENADOR', id_escola, ativo, criado_em, atualizado_em
        FROM public.coordenadores_escola
        ON CONFLICT DO NOTHING;
      END IF;
    END $$;
  `)
  acessosTableEnsured = true
}

export async function getUsuarioAcessos(cpf: string) {
  const cpfNormalizado = normalizarCpf(cpf)
  if (!cpfNormalizado) return []

  await ensureUsuariosAcessosTable()
  const pool = getPgPool()
  const result = await pool.query<{ perfil: PerfilAcesso; id_escola: string | null }>(
    `
    SELECT ua.perfil::text AS perfil, ua.id_escola::text
    FROM public.usuarios_acessos ua
    LEFT JOIN public.escolas e ON e.id_escola = ua.id_escola
    WHERE ua.cpf_usuario = $1
      AND ua.ativo = true
      AND (ua.id_escola IS NULL OR e.projeto = 'PJINSTFONI')
    ORDER BY ua.perfil, e.nome_escola
    `,
    [cpfNormalizado]
  )

  return result.rows
}

export async function usuarioTemPerfil(cpf: string, perfis: PerfilAcesso[]) {
  const acessos = await getUsuarioAcessos(cpf)
  return acessos.some((acesso) => perfis.includes(acesso.perfil))
}

export async function getEscolaIdsPorPerfil(cpf: string, perfis: PerfilAcesso[]) {
  const acessos = await getUsuarioAcessos(cpf)
  return Array.from(new Set(
    acessos
      .filter((acesso) => perfis.includes(acesso.perfil) && acesso.id_escola)
      .map((acesso) => String(acesso.id_escola))
  ))
}

export async function getCoordenadorEscolaIds(cpf: string) {
  return getEscolaIdsPorPerfil(cpf, ['COORDENADOR', 'DIRETOR'])
}

export async function canViewResultadosPainel(cpf: string) {
  return canViewResultados(cpf)
    || await usuarioTemPerfil(cpf, ['SUPERADMIN', 'ADMINISTRADOR'])
    || (await getCoordenadorEscolaIds(cpf)).length > 0
}

export async function getUserPermissionsAsync(cpf: string): Promise<UserPermissions> {
  const syncPermissions = getUserPermissions(cpf)
  const acessos = await getUsuarioAcessos(cpf)
  const perfis = new Set(acessos.map((acesso) => acesso.perfil))

  return {
    administrador: syncPermissions.administrador || perfis.has('ADMINISTRADOR') || perfis.has('SUPERADMIN'),
    resultados: syncPermissions.resultados || perfis.size > 0,
    superadmin: syncPermissions.superadmin || perfis.has('SUPERADMIN'),
    coordenador: perfis.has('COORDENADOR'),
    diretor: perfis.has('DIRETOR'),
  }
}

export function isSuperadmin(cpf: string) {
  const defaultSuperadmins = ['65495934172']
  const envSuperadmins = parseCpfList(process.env.SUPERADMIN_CPFS)
  return [...defaultSuperadmins, ...envSuperadmins].includes(normalizarCpf(cpf))
}

export function isAdministrador(cpf: string) {
  return canViewResultados(cpf) || isSuperadmin(cpf)
}

export function getUserPermissions(cpf: string): UserPermissions {
  return {
    administrador: isAdministrador(cpf),
    resultados: canViewResultados(cpf),
    superadmin: isSuperadmin(cpf),
  }
}
