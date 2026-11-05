/** Índice descritivo de Q1–Q8, separado do Protocolo V1 e sem pesos para escrita/leitura. */
export interface IndicadorTurma {
  turmaId: number; turma: string; escola: string; professoras: string[]; versao: number; criancas: number;
  codigo: string; avaliadas: number; sim: number
}
const categoriasEscrita: Record<string, [string,string][]> = {
  ESCRITA_NOME: [['SEM_APOIO','Sem apoio'],['COM_APOIO','Com apoio'],['NAO_ESCREVE','Não escreveu']],
  NIVEL_ESCRITA: [['NAO_ESCREVEU','Não escreveu'],['PRE_ALFABETICA','Pré-alfabética'],['ALFABETICA_PARCIAL','Alfabética parcial'],['ALFABETICA_COMPLETA','Alfabética completa'],['ALFABETICA_CONSOLIDADA','Alfabética consolidada']],
}
const habilidades = ['RIMAS', 'ALITERACAO', 'CONSCIENCIA_PALAVRAS', 'CONSCIENCIA_SILABICA', 'RELACAO_LETRA_SOM', 'LETRAS_NUMEROS', 'ESCRITA_NOME', 'NIVEL_ESCRITA']
export function classificarTurmas(indicadores: IndicadorTurma[]) {
  const grupos = new Map<string, IndicadorTurma[]>()
  for (const r of indicadores) {
    const key = `${r.versao}/${r.turmaId}`
    const rs = grupos.get(key) || []; rs.push(r); grupos.set(key, rs)
  }
  const linhas = [...grupos.values()].map(rs => {
    const r = rs[0]
    const resultados = habilidades.map(codigo => {
      const opcoes = categoriasEscrita[codigo]
      const valores = rs.filter(v => codigo === 'ALITERACAO' ? v.codigo.startsWith('ALITERACAO_')
        : opcoes ? opcoes.some(([c]) => v.codigo === `${codigo}_${c}`) : v.codigo === codigo)
      const avaliadas = valores.reduce((s, v) => s + v.avaliadas, 0)
      const sim = opcoes ? valores.filter(v => codigo === 'ESCRITA_NOME' ? v.codigo === 'ESCRITA_NOME_SEM_APOIO'
        : ['NIVEL_ESCRITA_ALFABETICA_COMPLETA','NIVEL_ESCRITA_ALFABETICA_CONSOLIDADA'].includes(v.codigo))
        .reduce((s,v) => s + v.avaliadas,0) : valores.reduce((s, v) => s + v.sim, 0)
      if (sim < 0 || sim > avaliadas || (opcoes && avaliadas > r.criancas)) throw new Error('Contagens inválidas na classificação de turmas.')
      const vogais = codigo === 'ALITERACAO' ? [...'AEIOU'].map(vogal => {
        const dados = valores.filter(v => v.codigo === `ALITERACAO_${vogal}`)
        const avaliadas = dados.reduce((s,v) => s + v.avaliadas,0)
        const sim = dados.reduce((s,v) => s + v.sim,0)
        if (sim < 0 || sim > avaliadas) throw new Error('Contagens inválidas na classificação de turmas.')
        return { vogal, avaliadas, sim, percentual: avaliadas ? sim/avaliadas*100 : null }
      }) : []
      const observadas = vogais.filter(v => v.percentual !== null)
      const percentual = codigo === 'ALITERACAO'
        ? (observadas.length ? observadas.reduce((s,v) => s + v.percentual!,0)/observadas.length : null)
        : (avaliadas ? sim/avaliadas*100 : null)
      const categorias = (opcoes || []).map(([c,descricao]) => {
        const n = valores.filter(v => v.codigo === `${codigo}_${c}`).reduce((s,v) => s+v.avaliadas,0)
        return { codigo:c, descricao, n, percentual:avaliadas ? n/avaliadas*100 : null }
      })
      const detalhesNome = codigo === 'ESCRITA_NOME' ? [
        ['NOME','Só o nome'],['NOME_COMPOSTO','Nome composto'],['NOME_COMPLETO','Nome completo'],['NAO_INFORMADO','Detalhe não informado'],
      ].map(([c,descricao]) => ({ codigo:c,descricao,n:rs.filter(v => v.codigo === `DETALHE_NOME_${c}`).reduce((s,v) => s+v.avaliadas,0) })) : []
      return { codigo, avaliadas, sim, percentual, vogais, categorias, detalhesNome,
        ausentes: opcoes ? r.criancas-avaliadas : null,
        cobertura: opcoes && r.criancas ? avaliadas/r.criancas*100 : null }

    })
    const completa = resultados.every(v => v.percentual !== null)
    const indice = completa ? Math.round(resultados.reduce((s, v) => s + v.percentual!, 0) / habilidades.length * 10) / 10 : null
    return { turmaId: r.turmaId, turma: r.turma, escola: r.escola, professoras: r.professoras,
      versao: r.versao, criancas: r.criancas, indice, posicao: null as number | null, resultados }
  })
  linhas.sort((a,b) => a.versao - b.versao || (b.indice ?? -1) - (a.indice ?? -1)
    || a.escola.localeCompare(b.escola, 'pt-BR') || a.turma.localeCompare(b.turma, 'pt-BR') || a.turmaId-b.turmaId)
  let versao = -1, anterior: number | null = null, posicao = 0
  for (const r of linhas) {
    if (r.versao !== versao) { versao = r.versao; anterior = null; posicao = 0 }
    if (r.indice === null) continue
    if (r.indice !== anterior) posicao++
    r.posicao = posicao; anterior = r.indice
  }
  return linhas
}
