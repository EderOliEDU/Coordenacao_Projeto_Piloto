import {useEffect,useRef,useState} from 'react'
import {useSearchParams} from 'react-router-dom'
import api from '../api/client'
import DashboardColunas,{numeroDashboard} from '../components/DashboardColunas'
import DashboardPizza from '../components/DashboardPizza'
import {filtrarAgrupamento,gruposDesempenho,desempenhoAlfabetico,PESOS_ALFABETICOS,PAINEIS,gruposDashboard,referenciasDashboard,recorteDashboard,type DashboardData,type GrupoDashboard} from '../terceiraDashboard'
import './TerceiraDashboardPage.css'
type Scope={escola:number|null;turma:number|null}
export function DashboardPainel({d,painel,scope,onOpen,fixo=false}:{d:DashboardData;painel:typeof PAINEIS[number];scope:Scope;onOpen?:(g:GrupoDashboard)=>void;fixo?:boolean}) {
  const [categoria,setCategoria]=useState(painel.padrao)
  const nivel=fixo||scope.escola?'turma':'escola'
  const globais=gruposDashboard(d,painel.item,categoria,nivel)
  const visiveis=fixo?globais.map(g=>({...g,nome:`${d.pontuacaoTurmasProjeto.find(t=>t.turmaId===g.id)?.escola||''} · ${g.nome}`})):recorteDashboard(globais,scope.escola,scope.turma,nivel)
  const tituloCategoria=painel.categorias.find(c=>c[0]===categoria)?.[1]||''
  const escolaPainel=scope.escola?d.pontuacaoTurmasProjeto.find(t=>t.escolaId===scope.escola)?.escola||'Escola não encontrada':null
  return <section className={`td-panel ${painel.id==='consciencia'?'td-wide':''}`} id={fixo?'turmas-projeto':painel.id}>
    <header className="td-panel-header"><div><span className="td-eyebrow">{fixo?'Todas as turmas · painel fixo':nivel==='escola'?'Comparativo de escolas':'Comparativo de turmas'}</span><h2>{fixo?'Desempenho das turmas em aprendizagem alfabética':painel.titulo}</h2></div><span className="td-unit">{painel.item==='LEITURA'?'Leituras · %':painel.unidade==='pontos'?'0–100 pontos':'0–100%'}</span></header>
    {painel.categorias.length>1&&<label className="td-category-select"><span className="sr-only">Categoria de {painel.titulo}</span><select aria-label={`Categoria de ${painel.titulo}`} value={categoria} onChange={e=>setCategoria(e.target.value)}>{painel.categorias.map(([codigo,nome])=><option key={codigo} value={codigo}>{nome}</option>)}</select></label>}
    {painel.id==='nome'&&<div className="td-category-summary">Nome completo sem apoio</div>}
    <div className="td-metric-label">{tituloCategoria}{painel.unidade==='%'?' · percentual dos registros válidos':''}</div>
    {fixo?<div className="td-panel-scope td-panel-scope-global">Todas as escolas · turmas do projeto</div>:escolaPainel&&<div className="td-panel-scope" aria-label={`Escola deste painel: ${escolaPainel}`}>{escolaPainel}</div>}
    {painel.item==='LEITURA_CRIANCAS'&&<div className="td-reading-unit">Média por criança · pesos 0 / 33 / 67 / 100</div>}
    <div className="td-reading-unit">{painel.item==='LEITURA'?'Registros válidos por palavra':'Alunos com resposta válida'}: {visiveis.reduce((s,g)=>s+g.avaliadas,0)} / {visiveis.reduce((s,g)=>s+g.base,0)} · Sem mínimo de cobertura</div>
    <div className={fixo?"td-panel-visuals td-only-columns":"td-panel-visuals"}>
    <DashboardColunas key={`${categoria}-${fixo?'fixo':scope.escola+'-'+scope.turma}`} grupos={visiveis} referencias={referenciasDashboard(globais,['Q1Q5','LEITURA_CRIANCAS'].includes(painel.item))} unidade={painel.unidade} titulo={fixo?'Desempenho global das turmas':painel.titulo+' — '+tituloCategoria} nivel={nivel} onOpen={fixo?undefined:onOpen} nota={painel.nota} mostrarQuantidade={painel.id==='nome'} unidadeRegistro={painel.item==='LEITURA'?'Leituras por palavra':undefined}/>
    {!fixo&&<DashboardPizza d={d} item={painel.id==='nome'?'NOME_DETALHADO':painel.item} titulo={painel.titulo} scope={scope}/>}
    </div>

  </section>
}

