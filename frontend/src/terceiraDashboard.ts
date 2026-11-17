import type { IndiceTurma } from './relatorioTerceira'
export type TurmaProjeto=IndiceTurma & {escola:string;agrupamentoId?:number}
export interface Distribuicao {turmaId:number;item:string;categoria:string;n:number}
export interface GrupoDashboard {id:number;escolaId:number;nome:string;subtitulo:string;base:number;avaliadas:number;n:number;valor:number|null}
export interface IndiceAlfabeticoTurma {turmaId:number;versao:string;base:number;completas:number;incompletas:number;notas:(number|null)[];mediaExata:number|null;validasPorQuestao:number[]}
export interface DashboardData {
  conscienciaParticipantesTurmas?:{turmaId:number;participantes:number;mediaExata:number|null}[];
  indicesAlfabeticosTurmasProjeto?:IndiceAlfabeticoTurma[];
  pontuacaoTurmasProjeto:TurmaProjeto[];distribuicoesTurmasProjeto:Distribuicao[];
  resumosAgrupamento?:({agrupamentoId:number;total:number;avaliadas:number;naoAvaliadas:number;escolas:number;cobertura:number|null})[];
  geradoEm:string;linhas:{item:string}[];
  resumoProjeto?:{total:number;avaliadas:number;naoAvaliadas:number;escolas:number;cobertura:number|null}|null;
}
export const PAINEIS=[
  {id:'consciencia',titulo:'Consciência Fonológica',item:'Q1Q5',unidade:'pontos',padrao:'INDICE',categorias:[['INDICE','Pontuação Q1–Q5']],nota:'Média por criança das tarefas Q1–Q5 com resposta válida, com pesos iguais entre tarefas disponíveis. Q2 considera a proporção de acertos nas vogais registradas. Todas as crianças com alguma resposta válida participam; ausência não é erro. Não altera o índice geral Q1–Q9.'},
  {id:'escrita',titulo:'Fases da escrita',item:'NIVEL_ESCRITA',unidade:'%',padrao:'ALFABETICA_COMPLETA',categorias:[['NAO_ESCREVEU','Não escreveu'],['PRE_ALFABETICA','Pré-alfabética'],['ALFABETICA_PARCIAL','Alfabética parcial'],['ALFABETICA_COMPLETA','Alfabética completa'],['ALFABETICA_CONSOLIDADA','Alfabética consolidada']],nota:'Percentual da categoria de escrita registrada pelo aplicador, sobre respostas válidas da questão.'},
  {id:'leitura',titulo:'Fases da Leitura',item:'LEITURA',unidade:'%',padrao:'DECODIFICA',categorias:[['NAO_UTILIZA_SONS','Pré-alfabética'],['UTILIZA_ALGUNS_SONS','Alfabética parcial'],['DECODIFICA','Alfabética completa'],['LE_AUTONOMIA','Alfabética consolidada'],['NAO_RESPONDEU','Não respondeu']],nota:'Percentual sobre registros válidos por palavra. Rótulos de apresentação correspondentes às categorias originais; não atribuem fase global à criança.'},
  {id:'nome',titulo:'Nome completo sem apoio',item:'NOME_COMPLETO_SEM_APOIO',unidade:'%',padrao:'COMPLETO_SEM_APOIO',categorias:[['COMPLETO_SEM_APOIO','Nome completo sem apoio']],nota:'Percentual que escreveu o nome completo sem apoio entre registros Q7 com critério avaliável. Outros resultados avaliáveis permanecem na base. Tipo de nome não informado fica fora do denominador, sem virar erro.'},
  {id:'letras',titulo:'Diferenciação Letras × Números',item:'LETRAS_NUMEROS',unidade:'%',padrao:'SIM',categorias:[['SIM','Demonstrou'],['NAO','Não demonstrou']],nota:'Percentual de crianças que demonstraram ou não demonstraram a habilidade na tarefa aplicada.'},
]
export function gruposDashboard(d:DashboardData,item:string,categoria:string,nivel:'escola'|'turma'):GrupoDashboard[] {
  const grupos=new Map<number,GrupoDashboard>()
  const palavras=d.linhas.filter(l=>l.item.startsWith('Q9-')).length
  for(const t of d.pontuacaoTurmasProjeto) {
    const id=nivel==='escola'?t.escolaId:t.turmaId
    let g=grupos.get(id)
    if(!g){g={id,escolaId:t.escolaId,nome:nivel==='escola'?t.escola:t.turma,subtitulo:nivel==='escola'?'':(t.professoras?.join(' · ')||'Professora não informada'),base:0,avaliadas:0,n:0,valor:null};grupos.set(id,g)}
    g.base+=t.base*(item==='LEITURA'?palavras:1)
    if(item==='Q1Q5') {
      const parcial=d.conscienciaParticipantesTurmas?.find(p=>p.turmaId===t.turmaId)
      const n=parcial?parcial.participantes:t.completas
      const media=parcial?parcial.mediaExata:(t.mediaExata??t.media)
      if(media!==null&&media!==undefined){g.avaliadas+=n;g.n+=media*n}
    } else {
      const rs=d.distribuicoesTurmasProjeto.filter(r=>r.turmaId===t.turmaId&&r.item===item)
      g.avaliadas+=rs.reduce((s,r)=>s+r.n,0)
      g.n+=rs.filter(r=>r.categoria===categoria).reduce((s,r)=>s+r.n,0)
    }
  }
  return [...grupos.values()].map(g=>({...g,valor:g.avaliadas?g.n/g.avaliadas*(item==='Q1Q5'?1:100):null}))
    .sort((a,b)=>a.valor===null?(b.valor===null?a.nome.localeCompare(b.nome,'pt-BR')||a.id-b.id:1):b.valor===null?-1:b.valor-a.valor||a.nome.localeCompare(b.nome,'pt-BR')||a.id-b.id)
}
export function referenciasDashboard(grupos:GrupoDashboard[],indice:boolean) {
  const validos=grupos.filter(g=>g.valor!==null&&g.avaliadas>0)
  const total=validos.reduce((s,g)=>s+g.avaliadas,0)
  return total?{media:validos.reduce((s,g)=>s+g.n,0)/total*(indice?1:100),maior:Math.max(...validos.map(g=>g.valor!)),menor:Math.min(...validos.map(g=>g.valor!)),grupos:validos.length}:null
}
export function recorteDashboard(grupos:GrupoDashboard[],escola:number|null,turma:number|null,nivel:'escola'|'turma') {
  return grupos.filter(g=>(!escola||g.escolaId===escola)&&(!turma||nivel!=='turma'||g.id===turma))
}

