import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import './AplicadorGraficosPage.css'

type Contagem = { versao: number; n: number }
interface Dados {
  filtros: { faseId: number | null; escolaId: number | null; versao: number | null;
    fases: { id: number; nome: string }[]; escolas: { id: number; nome: string }[] }
  resumo: { concluidas: number; emAndamento: number; pendentes: number; canceladas: number; alunos: number; turmas: number; aplicadores: number }
  versoes: { versao: number; total: number }[]
  perguntas: (Contagem & { ordem: number; codigo: string; pergunta: string; resposta: string; descricao: string })[]
  vogais: (Contagem & { vogal: string; acertou: boolean | null })[]
  consoantes: (Contagem & { letra: string; resposta: string })[]
  leitura: (Contagem & { ordem: number; palavra: string; classificacao: string; comMetadadosAudio: number })[]
  palavras: { palavra: string; ordem: number }[]
  classificacaoTurmas: { turmaId: number; turma: string; escola: string; professoras: string[]; versao: number;
    criancas: number; indice: number | null; posicao: number | null;
    resultados: { codigo: string; avaliadas: number; sim: number; percentual: number | null; ausentes: number | null; cobertura: number | null; detalhesNome: { codigo: string; descricao: string; n: number }[]; categorias: { codigo: string; descricao: string; n: number; percentual: number | null }[]; vogais: { vogal: string; avaliadas: number; sim: number; percentual: number | null }[] }[] }[]
  geradoEm: string
}
interface Parcela { label: string; n: number; color: string }
interface Linha { label: string; parcelas: Parcela[]; base: number }
const cores = ['#b46650', '#c49531', '#2867a5', '#287a66', '#adb9c8']
const categorias = [
  ['NAO_UTILIZA_SONS', 'Não utiliza sons'], ['UTILIZA_ALGUNS_SONS', 'Utiliza alguns sons'],
  ['DECODIFICA', 'Decodifica'], ['LE_AUTONOMIA', 'Lê com autonomia'], ['NAO_RESPONDEU', 'Não respondeu'],
]
const pct = (n: number, d: number) => d ? `${(100 * n / d).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'
const soma = (rs: { n: number }[]) => rs.reduce((s, r) => s + r.n, 0)

function Grafico({ titulo, nota, linhas }: { titulo: string; nota: string; linhas: Linha[] }) {
  return <section className="ag-card">
    <h3>{titulo}</h3><p>{nota}</p>
    <div className="ag-scroll"><table><caption className="ag-sr">{titulo}: contagens e percentuais sobre a base de cada linha</caption>
      <thead><tr><th scope="col">Item / base</th><th scope="col">Distribuição</th><th scope="col">Contagens e percentuais</th></tr></thead>
      <tbody>{linhas.map((l, index) => <tr key={`${l.label}-${index}`}>
        <th scope="row">{l.label}<small>Base: {l.base}</small></th>
        <td><div className="ag-bar" aria-hidden="true">{l.parcelas.filter(p => p.n > 0).map(p => <span key={p.label}
          title={`${p.label}: ${p.n} (${pct(p.n, l.base)})`}
          style={{ width: `${l.base ? 100 * p.n / l.base : 0}%`, background: p.color }} />)}</div></td>
        <td>{l.parcelas.map(p => <span className="ag-value" key={p.label}><i aria-hidden="true" style={{ background: p.color }} />
          {p.label}: <strong>{p.n}</strong> ({pct(p.n, l.base)})</span>)}</td>
      </tr>)}</tbody>
    </table></div>
  </section>
}

function exportar(dados: Dados) {
  const rows: (string | number)[][] = [['periodo_id', 'escola_id', 'versao', 'bloco', 'item', 'resposta', 'contagem', 'metadados_audio']]
  const add = (v: number, bloco: string, item: string, resposta: string, n: number, audio: number | string = '') =>
    rows.push([dados.filtros.faseId ?? '', dados.filtros.escolaId ?? '', v, bloco, item, resposta, n, audio])
  dados.versoes.forEach(r => add(r.versao, 'BASE_CONCLUIDAS', 'Aplicações', 'CONCLUIDA', r.total))
  dados.perguntas.forEach(r => add(r.versao, 'QUESTOES', r.codigo, r.resposta, r.n))
  dados.vogais.forEach(r => add(r.versao, 'Q2', r.vogal, r.acertou === null ? 'SEM_AVALIACAO' : r.acertou ? 'SIM' : 'NAO', r.n))
  dados.consoantes.forEach(r => add(r.versao, 'Q5', r.letra, r.resposta, r.n))
  dados.leitura.forEach(r => add(r.versao, 'Q9', r.palavra, r.classificacao, r.n, r.comMetadadosAudio))
  const cell = (v: string | number) => `"${String(v).replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`
  const blob = new Blob(['\ufeff' + rows.map(r => r.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = `aplicadores-periodo-${dados.filtros.faseId ?? 'vazio'}.csv`; a.click(); URL.revokeObjectURL(url)
}

export default function AplicadorGraficosPage() {
  const [params, setParams] = useSearchParams()
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(true)
  const [revisao, setRevisao] = useState(0)
  const [paginas, setPaginas] = useState<Record<number, number>>({})
  const query = params.toString()
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setErro(''); setPaginas({})
    api.get<Dados>(`/superadmin/aplicador/graficos?${query}`, { signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) setDados(r.data) })
      .catch(e => { if (!controller.signal.aborted) setErro(e.response?.data?.error || 'Não foi possível carregar os gráficos.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [query, revisao])
  function filtrar(key: string, value: string) {
    const next = new URLSearchParams(params)
    // Torna explícito o período padrão ao alterar outro filtro.
    if (!next.has('faseId') && dados?.filtros.faseId) next.set('faseId', String(dados.filtros.faseId))
    if (value) next.set(key, value); else next.delete(key)
    if (key === 'faseId') next.delete('escolaId')
    setParams(next)
  }
  const parcelas = (rs: { resposta: string; n: number; descricao: string }[], base: number): Parcela[] => [
    ...rs.map((r, i) => ({ label: r.descricao, n: r.n, color: r.resposta === 'SIM' ? '#287a66' : r.resposta === 'NAO' ? '#b46650' : cores[i % cores.length] })),
    { label: 'Sem resposta', n: Math.max(0, base - soma(rs)), color: '#dce2e9' },
  ]
  return <div className="ag-page">
    <div className="ag-heading"><div><h1>Gráficos das verificações por aplicadores</h1>
      <p>Distribuições e cobertura para revisão pedagógica das avaliações coletadas.</p></div>
      <div><p><Link to="/admin/aplicador/relatorio-terceira">Relatório padronizado da terceira avaliação</Link></p><Link to="/admin/aplicador/acompanhamento">Acompanhar verificações</Link></div></div>
    <div className="ag-filtros">
      <label>Período de avaliação<select value={params.get('faseId') || dados?.filtros.faseId || ''}
        disabled={loading} onChange={e => filtrar('faseId', e.target.value)}>
        {!dados?.filtros.fases.length && <option value="">Sem períodos disponíveis</option>}
        {dados?.filtros.fases.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
      <label>Escola<select value={params.get('escolaId') || ''} disabled={loading} onChange={e => filtrar('escolaId', e.target.value)}>
        <option value="">Todas as escolas</option>{dados?.filtros.escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
      <label>Versão do instrumento<select value={params.get('versao') || ''} disabled={loading} onChange={e => filtrar('versao', e.target.value)}>
        <option value="">Todas, apresentadas separadamente</option><option value="1">Versão 1</option><option value="2">Versão 2</option></select></label>
      <button onClick={() => setRevisao(v => v + 1)} disabled={loading}>Atualizar</button>
      <button disabled={loading || !!erro || !dados} onClick={() => dados && exportar(dados)}>Exportar CSV</button>
      <button disabled={loading || !!erro || !dados} onClick={() => window.print()}>Imprimir / PDF</button>
    </div>
    {loading && <p role="status">Carregando os gráficos…</p>}
    {erro && <p role="alert">{erro}</p>}
    {!loading && !erro && dados && <>
      <p className="ag-context">Período: {dados.filtros.fases.find(f => f.id === dados.filtros.faseId)?.nome || 'Nenhum'} · Escola: {dados.filtros.escolas.find(e => e.id === dados.filtros.escolaId)?.nome || 'Todas'} · Atualizado em {new Date(dados.geradoEm).toLocaleString('pt-BR')}</p>
      <div className="ag-resumo">{[['Avaliações concluídas', dados.resumo.concluidas], ['Alunos nas concluídas', dados.resumo.alunos],
        ['Turmas nas concluídas', dados.resumo.turmas], ['Aplicadores nas concluídas', dados.resumo.aplicadores]].map(([l, n]) => <div key={l}><strong>{n}</strong><span>{l}</span></div>)}</div>
      <Grafico titulo="Andamento da coleta" nota={`Conclusão entre aplicações não canceladas: ${pct(dados.resumo.concluidas, dados.resumo.concluidas + dados.resumo.emAndamento + dados.resumo.pendentes)}. Não representa cobertura de todos os alunos elegíveis.`}
        linhas={[{ label: 'Aplicações registradas', base: dados.resumo.concluidas + dados.resumo.emAndamento + dados.resumo.pendentes + dados.resumo.canceladas,
          parcelas: [{ label: 'Concluídas', n: dados.resumo.concluidas, color: '#287a66' }, { label: 'Em andamento', n: dados.resumo.emAndamento, color: '#2867a5' },
            { label: 'Pendentes', n: dados.resumo.pendentes, color: '#c49531' }, { label: 'Canceladas', n: dados.resumo.canceladas, color: '#dce2e9' }] }]} />
      {!dados.versoes.length && <p className="ag-card">Nenhuma avaliação concluída neste recorte. Ajuste os filtros para consultar outro período, escola ou versão.</p>}
      {dados.versoes.map(v => {
        const ps = dados.perguntas.filter(r => r.versao === v.versao)
        const vs = dados.vogais.filter(r => r.versao === v.versao)
        const cs = dados.consoantes.filter(r => r.versao === v.versao)
        const ls = dados.leitura.filter(r => r.versao === v.versao)
        const turmasClassificacao = dados.classificacaoTurmas.filter(t => t.versao === v.versao)
        const totalPaginas = Math.max(1, Math.ceil(turmasClassificacao.length / 5))
        const pagina = Math.min(paginas[v.versao] || 1, totalPaginas)
        const inicio = (pagina - 1) * 5
        const mudarPagina = (nova: number) => setPaginas(atual => ({ ...atual, [v.versao]: nova }))
        return <section key={v.versao} aria-label={`Instrumento versão ${v.versao}`}>
          <h2>Instrumento versão {v.versao} · {v.total} avaliações concluídas</h2>
          <section className="ag-card ag-classificacao"><h3>Classificação das turmas — bloco de habilidades Q1 a Q8</h3>
            <p>Ordem pela média dos oito indicadores, com peso igual por questão. Q1 a Q6 usam o percentual de SIM. Na Q2, calcula-se o percentual de SIM de cada vogal e depois a média das vogais com respostas válidas. A Q2 contribui uma única vez na média do bloco. Q7 usa o percentual de escrita do nome sem apoio; Q8 usa o percentual de classificações alfabética completa ou consolidada. A leitura Q9 é apresentada separadamente.</p>
            <p>Somente aplicações concluídas, uma por criança nesta versão. Q7 e Q8 usam somente respostas válidas; a ausência de avaliação não conta como erro. Os detalhes do nome não geram pontos adicionais. As professoras são as vinculadas atualmente à turma. Consulte também o número de crianças avaliadas e os resultados de cada habilidade.</p>
            <div className="ag-scroll"><table><caption className="ag-sr">Classificação das turmas, professoras e média de Q1 a Q8, versão {v.versao}</caption>
              <thead><tr><th scope="col">Posição</th><th scope="col">Turma e professora</th><th scope="col">Índice do bloco Q1–Q8</th><th scope="col">Q7 · Nome sem apoio</th><th scope="col">Q8 · Escrita completa ou consolidada</th><th scope="col">Crianças avaliadas</th></tr></thead>
              <tbody>{turmasClassificacao.slice(inicio, inicio + 5).map(t => <tr key={t.turmaId}>
                <td>{t.posicao === null ? '—' : `${t.posicao}º`}</td><th scope="row"><strong>{t.turma}</strong><small>{t.escola}</small>
                  <span className="ag-professora">{t.professoras.length ? t.professoras.join(' · ') : 'Professora não identificada no cadastro'}</span></th>
                <td>{t.indice === null ? <span>Dados insuficientes para classificar</span> : <><div className="ag-bar" aria-hidden="true"><span style={{ width: `${t.indice}%`, background: '#2867a5' }} /></div><strong>{pct(t.indice, 100)}</strong></>}
                  <details><summary>Ver cálculo por habilidade</summary><ul>{t.resultados.map(r => <li key={r.codigo}>{({ RIMAS: 'Q1 · Rimas', ALITERACAO: 'Q2 · Vogais', CONSCIENCIA_PALAVRAS: 'Q3 · Palavras da frase', CONSCIENCIA_SILABICA: 'Q4 · Sílabas', RELACAO_LETRA_SOM: 'Q5 · Consoante', LETRAS_NUMEROS: 'Q6 · Letras e números', ESCRITA_NOME: 'Q7 · Nome sem apoio', NIVEL_ESCRITA: 'Q8 · Escrita alfabética completa ou consolidada' } as Record<string, string>)[r.codigo]}: {r.codigo === 'ALITERACAO' ? <>média das vogais avaliadas: {r.percentual === null ? 'sem dados' : pct(r.percentual, 100)}<ul>{r.vogais.map(v => <li key={v.vogal}>{v.vogal}: {v.sim}/{v.avaliadas} ({v.percentual === null ? 'sem dados' : pct(v.percentual, 100)})</li>)}</ul></> : <>{r.sim}/{r.avaliadas} ({r.percentual === null ? 'sem dados' : pct(r.percentual, 100)})</>}{r.categorias.length > 0 && <>
                    <p>Avaliadas: {r.avaliadas}/{t.criancas} · Cobertura: {r.cobertura === null ? 'sem dados' : pct(r.cobertura,100)} · Sem avaliação: {r.ausentes}</p>
                    <ul>{r.categorias.map(c => <li key={c.codigo}>{c.descricao}: {c.n} ({c.percentual === null ? 'sem dados' : pct(c.percentual,100)})</li>)}</ul>
                    {r.detalhesNome.length > 0 && <><p>Detalhe entre quem escreveu com ou sem apoio (sem pontos adicionais):</p><ul>{r.detalhesNome.map(c => <li key={c.codigo}>{c.descricao}: {c.n}</li>)}</ul></>}
                  </>}</li>)}</ul></details>
                </td>{['ESCRITA_NOME','NIVEL_ESCRITA'].map(codigo => {
                  const r = t.resultados.find(r => r.codigo === codigo)
                  return <td className="ag-indicador-escrita" key={codigo}>{!r || r.percentual === null ? <strong>Sem dados</strong> : <>
                    <div className="ag-bar" aria-hidden="true"><span style={{ width:`${r.percentual}%`,background:'#287a66' }} /></div>
                    <strong>{pct(r.percentual,100)}</strong><small>{r.sim}/{r.avaliadas} atingiram o critério</small></>}
                    <small>Avaliadas: {r?.avaliadas ?? 0}/{t.criancas}</small><small>Cobertura: {r?.cobertura === null || r?.cobertura === undefined ? '—' : pct(r.cobertura,100)}</small>
                  </td>
                })}<td>{t.criancas}</td>
              </tr>)}</tbody></table></div>
            <div className="ag-paginacao">
              <p role="status" aria-live="polite">Mostrando {turmasClassificacao.length ? inicio + 1 : 0} a {Math.min(inicio + 5, turmasClassificacao.length)} de {turmasClassificacao.length} turmas · Página {pagina} de {totalPaginas}</p>
              <nav aria-label={`Paginação da classificação de turmas, versão ${v.versao}`}>
                <button type="button" disabled={pagina === 1} onClick={() => mudarPagina(pagina - 1)}>Anterior</button>
                <label>Página<select aria-label={`Página da classificação, versão ${v.versao}`} value={pagina} onChange={e => mudarPagina(Number(e.target.value))}>
                  {Array.from({ length: totalPaginas }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                </select></label>
                <button type="button" disabled={pagina === totalPaginas} onClick={() => mudarPagina(pagina + 1)}>Próxima</button>
              </nav>
            </div>
            <p>Empates na média exibida compartilham a posição. Turmas sem respostas válidas em alguma das oito questões ficam sem classificação. A ordem descreve os resultados observados no recorte, sem alterar o Protocolo V1.</p>
          </section>
          <Grafico titulo="Respostas por habilidade" nota="Contagens e percentuais sobre as aplicações concluídas desta versão. Ausência de resposta permanece separada. Não somar habilidades em uma nota de Ehri."
            linhas={[...new Set(ps.map(r => r.codigo))].filter(c => !['ESCRITA_NOME', 'NIVEL_ESCRITA'].includes(c)).map(c => {
              const rs = ps.filter(r => r.codigo === c)
              return { label: `Q${rs[0].ordem} · ${rs[0].pergunta}`, base: v.total, parcelas: parcelas(rs, v.total) }
            })} />
          <Grafico titulo="Q2 · Cobertura das vogais" nota="Cada vogal usa todas as aplicações concluídas como base. Posições sem avaliação não contam como erros."
            linhas={['A', 'E', 'I', 'O', 'U'].map(vogal => {
              const n = soma(vs.filter(r => r.vogal === vogal && r.acertou !== null))
              return { label: vogal, base: v.total, parcelas: [{ label: 'Avaliada', n, color: '#2867a5' }, { label: 'Sem avaliação', n: v.total - n, color: '#dce2e9' }] }
            })} />
          <Grafico titulo="Q2 · Respostas por vogal" nota="Percentuais calculados sobre as respostas avaliadas de cada vogal. Posições sem avaliação aparecem no gráfico de cobertura."
            linhas={['A', 'E', 'I', 'O', 'U'].map(vogal => {
              const rs = vs.filter(r => r.vogal === vogal && r.acertou !== null)
              return { label: vogal, base: soma(rs), parcelas: [{ label: 'SIM', n: soma(rs.filter(r => r.acertou === true)), color: '#287a66' }, { label: 'NÃO', n: soma(rs.filter(r => r.acertou === false)), color: '#b46650' }] }
            })} />
          <Grafico titulo="Q5 · Consoante selecionada" nota="Base de cada linha: respostas sobre aquela letra. Uma consoante por aplicação; escolha do aplicador e grupos pequenos impedem interpretar as barras como ranking de dificuldade. O histórico não certifica uso do critério novo."
            linhas={[...new Set(cs.map(r => r.letra))].map(letra => {
              const rs = cs.filter(r => r.letra === letra)
              return { label: letra, base: soma(rs), parcelas: ['SIM', 'NAO'].map((resposta, i) => ({ label: resposta === 'SIM' ? 'SIM' : 'NÃO', n: soma(rs.filter(r => r.resposta === resposta)), color: i ? '#b46650' : '#287a66' })) }
            })} />
          <Grafico titulo="Q7 e Q8 · Escrita" nota="Q8 é opcional no fluxo atual. Seus rótulos são julgamentos registrados, ainda sem validação em produções. Escrever o nome sem apoio não comprova escrita produtiva de palavras novas."
            linhas={['ESCRITA_NOME', 'NIVEL_ESCRITA'].map(c => {
              const rs = ps.filter(r => r.codigo === c)
              return { label: c === 'ESCRITA_NOME' ? 'Q7 · Nome próprio' : 'Q8 · Classificação da escrita', base: v.total, parcelas: parcelas(rs, v.total) }
            })} />
          <Grafico titulo="Q9 · Classificações por palavra" nota="Uma marcação por criança e palavra. As palavras da mesma criança não são observações independentes. Autonomia registrada não comprova fase consolidada."
            linhas={dados.palavras.map(p => {
              const rs = ls.filter(r => r.palavra === p.palavra)
              return { label: p.palavra, base: v.total, parcelas: [...categorias.map(([c, label], i) => ({ label, n: soma(rs.filter(r => r.classificacao === c)), color: cores[i] })), { label: 'Sem registro', n: Math.max(0, v.total - soma(rs)), color: '#dce2e9' }] }
            })} />
          <Grafico titulo="Q9 · Metadados de áudio para revisão" nota="Referência de arquivo e tamanho positivo não confirmam acesso, integridade ou qualidade sonora. Não são verificações do conteúdo do áudio."
            linhas={categorias.map(([c, label]) => {
              const rs = ls.filter(r => r.classificacao === c); const n = rs.reduce((s, r) => s + r.comMetadadosAudio, 0)
              return { label, base: soma(rs), parcelas: [{ label: 'Referência e tamanho positivo', n, color: '#2867a5' }, { label: 'Sem esses metadados', n: soma(rs) - n, color: '#dce2e9' }] }
            })} />
        </section>
      })}
      <aside className="ag-card"><h2>Limites desta análise</h2><p>Os gráficos descrevem os registros e sua cobertura. Validar as classificações exige revisão independente das evidências e comparação entre avaliadores. Nenhuma fase de aprendizagem é atribuída automaticamente por este painel.</p></aside>
    </>}
  </div>
}
