import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import ResultadoPizza from '../components/ResultadoPizza'
import './AplicadorGraficosPage.css'

import { compilarConscienciaFonologica, compilarResultados, type LinhaRelatorio as Linha } from '../relatorioTerceira'
import './AplicadorRelatorioPage.css'

interface Relatorio {
  protocolo: { titulo: string; codigo: string; versao: string; regras: string[] }; base: number; linhas: Linha[];
  sintese: { demonstradas: string[]; continuidade: string[]; semDados: string[] }; conclusao: string;
  filtros: { faseId: number; escolaId: number | null; turmaId: number | null; turmas: { id: number; nome: string }[]; fases: { id: number; nome: string }[]; escolas: { id: number; nome: string }[] };
  geradoEm: string
}
export default function AplicadorRelatorioPage() {
  const [params, setParams] = useSearchParams()
  const [d, setDados] = useState<Relatorio | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [revisao, setRevisao] = useState(0)
  const [detalhes,setDetalhes]=useState(false)
  const dialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{
    if(detalhes&&!dialog.current?.open)dialog.current?.showModal()
    if(!detalhes&&dialog.current?.open)dialog.current.close()
  },[detalhes])
  const query = params.toString()
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setErro('');setDetalhes(false)
    api.get<Relatorio>(`/superadmin/aplicador/relatorio-terceira?${query}`, { signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) setDados(r.data) })
      .catch(e => { if (!controller.signal.aborted) setErro(e.response?.data?.error || 'Erro ao gerar relatório.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [query, revisao])
  const escola = d?.filtros.escolas.find(e => e.id === d.filtros.escolaId)?.nome || (d?.filtros.escolaId ? `Escola ${d.filtros.escolaId}` : 'Todas as escolas')
  const turma = d?.filtros.turmas.find(t => t.id === d.filtros.turmaId)?.nome || 'Todas as turmas'
  function baixarTexto() {
    if (!d) return
    const texto = [d.protocolo.titulo, `Protocolo: ${d.protocolo.codigo} · versão ${d.protocolo.versao}`,
      `Terceira fase · ${escola} · ${turma} · ${d.base} crianças · Gerado em ${new Date(d.geradoEm).toLocaleString('pt-BR')}`,
      'REGRAS', ...d.protocolo.regras,
      ...d.linhas.map(l => `\n${l.item} — ${l.habilidade}\n${l.interpretacao}${l.detalhesNome ? "\nTipo de nome | Sem apoio | Com apoio | Total\n" + l.detalhesNome.map(r => `${r.tipo}: ${r.semApoio} | ${r.comApoio} | ${r.total}`).join("\n") : ""}\nAvaliadas: ${l.avaliadas}/${l.base}. Sem resultado: ${l.ausentes}.\nLimite: ${l.limite}`),
      '\nHABILIDADES DEMONSTRADAS', ...d.sintese.demonstradas,
      '\nCONTINUIDADE PEDAGÓGICA', ...d.sintese.continuidade,
      '\nDADOS INSUFICIENTES', ...d.sintese.semDados, '\nCONCLUSÃO', d.conclusao].join('\n')
    const url = URL.createObjectURL(new Blob(['\ufeff' + texto], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `relatorio-terceira-avaliacao-v1${d.filtros.turmaId ? `-turma-${d.filtros.turmaId}` : ''}.txt`; a.click(); URL.revokeObjectURL(url)
  }
  return <div className="ag-page">
    <div className="ag-heading"><div><h1>Protocolo de Análise da Terceira Avaliação</h1><p>Resultados dos aplicadores e continuidade pedagógica na transição para o Ensino Fundamental.</p></div><Link to="/admin/aplicador/graficos?faseId=3">Ver gráficos</Link></div>
    <div className="ag-filtros"><label>Escola<select disabled={loading} value={params.get('escolaId') || ''} onChange={e => setParams(e.target.value ? { escolaId: e.target.value } : {})}>
      <option value="">Todas as escolas</option>{d?.filtros.escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
      <label>Turma<select disabled={loading || !params.get('escolaId')} value={params.get('turmaId') || ''} onChange={e => {
        const next = new URLSearchParams(params)
        if (e.target.value) next.set('turmaId', e.target.value); else next.delete('turmaId')
        setParams(next)
      }}><option value="">{params.get('escolaId') ? 'Todas as turmas' : 'Selecione uma escola'}</option>
        {d?.filtros.turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
      <button disabled={loading} onClick={() => setRevisao(v => v + 1)}>Atualizar</button>
      <button disabled={loading || !!erro || !d} onClick={baixarTexto}>Baixar relatório</button>
      <button disabled={loading || !!erro || !d} onClick={() => window.print()}>Imprimir / PDF</button></div>
    {loading && <p role="status">Gerando o relatório…</p>}{erro && <p role="alert">{erro}</p>}
    {!loading && !erro && d && <>
      <p className="ag-context">{d.filtros.fases.find(f=>f.id===d.filtros.faseId)?.nome} · {escola} · {turma} · {d.base} crianças com aplicação concluída</p>
      <details className="ar-metodo"><summary>Sobre o protocolo e os cálculos</summary>
        <p>{d.protocolo.codigo} · versão {d.protocolo.versao} · Gerado em {new Date(d.geradoEm).toLocaleString('pt-BR',{timeZone:'America/Cuiaba'})}</p>
        <ul>{d.protocolo.regras.map(r=><li key={r}>{r}</li>)}</ul>
      </details>
      {!d.base ? <p className="ag-card">{d.conclusao}</p> : <div className="ar-topicos">
        <section className="ag-card ar-topico" aria-labelledby="topico-consciencia">
          <header><span className="ar-etiqueta">Q1 a Q5</span><h2 id="topico-consciencia">Consciência Fonológica</h2><p>Compilação das respostas registradas nas cinco questões.</p></header>
          <GraficoConsciencia linhas={compilarConscienciaFonologica(d.linhas)}/>
          <button className="ar-detalhar" onClick={()=>setDetalhes(true)}>Ver questões 1 a 5 separadamente</button>
        </section>
        <section className="ag-card ar-topico" aria-labelledby="topico-escrita">
          <header><span className="ar-etiqueta">Q8</span><h2 id="topico-escrita">Fases da escrita</h2></header><ResultadoTopico linha={d.linhas.find(l=>l.item==='Q8')}/>
        </section>
        <section className="ag-card ar-topico" aria-labelledby="topico-leitura">
          <header><span className="ar-etiqueta">Q9</span><h2 id="topico-leitura">Fases da Leitura</h2></header>
          <ResultadoTopico linha={compilarResultados(d.linhas.filter(l=>l.item.startsWith('Q9-')),'Q9','Leitura por palavra')} leitura/>
        </section>
        <section className="ag-card ar-topico" aria-labelledby="topico-nome">
          <header><span className="ar-etiqueta">Q7</span><h2 id="topico-nome">Nome</h2></header><ResultadoTopico linha={d.linhas.find(l=>l.item==='Q7')} nome/>
        </section>
        <section className="ag-card ar-topico" aria-labelledby="topico-diferenciacao">
          <header><span className="ar-etiqueta">Q6</span><h2 id="topico-diferenciacao">Diferenciação Letras × Números</h2></header><ResultadoTopico linha={d.linhas.find(l=>l.item==='Q6')}/>
        </section>
      </div>}
      <dialog ref={dialog} className="ar-detail-dialog" aria-labelledby="titulo-detalhes-fonologicos" onClose={()=>setDetalhes(false)}>
        <header className="ar-dialog-heading"><div><h2 id="titulo-detalhes-fonologicos">Consciência Fonológica — questões 1 a 5</h2><p>{escola} · {turma} · {d.base} crianças com aplicação concluída</p></div>
          <button onClick={()=>dialog.current?.close()} aria-label="Fechar detalhamento">Fechar</button></header>
        <p>Resultados separados por questão, vogal e consoante, com os mesmos filtros do relatório.</p>
        {d.linhas.filter(l=>/^Q[1-5](?:-|$)/.test(l.item)).map(l=><article className="ar-item" key={l.item}>
          <div className="ar-item-text"><h3>{l.item} — {l.habilidade}</h3><p>Avaliadas: {l.avaliadas} de {l.base} · Sem resultado registrado: {l.ausentes}</p>
            <p>{l.interpretacao}</p><p><small>Limite da conclusão: {l.limite}</small></p></div>
          <ResultadoPizza item={l.item} avaliadas={l.avaliadas} resultados={l.resultados}/>
        </article>)}
      </dialog>
    </>}
  </div>
}

function GraficoConsciencia({linhas}:{linhas:Linha[]}) {
  const percentual=(n:number,base:number)=>base?(n/base*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—'
  return <figure className="ar-compilacao"><figcaption>Percentuais sobre as respostas válidas de cada questão</figcaption>
    <div className="ar-legenda"><span><i className="ar-sim"/>Demonstrou</span><span><i className="ar-nao"/>Não demonstrou</span></div>
    {linhas.map(l=>{
      const sim=l.resultados.find(r=>r.codigo==='SIM')?.n||0,nao=l.resultados.find(r=>r.codigo==='NAO')?.n||0
      return <div className="ar-compilacao-linha" key={l.item}>
        <div><strong>{l.item} · {l.habilidade}</strong><small>{l.avaliadas} {l.item==='Q2'?(l.avaliadas===1?'resposta por vogal':'respostas por vogal'):(l.avaliadas===1?'resposta válida':'respostas válidas')} · {l.ausentes} sem registro</small></div>
        <div><div className="ar-barra-composta" role="img" aria-label={`${l.item}: demonstrou ${sim} (${percentual(sim,l.avaliadas)}); não demonstrou ${nao} (${percentual(nao,l.avaliadas)}); sem registro ${l.ausentes}`}>
          {l.avaliadas?<><span className="ar-sim" style={{width:`${sim/l.avaliadas*100}%`}}/><span className="ar-nao" style={{width:`${nao/l.avaliadas*100}%`}}/></>:<span className="ar-sem-dados">Sem dados</span>}
        </div><small>Demonstrou: {sim} ({percentual(sim,l.avaliadas)}) · Não demonstrou: {nao} ({percentual(nao,l.avaliadas)})</small></div>
      </div>
    })}
    <p>Q2 reúne os registros por vogal. As demais questões representam respostas por criança. Os percentuais são calculados separadamente; registros ausentes não são tratados como erros.</p>
  </figure>
}
function ResultadoTopico({linha,nome=false,leitura=false}:{linha:Linha|undefined;nome?:boolean;leitura?:boolean}) {
  if(!linha)return <p>Não há resultados disponíveis para esta questão.</p>
  return <div className="ar-item"><div className="ar-item-text"><h3>{linha.habilidade}</h3>
    {leitura?<><p>{linha.avaliadas} {linha.avaliadas===1?'registro válido de leitura':'registros válidos de leitura'} · {linha.ausentes} sem registro.</p><p>Compilação das classificações por palavra. Cada criança pode contribuir com mais de um registro; o gráfico não atribui uma fase global de leitura à criança.</p></>:
      <><p>Avaliadas: {linha.avaliadas} de {linha.base} · Sem resultado registrado: {linha.ausentes}</p></>}
    {nome&&linha.detalhesNome&&<><div className="ag-scroll"><table><caption>Escrita do nome por tipo e apoio</caption>
      <thead><tr><th scope="col">Tipo de nome</th><th scope="col">Sem apoio</th><th scope="col">Com apoio</th><th scope="col">Total</th></tr></thead>
      <tbody>{linha.detalhesNome.map(r=><tr key={r.tipo}><th scope="row">{r.tipo}</th><td>{r.semApoio}</td><td>{r.comApoio}</td><td>{r.total}</td></tr>)}</tbody>
    </table></div><p>Não escreveram o nome: {linha.resultados.find(r=>r.codigo==='NAO_ESCREVE')?.n??0} crianças.</p><p><small>O tipo de nome é apresentado conforme registrado pelo aplicador. A falta desse detalhe não significa que a criança não escreveu.</small></p></>}
    {!leitura&&<p><small>Limite da conclusão: {linha.limite}</small></p>}
  </div><ResultadoPizza item={linha.item} avaliadas={linha.avaliadas} resultados={linha.resultados} unidade={leitura?(linha.avaliadas===1?'registro válido de leitura':'registros válidos de leitura'):undefined}/></div>
}
