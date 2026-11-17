export interface IndiceQ1Q5 { codigo:string; base:number; completas:number; incompletas:number; media:number|null; mediaExata?:number|null }
export function textoIndiceQ1Q5(i:IndiceQ1Q5) {
  return `Desempenho médio nas tarefas Q1–Q5: ${i.media === null ? 'sem avaliações completas' : i.media.toLocaleString('pt-BR',{maximumFractionDigits:1}) + '/100'} — avaliações completas: ${i.completas} de ${i.base} crianças`
}
export interface LinhaRelatorio {
  item:string; habilidade:string; base:number; avaliadas:number; ausentes:number
  detalhesNome?:{tipo:string;semApoio:number;comApoio:number;total:number}[]
  resultados:{codigo:string;descricao:string;n:number;percentual:number|null}[]
  interpretacao:string; limite:string
}
export function compilarResultados(linhas:LinhaRelatorio[],item:string,habilidade:string):LinhaRelatorio {
  const categorias=new Map<string,LinhaRelatorio['resultados'][number]>()
  for(const linha of linhas)for(const r of linha.resultados){
    const anterior=categorias.get(r.codigo)
    if(anterior)anterior.n+=r.n
    else categorias.set(r.codigo,{...r,percentual:null})
  }
  const avaliadas=[...categorias.values()].reduce((s,r)=>s+r.n,0)
  return {item,habilidade,base:linhas.reduce((s,l)=>s+l.base,0),avaliadas,ausentes:linhas.reduce((s,l)=>s+l.ausentes,0),
    resultados:[...categorias.values()].map(r=>({...r,percentual:avaliadas?Math.round(r.n/avaliadas*1000)/10:null})),interpretacao:'',limite:''}
}
export function compilarConscienciaFonologica(linhas:LinhaRelatorio[]) {
  const nomes:Record<string,string>={Q1:'Identificação de rimas',Q2:'Som inicial das vogais',Q3:'Segmentação de palavras',Q4:'Quantidade de sílabas',Q5:'Consoante aplicada'}
  return ['Q1','Q2','Q3','Q4','Q5'].map(item=>compilarResultados(
    linhas.filter(l=>item==='Q2'?/^Q2-[AEIOU]$/.test(l.item):l.item===item),item,nomes[item]))
}

export interface IndiceEscola extends IndiceQ1Q5 { escolaId:number; escola:string; subtitulo?:string }
export interface IndiceTurma extends IndiceQ1Q5 { escolaId:number; turmaId:number; turma:string; professoras?:string[] }
export function referenciasEscolas(escolas:IndiceEscola[]) {
  const validas=escolas.filter(e=>e.media!==null && Number.isFinite(e.media) && e.completas>0)
  const n=validas.reduce((s,e)=>s+e.completas,0)
  return n ? {media:validas.reduce((s,e)=>s+(e.mediaExata ?? e.media!)*e.completas,0)/n,
    maior:Math.max(...validas.map(e=>e.mediaExata ?? e.media!)),menor:Math.min(...validas.map(e=>e.mediaExata ?? e.media!))} : null
}

export interface ReferenciasQ1Q5 {media:number;maior:number;menor:number;grupos:number}
export function paginarGrupos<T>(grupos:T[],pagina:number,tamanho=5) {
  const total=Math.max(1,Math.ceil(grupos.length/tamanho))
  const atual=Math.min(Math.max(0,pagina),total-1)
  return {itens:grupos.slice(atual*tamanho,(atual+1)*tamanho),atual,total}
}
