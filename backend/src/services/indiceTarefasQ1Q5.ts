/** Padrões anônimos: cada linha representa n crianças com os mesmos escores. */
export interface PadraoQ1Q5 { q1: number | null; q2: number | null; q3: number | null; q4: number | null; q5: number | null; n: number }
export function calcularIndiceQ1Q5(padroes: PadraoQ1Q5[]) {
  let base = 0, completas = 0, soma = 0
  for (const p of padroes) {
    if (!Number.isInteger(p.n) || p.n < 0) throw new Error('Contagem inválida no índice Q1–Q5.')
    base += p.n
    const binarios = [p.q1, p.q3, p.q4, p.q5]
    if (!binarios.every(v => v === 0 || v === 1) ||
        p.q2 === null || !Number.isFinite(p.q2) || p.q2 < 0 || p.q2 > 1) continue
    completas += p.n
    soma += (p.q1 + p.q2 + p.q3 + p.q4 + p.q5) / 5 * 100 * p.n
  }
  return { codigo: 'TAREFAS-Q1-Q5-V1', base, completas, incompletas: base - completas,
    mediaExata: completas ? soma / completas : null,
    media: completas ? Math.round(soma / completas * 10) / 10 : null }
}

export function referenciasGlobaisQ1Q5<T extends PadraoQ1Q5>(padroes:T[], grupo:(p:T)=>number) {
  const medias=[...new Set(padroes.map(grupo))].map(id=>calcularIndiceQ1Q5(padroes.filter(p=>grupo(p)===id)).mediaExata)
    .filter((v):v is number=>v!==null)
  return medias.length ? {media:calcularIndiceQ1Q5(padroes).mediaExata!,maior:Math.max(...medias),menor:Math.min(...medias),grupos:medias.length} : null
}
