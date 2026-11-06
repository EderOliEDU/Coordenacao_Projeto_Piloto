export interface RegistroAtividade {
  alunoId: string
  alunoNome: string
  cpf: string
  status: string
  aplicacaoId: string | null
}

export interface AlunoAtividades {
  alunoId: string
  alunoNome: string
  registros: RegistroAtividade[]
}

export function chaveRegistro(registro: RegistroAtividade) {
  return JSON.stringify([registro.cpf.replace(/\D/g, ''), registro.aplicacaoId || null])
}

// Um aluno pode ter registros legítimos de vários responsáveis. Mantê-los
// acessíveis na mesma linha evita confundi-los com matrículas duplicadas.
export function agruparAtividades(registros: RegistroAtividade[]): AlunoAtividades[] {
  const alunos = new Map<string, AlunoAtividades>()
  for (const registro of registros) {
    let aluno = alunos.get(registro.alunoId)
    if (!aluno) {
      aluno = {alunoId: registro.alunoId, alunoNome: registro.alunoNome, registros: []}
      alunos.set(registro.alunoId, aluno)
    }
    if (!aluno.registros.some(item => chaveRegistro(item) === chaveRegistro(registro))) {
      aluno.registros.push(registro)
    }
  }
  return [...alunos.values()]
}

export interface FiltrosAtividades {
  atividade: 'formulario' | 'verificacao'
  fase: string
  escola: string
  turma: string
}

const idFiltro = (valor: unknown) => typeof valor === 'string' && /^[1-9]\d*$/.test(valor) ? valor : ''
export function lerFiltrosAtividades(search: string, salvos: unknown = {}): FiltrosAtividades {
  const query = new URLSearchParams(search)
  const temFiltros = ['atividade','fase','escola','turma'].some(chave => query.has(chave))
  const origem = temFiltros ? Object.fromEntries(query) : (salvos && typeof salvos === 'object' ? salvos : {}) as Record<string,unknown>
  return {atividade: origem.atividade === 'verificacao' ? 'verificacao' : 'formulario',
    fase: idFiltro(origem.fase),escola: idFiltro(origem.escola),turma: idFiltro(origem.turma)}
}

export function queryFiltrosAtividades(filtros: FiltrosAtividades) {
  return new URLSearchParams({...filtros}).toString()
}
export function urlListaAtividades(filtros: FiltrosAtividades) {
  return '/superadmin/atividades?' + queryFiltrosAtividades(filtros)
}

// Somente a lista de atividades é um destino de retorno permitido.
export function retornoListaAtividades(search: string, padrao: string) {
  const query = new URLSearchParams(search)
  if (!query.get('responsavel') || !query.get('fase')) return padrao
  const retorno = query.get('retorno')
  if (!retorno) return '/superadmin/atividades'
  try {
    const url = new URL(retorno, 'https://retorno.local')
    if (url.origin !== 'https://retorno.local' || url.pathname !== '/superadmin/atividades') return '/superadmin/atividades'
    return urlListaAtividades(lerFiltrosAtividades(url.search))
  } catch { return '/superadmin/atividades' }
}