export function DesempenhoTurmas({d}:{d:DashboardData}) {
  const linhas=desempenhoAlfabetico(d)
  const detalhes=useRef<HTMLDialogElement>(null)
  const grupos=gruposDesempenho(d)
  const referencias=referenciasDashboard(grupos,true)
  const elegiveis=linhas.filter(l=>l.valor!==null)
  return <section className="td-panel td-wide" id="turmas-projeto">
    <header className="td-panel-header"><div><span className="td-eyebrow">Todas as turmas do recorte · 3ª avaliação</span><h2>Desempenho das turmas em aprendizagem alfabética</h2></div><span className="td-unit">Índice · 0–100 pontos</span></header>
    <div className="td-panel-visuals td-only-columns"><DashboardColunas grupos={grupos} referencias={referencias} onDetalhes={()=>detalhes.current?.showModal()} unidade="pontos" titulo="Desempenho das turmas em aprendizagem alfabética" nivel="turma" ocultarCobertura nota="Índice Q1–Q9 V2. Média dos índices individuais completos. Consulte os componentes e a cobertura." notaReferencias="Média aritmética dos índices das turmas classificadas no agrupamento selecionado. Maior e menor entre essas turmas; independentes da paginação e da seleção de escola/turma."/></div>
    <dialog ref={detalhes} className="td-modal td-data td-index-modal" aria-label="Componentes do desempenho das turmas"><header className="td-modal-header"><h3>Desempenho das turmas</h3><button onClick={()=>detalhes.current?.close()}>Fechar</button></header>
    <div className="td-index-modal-scroll" tabIndex={0} role="region" aria-label="Informações do desempenho — role horizontalmente para ver todas as questões">
    <p className="td-method">Comparativo de todas as turmas do agrupamento selecionado, independente da escola ou turma aberta nos outros painéis. A tabela contém todas as turmas deste comparativo, inclusive as que não possuem dados suficientes para classificação.</p>
    {referencias&&<p className="td-method"><strong>Média: {numeroDashboard(referencias.media)}</strong> · Maior: {numeroDashboard(referencias.maior)} · Menor: {numeroDashboard(referencias.menor)} pontos. Média aritmética dos índices de {referencias.grupos} turmas classificadas; maior e menor entre as mesmas turmas. As referências não mudam com a paginação.</p>}
    <p className="td-method">Q1 5% · Q2 5% · Q3 5% · Q4 5% · Q5 10% · Q6 2% · Q7 10% · Q8 23% · Q9 35%.</p>
    <p className="td-method">{elegiveis.length} de {linhas.length} turmas com avaliações individuais válidas de Q1 a Q9. Resultado da etapa atual; não mede o avanço no ano nem comprova efeito exclusivo da metodologia.</p>
    <div className="td-table-scroll"><table><caption>Notas, contribuições e cobertura por turma</caption><thead><tr><th scope="col">Posição / turma</th><th scope="col">Índice</th>{PESOS_ALFABETICOS.map(p=><th scope="col" key={p.id}>{p.titulo}<small>{p.peso*100}%</small></th>)}</tr></thead><tbody>
      {linhas.map(t=>{
        const pos=t.valor===null?null:elegiveis.findIndex(e=>e.valor===t.valor)+1
        return <tr key={t.turmaId}><th scope="row">{pos!==null?pos+'º · ':''}{t.turma}<small>{t.escola}</small><small>{t.professoras?.join(' · ')||'Professora não informada'}</small></th><td><strong>{t.valor===null?'Sem classificação':t.valor.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' / 100'}</strong><small>{t.completasIndice}/{t.baseIndice} crianças com Q1–Q9 válidos</small>{t.valor!==null&&<div style={{width:100,background:'#e8edf2',height:8,marginTop:8}}><div style={{width:t.valor+'%',height:8,background:pos===1?'#bc6a00':'#214e71'}}/></div>}</td>{t.componentes.map(c=><td key={c.id}>{c.nota===null?'Sem dados':numeroDashboard(c.nota)+' / 100'}<small>{c.contribuicao===null?'Não calculado':numeroDashboard(c.contribuicao)+' pontos no índice'}</small><small>{c.validas}/{c.base} crianças no índice</small><small>Cobertura: {c.base?numeroDashboard(c.validas/c.base*100)+'%':'sem base'} · Fora do índice completo: {Math.max(0,c.base-c.validas)}</small><small>Questão completa: {c.disponiveis}/{c.base} crianças</small></td>)}</tr>
      })}
    </tbody></table></div>
    {!linhas.length&&<p>Nenhuma turma disponível.</p>}

    <details open className="td-method"><summary>Como calculamos o índice</summary>
      <p>Versão APRENDIZAGEM-ALFABETICA-Q1Q9-V2. Índice individual = Q1×0,05 + Q2×0,05 + Q3×0,05 + Q4×0,05 + Q5×0,10 + Q6×0,02 + Q7×0,10 + Q8×0,23 + Q9×0,35. Nota da turma = média dos índices individuais completos. Ordenação sem arredondamento; empates exatos recebem a mesma posição.</p>
      <p>Todas as notas e contribuições da tabela utilizam as mesmas crianças com Q1–Q9 válidos; na Q2 basta uma resposta válida. A cobertura do índice usa como base as crianças com aplicação concluída na etapa, e não todas as matriculadas. A disponibilidade por questão é mostrada separadamente e inclui avaliações fora do índice completo.</p>
      <p>Q1, Q3, Q4, Q5 e Q6: Sim = 100; Não = 0. Q2: respostas válidas corretas (TRUE) ÷ respostas válidas (TRUE + FALSE) × 100. NULL é resposta não válida e fica fora do cálculo. Uma única resposta válida correta resulta em 100% de desempenho; todas NULL resultam em sem dados. Q5 descreve a tarefa de relação letra–som, sem equivaler a uma avaliação ampla de consciência fonêmica.</p>
      <p>Q7: nome completo sem apoio = 100; outros resultados avaliáveis = 0. Tipo de nome ausente impede o cálculo, exceto quando registrado “não escreve”. Q8: não escreveu e pré-alfabética = 0; parcial = 33; completa = 67; consolidada = 100.</p>
      <p>Q9: média das dez palavras, cada uma com 1/10 do peso. Não utiliza sons e “não respondeu” registrado = 0; utiliza alguns sons = 33; decodifica = 67; lê com autonomia = 100. Exige dez palavras distintas com classificação válida. Ausência de registro não é zero.</p>
      <p>Uma questão incompleta exclui a criança apenas do índice, preservando seus resultados nos demais painéis. Não há redistribuição de pesos. Turmas sem nenhuma avaliação completa ficam sem classificação. Comparação descritiva, sem cobertura mínima adicional; considere participação e perfil inicial antes de reconhecer uma turma de destaque.</p>
      <p>Pesos e pontuações definidos pelo projeto, inspirados na literatura de Linnea C. Ehri; não constituem escala validada pela autora. As fases não têm distâncias comprovadamente iguais. Leitura com autonomia não comprova fase consolidada.</p>
    </details></div></dialog>
  </section>
}