export function pizzaDashboard(d:DashboardData,item:string,scope:{escola:number|null;turma:number|null}) {
  const turmas=d.pontuacaoTurmasProjeto.filter(t=>(!scope.escola||t.escolaId===scope.escola)&&(!scope.turma||t.turmaId===scope.turma))
  const ids=new Set(turmas.map(t=>t.turmaId))
  const registros=d.distribuicoesTurmasProjeto.filter(r=>ids.has(r.turmaId)&&r.item===item)
  const categorias=item==='NOME_COMPLETO_SEM_APOIO'?[['COMPLETO_SEM_APOIO','Nome completo sem apoio'],['OUTROS_RESULTADOS_NOME','Outros resultados']]:PAINEIS.find(p=>p.item===item)?.categorias||[['SIM','Demonstrou'],['NAO','Não demonstrou']]
  const contagens=categorias.map(([codigo,descricao])=>({codigo,descricao,n:registros.filter(r=>r.categoria===codigo).reduce((s,r)=>s+r.n,0)}))
  const avaliadas=contagens.reduce((s,r)=>s+r.n,0)
  const multiplicador=item==='ALITERACAO'?5:item==='LEITURA'?d.linhas.filter(l=>l.item.startsWith('Q9-')).length:1
  const base=turmas.reduce((s,t)=>s+t.base,0)*multiplicador
  return {base,avaliadas,ausentes:Math.max(0,base-avaliadas),resultados:contagens.map(r=>({...r,percentual:avaliadas?Math.round(r.n/avaliadas*1000)/10:null}))}
}


export const PESOS_ALFABETICOS=[
  {id:'q1',titulo:'Q1 · Rimas',peso:0.05,item:'RIMAS'},
  {id:'q2',titulo:'Q2 · Aliteração das vogais',peso:0.05,item:'ALITERACAO'},
  {id:'q3',titulo:'Q3 · Consciência de palavras',peso:0.05,item:'CONSCIENCIA_PALAVRAS'},
  {id:'q4',titulo:'Q4 · Consciência silábica',peso:0.05,item:'CONSCIENCIA_SILABICA'},
  {id:'q5',titulo:'Q5 · Relação letra–som',peso:0.1,item:'RELACAO_LETRA_SOM'},
  {id:'q6',titulo:'Q6 · Letras × Números',peso:0.02,item:'LETRAS_NUMEROS'},
  {id:'q7',titulo:'Q7 · Nome completo sem apoio',peso:0.1,item:'NOME_COMPLETO_SEM_APOIO'},
  {id:'q8',titulo:'Q8 · Escrita',peso:0.23,item:'NIVEL_ESCRITA'},
  {id:'q9',titulo:'Q9 · Leitura',peso:0.35,item:'LEITURA'},
]
export function desempenhoAlfabetico(d:DashboardData) {
  return d.pontuacaoTurmasProjeto.map(t=>{
    const indice=d.indicesAlfabeticosTurmasProjeto?.find(i=>i.turmaId===t.turmaId&&i.versao==='APRENDIZAGEM-ALFABETICA-Q1Q9-V2')
    const componentes=PESOS_ALFABETICOS.map((p,i)=>{
      const nota=indice?.notas[i]??null
      return {...p,nota,contribuicao:nota===null?null:nota*p.peso,validas:indice?.completas??0,base:indice?.base??t.base,disponiveis:indice?.validasPorQuestao[i]??0}
    })
    const valor=indice&&indice.completas>0&&componentes.every(c=>c.nota!==null)?indice.mediaExata:null
    return {...t,componentes,valor,completasIndice:indice?.completas??0,baseIndice:indice?.base??t.base}
  }).sort((a,b)=>a.valor===null?(b.valor===null?a.turmaId-b.turmaId:1):b.valor===null?-1:b.valor-a.valor||a.turmaId-b.turmaId)
}


export function filtrarAgrupamento(d:DashboardData,agrupamento:number|null):DashboardData {
  if(agrupamento===null)return d
  const turmas=d.pontuacaoTurmasProjeto.filter(t=>t.agrupamentoId===agrupamento)
  const ids=new Set(turmas.map(t=>t.turmaId))
  return {...d,pontuacaoTurmasProjeto:turmas,
    distribuicoesTurmasProjeto:d.distribuicoesTurmasProjeto.filter(r=>ids.has(r.turmaId)),
    resumoProjeto:d.resumosAgrupamento?.find(r=>r.agrupamentoId===agrupamento)??null}
}
export function gruposDesempenho(d:DashboardData):GrupoDashboard[] {
  return desempenhoAlfabetico(d).map(t=>({id:t.turmaId,escolaId:t.escolaId,
    nome:t.escola+' · '+t.turma,subtitulo:t.professoras?.join(' · ')||'Professora não informada',
    valor:t.valor,n:t.valor??0,avaliadas:t.valor===null?0:1,base:1}))
}
