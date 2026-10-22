import { ETAPAS } from './etapas'
export interface Permissoes {
  administrador?: boolean; superadmin?: boolean; aplicador?: boolean; resultados?: boolean;
  professor?: boolean; turmas?: boolean; coordenador?: boolean; diretor?: boolean
}
export interface MenuLink { nome: string; destino: string; icone: string }
export interface MenuGrupo { nome: string; links: MenuLink[] }

export function gruposDoMenu(p: Permissoes): MenuGrupo[] {
  const admin = p.administrador === true || p.superadmin === true
  const professor = p.professor === true || p.turmas === true || (!admin && p.aplicador !== true)
  const registro: MenuLink[] = []
  if (professor || admin) registro.push({ nome: 'Turmas e formulários', destino: '/turmas', icone: 'turmas' })
  if (p.resultados === true) registro.push(
    { nome: 'Resultados dos registros', destino: '/resultados', icone: 'resultado' },
    { nome: 'Gráficos dos registros', destino: '/resultados/graficos', icone: 'grafico' })
  const verificacao: MenuLink[] = []
  if (p.aplicador === true) verificacao.push({ nome: 'Minhas verificações', destino: '/aplicador', icone: 'avaliacao' })
  if (admin) verificacao.push(
    { nome: 'Atribuir turmas', destino: '/admin/aplicador/atribuicoes', icone: 'atribuir' },
    { nome: 'Acompanhar verificações', destino: '/admin/aplicador/acompanhamento', icone: 'acompanhar' },
    { nome: 'Gráficos das verificações', destino: '/admin/aplicador/graficos', icone: 'grafico' },
    { nome: 'Relatório da terceira avaliação', destino: '/admin/aplicador/relatorio-terceira', icone: 'resultado' })
  const cadastros: MenuLink[] = []
  if (p.superadmin === true) cadastros.push(
    { nome: 'Cadastrar professor', destino: '/superadmin#professores', icone: 'usuario' },
    { nome: 'Cadastrar aluno', destino: '/superadmin#alunos', icone: 'usuario' })
  const parametros: MenuLink[] = []
  if (admin) parametros.push({ nome: 'Administrar a coleta', destino: '/admin', icone: 'administracao' })
  if (p.superadmin === true) parametros.push(
    { nome: 'Configurações e cadastros', destino: '/superadmin', icone: 'administracao' },
    { nome: 'Usuários e permissões', destino: '/superadmin#permissoes', icone: 'permissoes' },
    { nome: 'Fases e períodos', destino: '/superadmin#fases', icone: 'calendario' },
    { nome: 'Armazenamento de Produção', destino: '/superadmin/armazenamento', icone: 'grafico' })
  return [ { nome: ETAPAS.professor.menu, links: registro }, { nome: ETAPAS.aplicador.menu, links: verificacao },
    { nome: 'Cadastros', links: cadastros }, { nome: 'Administração e parâmetros', links: parametros } ].filter(g => g.links.length > 0)
}

export function linkAtivo(destino: string, pathname: string, hash: string): boolean {
  const [path, anchor = ''] = destino.split('#')
  if (anchor) return pathname === path && hash === '#' + anchor
  if (path === '/aplicador' || path === '/turmas') return pathname === path || pathname.startsWith(path + '/')
  return pathname === path && (path !== '/superadmin' || !hash)
}
