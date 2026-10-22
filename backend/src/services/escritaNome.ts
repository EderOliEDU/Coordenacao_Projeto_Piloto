export function detalheNomeValido(codigo: string, nome: unknown) {
  if (codigo === 'NAO_ESCREVE') return nome == null
  if (typeof nome !== 'string') return false
  if (codigo === 'COM_APOIO' || codigo === 'SEM_APOIO') return ['NOME','NOME_COMPOSTO','NOME_COMPLETO'].includes(nome)
  return false
}