export function DashboardConteudo({d,scope,onScope,atualizar,atualizando=false,agrupamento=null,onAgrupamento}:{agrupamento?:number|null;onAgrupamento?:(id:number|null)=>void;d:DashboardData;scope:Scope;onScope:(s:Scope)=>void;atualizar:()=>void;atualizando?:boolean}) {
  const contexto=useRef<HTMLDialogElement>(null)
  const todas=d.pontuacaoTurmasProjeto
  const turmas=todas.filter(t=>(!scope.escola||t.escolaId===scope.escola)&&(!scope.turma||t.turmaId===scope.turma))
  const criancas=turmas.reduce((s,t)=>s+t.base,0)
  const resumo=d.resumoProjeto
  const cobertura=resumo?.cobertura ?? null
  const escola=todas.find(t=>t.escolaId===scope.escola)?.escola||'Escola não encontrada'
  const turma=todas.find(t=>t.turmaId===scope.turma)?.turma||'Turma não encontrada'
  const abrir=(g:GrupoDashboard)=>onScope(scope.escola?{escola:scope.escola,turma:g.id}:{escola:g.id,turma:null})
  return <div className="td-dashboard">
    <header className="td-heading"><div><span className="td-eyebrow">PROJETO INSTRUÇÃO FÔNICA</span><h1>Terceira avaliação<span className="td-heading-dot">.</span></h1>
<p>Um olhar sobre as aprendizagens.</p></div><div className="td-heading-actions">{onAgrupamento&&<label className="td-group-filter">Agrupamento <select aria-label="Agrupamento" value={agrupamento??''} onChange={e=>onAgrupamento(Number(e.target.value)||null)}><option value="">Todos</option><option value="4">4º agrupamento</option><option value="5">5º agrupamento</option></select></label>}<button onClick={atualizar} disabled={atualizando}>{atualizando?'Atualizando…':'↻ Atualizar'}</button><button onClick={()=>contexto.current?.showModal()}>Sobre os dados</button></div></header>
    <nav className="td-breadcrumb" aria-label="Recorte do dashboard">{agrupamento&&<strong>{agrupamento}º agrupamento ·</strong>}<button disabled={!scope.escola} onClick={()=>onScope({escola:null,turma:null})}>Todas as escolas</button>{scope.escola&&<><span>›</span><button disabled={!scope.turma} onClick={()=>onScope({escola:scope.escola,turma:null})}>{escola}</button></>}{scope.turma&&<><span>›</span><strong>{turma}</strong></>}</nav>
    <section className="td-kpis" aria-label="Indicadores gerais do projeto">
      <article className="td-kpi td-kpi-featured"><span>{agrupamento?'Crianças do agrupamento':'Crianças do projeto'} <i>◉</i></span><strong>{resumo?.total.toLocaleString('pt-BR')??'—'}</strong><small>{agrupamento?agrupamento+'º agrupamento · cadastro atual':'Projeto inteiro · cadastro atual'}</small></article>
      <article className="td-kpi"><span>Avaliadas <i>✓</i></span><strong>{resumo?.avaliadas.toLocaleString('pt-BR')??'—'}</strong><small>3ª avaliação concluída</small></article>
      <article className="td-kpi"><span>Não avaliadas <i>◷</i></span><strong>{resumo?.naoAvaliadas.toLocaleString('pt-BR')??'—'}</strong><small>Sem conclusão na 3ª avaliação</small></article>
      <article className="td-kpi"><span>{agrupamento?'Escolas do agrupamento':'Escolas do projeto'} <i>▦</i></span><strong>{resumo?.escolas??'—'}</strong><small>Com crianças cadastradas</small></article>
      <article className="td-kpi td-kpi-coverage"><span>{agrupamento?'Cobertura do agrupamento':'Cobertura do projeto'} <i>◎</i></span><strong>{cobertura===null?'—':numeroDashboard(cobertura)}<em>%</em></strong><small>{agrupamento?'Avaliadas ÷ total do agrupamento':'Avaliadas ÷ total do projeto'}</small></article>
    </section>
    <nav className="td-section-nav" aria-label="Painéis do dashboard">{PAINEIS.map(p=><a key={p.id} href={`#${p.id}`}>{p.titulo}</a>)}<a href="#turmas-projeto">Desempenho das turmas</a></nav>
    <div className="td-workspace"><div className="td-panels">
      {PAINEIS.map(p=><DashboardPainel key={p.id+String(agrupamento)} d={d} painel={p} scope={scope} onOpen={scope.turma?undefined:abrir}/>)}
      <DesempenhoTurmas key={agrupamento??"todos"} d={d}/>
    </div></div><dialog ref={contexto} className="td-context-dialog td-modal" aria-labelledby="td-context-title">
      <header className="td-modal-header"><h2 id="td-context-title">Contexto e cobertura</h2><button onClick={()=>contexto.current?.close()}>Fechar</button></header>
      <div className="td-insights" aria-label="Contexto e cobertura">
      <section className="td-sidecard"><span className="td-eyebrow">{agrupamento?agrupamento+'º AGRUPAMENTO':'PROJETO INTEIRO'}</span><h2>Cobertura da terceira avaliação</h2><div className="td-ring" role="img" aria-label={`Avaliações concluídas: ${cobertura===null?'sem dados':numeroDashboard(cobertura)+'%'}`} style={{background:`conic-gradient(#f0ac24 ${cobertura??0}%,#e7edf2 0)`}}><div><strong>{cobertura===null?'—':numeroDashboard(cobertura)}<span>%</span></strong><small>avaliadas</small></div></div><p><strong>{resumo?.avaliadas??'—'}</strong> de <strong>{resumo?.total??'—'}</strong> crianças {agrupamento?'do agrupamento':'do projeto'} com aplicação concluída na terceira avaliação.</p><div className="td-side-stat"><span>Sem conclusão</span><strong>{resumo?.naoAvaliadas??'—'}</strong></div><small>Cadastro atual de crianças enturmadas no projeto, sem duplicação. Em andamento e pendente não contam como avaliação concluída. Estes indicadores acompanham o agrupamento e não mudam com a seleção de escola/turma.</small></section>
      <section className="td-sidecard"><span className="td-eyebrow">EXPLORE OS RESULTADOS</span><h2>Da escola à turma</h2><ol><li>Clique em uma escola.</li><li>Abra a turma desejada.</li><li>Volte pelo caminho no topo.</li></ol><p>Os cinco painéis acompanham a seleção. O desempenho geral das turmas permanece fixo e reúne os cinco painéis.</p></section>
      <section className="td-sidecard td-side-note"><h2>Sobre a leitura</h2><p>As classificações descrevem os registros por palavra, sem atribuir automaticamente uma fase global à criança.</p><p>A pontuação das tarefas não é uma escala validada de Ehri.</p><small>Gerado em {new Date(d.geradoEm).toLocaleString('pt-BR',{timeZone:'America/Cuiaba'})}</small></section>
    </div></dialog>
    <footer className="td-footer"><span>SEMECEL · Projeto Instrução Fônica</span><span>Terceira avaliação · dados agregados</span></footer>
  </div>
}
export default function TerceiraDashboardPage() {
  const [params,setParams]=useSearchParams(),[d,setDados]=useState<DashboardData|null>(null),[erro,setErro]=useState(''),[loading,setLoading]=useState(true),[revisao,setRevisao]=useState(0)
  useEffect(()=>{const c=new AbortController();setLoading(true);setErro('')
    api.get<DashboardData>('/superadmin/aplicador/relatorio-terceira',{signal:c.signal})
      .then(r=>{if(!c.signal.aborted)setDados(r.data)})
      .catch(e=>{if(!c.signal.aborted)setErro(e.response?.data?.error||'Não foi possível carregar o dashboard.')})
      .finally(()=>{if(!c.signal.aborted)setLoading(false)})
    return()=>c.abort()
  },[revisao])
  const agrupamento=[4,5].includes(Number(params.get('agrupamento')))?Number(params.get('agrupamento')):null
  const dados=d?filtrarAgrupamento(d,agrupamento):null
  const scope={escola:Number(params.get('escolaId'))||null,turma:Number(params.get('turmaId'))||null}
  return <>{loading&&!d&&<div className="td-loading" role="status">Preparando os resultados da terceira avaliação…</div>}{erro&&<div className="td-error" role="alert">{erro}<button onClick={()=>setRevisao(v=>v+1)}>Tentar novamente</button></div>}
    {dados&&<DashboardConteudo d={dados} agrupamento={agrupamento} onAgrupamento={id=>setParams(id?{agrupamento:String(id)}:{})} scope={scope} onScope={s=>{const p:Record<string,string>={};if(agrupamento)p.agrupamento=String(agrupamento);if(s.escola)p.escolaId=String(s.escola);if(s.turma)p.turmaId=String(s.turma);setParams(p)}} atualizar={()=>setRevisao(v=>v+1)} atualizando={loading}/>}
  </>
}
