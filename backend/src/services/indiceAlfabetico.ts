
export const VERSAO_ALFABETICA='APRENDIZAGEM-ALFABETICA-Q1Q9-V2'
export const PESOS_QUESTOES=[.05,.05,.05,.05,.10,.02,.10,.23,.35]
export function calcularIndiceAlfabetico(linhas:{notas:(number|null)[]}[]) {
  const completas=linhas.filter(l=>l.notas.length===9&&l.notas.every(n=>n!==null&&Number.isFinite(n)&&n>=0&&n<=100))
  const notas=PESOS_QUESTOES.map((_,i)=>completas.length?completas.reduce((s,l)=>s+l.notas[i]!,0)/completas.length:null)
  return {versao:VERSAO_ALFABETICA,base:linhas.length,completas:completas.length,incompletas:linhas.length-completas.length,notas,
    mediaExata:completas.length?completas.reduce((s,l)=>s+l.notas.reduce<number>((a,n,i)=>a+n!*PESOS_QUESTOES[i],0),0)/completas.length:null,
    validasPorQuestao:PESOS_QUESTOES.map((_,i)=>linhas.filter(l=>l.notas[i]!==null&&Number.isFinite(l.notas[i])&&l.notas[i]!>=0&&l.notas[i]!<=100).length)}
}
