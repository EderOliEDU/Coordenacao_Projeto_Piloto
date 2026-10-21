import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import ResultadoPizza from '../components/ResultadoPizza'
import './AplicadorGraficosPage.css'

interface Linha { item: string; habilidade: string; base: number; avaliadas: number; ausentes: number;
  resultados: { codigo: string; descricao: string; n: number; percentual: number | null }[]; interpretacao: string; limite: string }
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
  const query = params.toString()
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setErro('')
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
      ...d.linhas.map(l => `\n${l.item} — ${l.habilidade}\n${l.interpretacao}\nAvaliadas: ${l.avaliadas}/${l.base}. Sem resultado: ${l.ausentes}.\nLimite: ${l.limite}`),
      '\nHABILIDADES DEMONSTRADAS', ...d.sintese.demonstradas,
      '\nCONTINUIDADE PEDAGÓGICA', ...d.sintese.continuidade,
      '\nDADOS INSUFICIENTES', ...d.sintese.semDados, '\nCONCLUSÃO', d.conclusao].join('\n')
    const url = URL.createObjectURL(new Blob(['\ufeff' + texto], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `relatorio-terceira-avaliacao-v1${d.filtros.turmaId ? `-turma-${d.filtros.turmaId}` : ''}.txt`; a.click(); URL.revokeObjectURL(url)
  }
  return <div className="ag-page">
    <div className="ag-heading"><div><h1>Relatório padronizado da terceira avaliação</h1><p>Resultados dos aplicadores e continuidade pedagógica na transição para o Ensino Fundamental.</p></div><Link to="/admin/aplicador/graficos?faseId=3">Ver gráficos</Link></div>
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
      <section className="ag-card"><h2>{d.protocolo.titulo}</h2><p>{d.protocolo.codigo} · versão {d.protocolo.versao}</p>
        <p>Período: {d.filtros.fases.find(f => f.id === d.filtros.faseId)?.nome} · {escola} · {turma}<br />{d.base} crianças com aplicação concluída · Gerado em {new Date(d.geradoEm).toLocaleString('pt-BR')}</p>
        <h3>Regras de cálculo e interpretação</h3><ul>{d.protocolo.regras.map(r => <li key={r}>{r}</li>)}</ul></section>
      {!d.base ? <p className="ag-card">{d.conclusao}</p> : <>
        <section className="ag-card"><h2>Resultados por habilidade — Q1 a Q9</h2><p>Percentuais sobre respostas válidas de cada item. A ausência de resultado é informada separadamente.</p>
          {d.linhas.map(l => <article className="ar-item" key={l.item}><div className="ar-item-text"><h3>{l.item} — {l.habilidade}</h3>
            <p>Avaliadas: {l.avaliadas} de {l.base} · Sem resultado registrado: {l.ausentes}</p>
            <p>{l.interpretacao}</p><p><small>Limite da conclusão: {l.limite}</small></p></div><ResultadoPizza item={l.item} avaliadas={l.avaliadas} resultados={l.resultados} /></article>)}</section>
        <section className="ag-card"><h2>Habilidades demonstradas</h2>
          {d.sintese.demonstradas.length ? <ul>{d.sintese.demonstradas.map(texto => <li key={texto}>{texto}</li>)}</ul> : <p>Nenhum apontamento neste recorte.</p>}
        </section>
        {([['Necessidades de continuidade pedagógica', d.sintese.continuidade], ['Habilidades com dados insuficientes', d.sintese.semDados]] as const).map(([titulo, linhas]) =>
          <section className="ag-card" key={titulo}><h2>{titulo}</h2>{linhas.length ? <ul>{linhas.map(l => <li key={l}>{l}</li>)}</ul> : <p>Nenhum apontamento neste recorte.</p>}</section>)}
        <section className="ag-card"><h2>Síntese para a transição ao Ensino Fundamental</h2><p>{d.conclusao}</p></section>
      </>}
    </>}
  </div>
}
