export interface UserPermissions {
  administrador: boolean
  resultados: boolean
  superadmin: boolean
}

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
  const allowedCpfs = parseCpfList(process.env.RESULTADOS_ALLOWED_CPFS)
  return allowedCpfs.includes(normalizarCpf(cpf))
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
    resultados: isAdministrador(cpf),
    superadmin: isSuperadmin(cpf),
  }
}
