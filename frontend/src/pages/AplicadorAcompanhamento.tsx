import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

interface Linha {
  idTurma: string
  idEscola: string
  nomeEscola: string
  etapa: string | null
  letraTurma: string | null
  turno: string | null
  aplicadores: { cpf: string; nome: string; atribuidoEm: string }[]
  alunos: { idAluno: string; nomeAluno: string; cpfAplicador: string | null;
    nomeAplicador: string | null; observacao: string | null; status: string | null }[]
}

export default function AplicadorAcompanhamento({ faseId, revisao }: { faseId: string; revisao: number }) {
  const [dados, setDados] = useState<Linha[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [escola, setEscola] = useState('')
  const [aplicador, setAplicador] = useState('')
  const [situacao, setSituacao] = useState('TODAS')
  const [busca, setBusca] = useState('')
  const [atualizacao, setAtualizacao] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setDados([])
    setErro('')
    if (!faseId) { setLoading(false); return }
    setLoading(true)
    fetch(`/api/superadmin/aplicador/atribuicoes/visao?idFase=${encodeURIComponent(faseId)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, signal: controller.signal
    }).then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Erro ao carregar acompanhamento.')
      if (!controller.signal.aborted) setDados(data)
    }).catch(error => {
      if (!controller.signal.aborted) setErro(error.message)
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [faseId, revisao, atualizacao])

  const escolas = useMemo(() => [...new Map(dados.map(t => [t.idEscola, t.nomeEscola])).entries()], [dados])
  const aplicadores = useMemo(() => {
    const mapa = new Map<string, string>()
    dados.forEach(t => {
      t.aplicadores.forEach(a => mapa.set(a.cpf, a.nome))
      t.alunos.forEach(a => { if (a.cpfAplicador) mapa.set(a.cpfAplicador, a.nomeAplicador || a.cpfAplicador) })
    })
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [dados])
  const linhas = dados.filter(t => (!escola || t.idEscola === escola) &&
    (!aplicador || t.aplicadores.some(a => a.cpf === aplicador) || t.alunos.some(a => a.cpfAplicador === aplicador)) &&
    (situacao === 'TODAS' || (situacao === 'ATRIBUIDAS' ? t.aplicadores.length > 0 : t.aplicadores.length === 0)) &&
    (!busca.trim() || [t.nomeEscola, t.etapa, t.letraTurma, t.idTurma, ...t.alunos.map(a => a.nomeAluno)]
      .join(' ').toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR'))))
  const alunos = linhas.flatMap(t => t.alunos)
  const concluidos = alunos.filter(a => a.status === 'CONCLUIDA').length

  return <section style={s.painel}>
    <div style={s.topo}><h2 style={{ margin: 0 }}>Acompanhamento das atribuições</h2>
      <button type="button" disabled={loading || !faseId} onClick={() => setAtualizacao(v => v + 1)}>Atualizar</button></div>
    <p>A turma pode ter vários aplicadores. O responsável pelo aluno aparece quando uma aplicação de verificação é iniciada.</p>
    <div style={s.filtros}>
      <label>Escola<select style={s.campo} value={escola} onChange={e => setEscola(e.target.value)}>
        <option value="">Todas as escolas</option>{escolas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></label>
      <label>Aplicador<select style={s.campo} value={aplicador} onChange={e => setAplicador(e.target.value)}>
        <option value="">Todos os aplicadores</option>{aplicadores.map(([cpf, nome]) => <option key={cpf} value={cpf}>{nome}</option>)}</select></label>
      <label>Atribuição<select style={s.campo} value={situacao} onChange={e => setSituacao(e.target.value)}>
        <option value="TODAS">Todas as turmas</option><option value="ATRIBUIDAS">Com atribuição ativa</option><option value="SEM">Sem atribuição ativa</option></select></label>
      <label>Buscar escola, turma ou aluno<input style={s.campo} value={busca} onChange={e => setBusca(e.target.value)} /></label>
    </div>
    {erro && <p role="alert" style={{ color: '#b71c1c' }}>{erro}</p>}
    {!faseId ? <p>Selecione uma fase para consultar.</p> : loading ? <p>Carregando acompanhamento...</p> : !erro && <>
      <p><strong>{new Set(linhas.map(t => t.idEscola)).size}</strong> escola(s) • <strong>{linhas.length}</strong> turma(s) • <strong>{linhas.filter(t => t.aplicadores.length > 0).length}</strong> turma(s) atribuída(s) • <strong>{alunos.length}</strong> vínculo(s) de aluno • <strong>{concluidos}</strong> avaliação(ões) concluída(s)</p>
      {aplicador && <p>O filtro mostra as turmas vinculadas ao aplicador ou com avaliações dele. Os detalhes mostram todos os responsáveis da turma.</p>}
      {linhas.length === 0 && <p>Nenhuma turma encontrada com estes filtros.</p>}
      {linhas.map(t => <details key={t.idTurma} style={s.turma}>
        <summary style={{ cursor: 'pointer' }}><strong>{t.nomeEscola} → {t.etapa || '-'} → Turma {t.letraTurma || t.idTurma} ({t.turno || '-'})</strong>
          <div style={{ marginTop: 6 }}>{t.aplicadores.length ? `Aplicadores: ${t.aplicadores.map(a => a.nome).join(', ')}` : 'Sem atribuição ativa'} • {t.alunos.length} aluno(s) • {t.alunos.filter(a => a.status === 'CONCLUIDA').length} concluído(s)</div></summary>
        {t.aplicadores.map(a => <p key={a.cpf} style={{ fontSize: 14 }}>{a.nome} — atribuído em {new Date(a.atribuidoEm).toLocaleString('pt-BR')}</p>)}
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14 }}>
          <thead><tr><th style={s.celula}>Aluno</th><th style={s.celula}>Aplicador responsável</th><th style={s.celula}>Situação</th><th style={s.celula}>Observação</th></tr></thead>
          <tbody>{t.alunos.map(a => <tr key={a.idAluno}>
            <td style={s.celula}>{a.nomeAluno}</td><td style={s.celula}>{a.nomeAplicador || 'Ainda sem responsável'}</td>
            <td style={s.celula}>{a.status === 'CONCLUIDA' ? 'Concluída' : a.status === 'EM_ANDAMENTO' ? 'Em andamento' : a.status === 'PENDENTE' ? 'Iniciada / pendente' : a.status || (t.aplicadores.length ? 'Disponível para os aplicadores da turma' : 'Turma sem atribuição')}</td>
            <td style={{ ...s.celula, whiteSpace: 'pre-wrap', minWidth: 220, overflowWrap: 'anywhere' }}>{a.observacao || '—'}</td>
          </tr>)}</tbody></table></div>
      </details>)}
    </>}
  </section>
}

const s: Record<string, CSSProperties> = {
  painel: { border: '1px solid #ddd', borderRadius: 10, padding: 20, marginBottom: 24, background: '#fff' },
  topo: { display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' },
  filtros: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 },
  campo: { width: '100%', boxSizing: 'border-box', padding: 10, marginTop: 6, border: '1px solid #bbb', borderRadius: 6 },
  turma: { border: '1px solid #ddd', padding: 14, borderRadius: 7, marginTop: 12 },
  celula: { textAlign: 'left', padding: 10, borderBottom: '1px solid #ddd' }
}
