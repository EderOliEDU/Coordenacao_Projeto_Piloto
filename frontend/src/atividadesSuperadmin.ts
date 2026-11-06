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
