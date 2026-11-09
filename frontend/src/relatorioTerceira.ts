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
