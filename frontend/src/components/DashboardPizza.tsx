import {useRef,useState} from 'react'
import ResultadoPizza from './ResultadoPizza'
import {pizzaDashboard,type DashboardData} from '../terceiraDashboard'
const QUESTOES=[['RIMAS','Q1 · Rimas'],['ALITERACAO','Q2 · Vogais'],['CONSCIENCIA_PALAVRAS','Q3 · Palavras'],['CONSCIENCIA_SILABICA','Q4 · Sílabas'],['RELACAO_LETRA_SOM','Q5 · Letra–som']]
export default function DashboardPizza({d,item,titulo,scope}:{d:DashboardData;item:string;titulo:string;scope:{escola:number|null;turma:number|null}}) {
  const [questao,setQuestao]=useState('RIMAS'),dialogo=useRef<HTMLDialogElement>(null)
  const codigo=item==='Q1Q5'?questao:item
  const r=pizzaDashboard(d,codigo,scope)
  const legenda=item==='Q1Q5'?QUESTOES.find(q=>q[0]===questao)![1]:item==='NOME_COMPLETO_SEM_APOIO'?'Nome completo sem apoio × outros resultados':'Todas as categorias'
  const unidade=codigo==='LEITURA'?'leituras por palavra':codigo==='ALITERACAO'?'respostas por vogal':'respostas válidas'
  const grafico=<ResultadoPizza item={titulo+' · '+legenda} avaliadas={r.avaliadas} resultados={r.resultados} unidade={unidade} usarDescricao={codigo==='LEITURA'} unidadeQuantidade={codigo==='LEITURA'?'leituras':undefined}/>
  return <aside className="td-panel-pie" aria-label={`Pizza: ${titulo}`}>
    <span className="td-pie-heading">{codigo==='LEITURA'?'Leituras por palavra':'Distribuição do recorte'}</span>
    {item==='Q1Q5'&&<select className="td-pie-question" aria-label="Questão da pizza de Consciência Fonológica" value={questao} onChange={e=>setQuestao(e.target.value)}>{QUESTOES.map(([c,n])=><option key={c} value={c}>{n}</option>)}</select>}
    <div className="td-pie-clickable" role="button" tabIndex={0} aria-label={`Ampliar pizza: ${titulo}`} title="Clique para ampliar e ver a legenda completa" onClick={()=>dialogo.current?.showModal()} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();dialogo.current?.showModal()}}}>{grafico}</div>
    <dialog ref={dialogo} className="td-modal td-pie-modal" aria-label={`Distribuição: ${titulo}`}>
      <header className="td-modal-header"><div><h3>{titulo}</h3><p>{legenda}</p></div><button onClick={()=>dialogo.current?.close()}>Fechar</button></header>
      {grafico}
      <p className="td-method">Base do recorte: {r.base} {codigo==='LEITURA'?'oportunidades por palavra':codigo==='ALITERACAO'?'oportunidades por vogal':'crianças'}. Registros válidos: {r.avaliadas}. Sem registro válido: {r.ausentes}.</p>
      <p className="td-method">{codigo==='LEITURA'?'Cada criança pode contribuir com várias palavras. Não respondeu é uma categoria válida, diferente de registro ausente.':codigo==='ALITERACAO'?'A pizza reúne as respostas válidas das cinco vogais. A resposta genérica histórica não é usada.':codigo==='NOME_COMPLETO_SEM_APOIO'?'Conta como critério atingido apenas nome completo sem apoio. Registros de quem escreveu com tipo de nome não informado não entram no denominador; outros resultados avaliáveis entram como comparação.':item==='Q1Q5'?'A pizza mostra as respostas da questão escolhida; não representa a pontuação média Q1–Q5.':'Distribuição das categorias registradas, sem transformar ausência em erro.'} A pizza considera todo o recorte selecionado, independentemente da página de colunas.</p>
    </dialog>
  </aside>
}
