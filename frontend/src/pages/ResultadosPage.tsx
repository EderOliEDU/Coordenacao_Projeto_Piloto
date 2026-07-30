import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'

interface EscolaFiltro { id: string; nome: string }
interface EtapaFiltro { id: string; nome: string; escolaId: string; escolaNome: string }
interface ProfessorFiltro { cpf: string; nome: string }
interface TurmaFiltro { id: string; nome: string; escolaId: string; escolaNome: string; etapaId?: string; etapaDescricao?: string; turno?: string }
interface FaseFiltro { id: number; nome: string; dataInicio: string; dataFim: string; ativa: boolean; ordem: number }
interface Resumo {
  totalAlunos: number
  totalTurmas: number
  totalEscolas: number
  totalProfessores: number
  avaliacoesEsperadas: number
  finalizados: number
  rascunhos: number
  submissoes: number
  pendentes: number
  respostas: number
  percentualFinalizacao: number
}
interface OpcaoResultado {
  id: string
  sigla: string
  descricao: string
  corHex: string | null
  simbolo: string
  total: number
  percentual: number
  ordem?: number
}
interface PerguntaResultado {
  perguntaId: string
  perguntaTexto: string
  grupoNome: string
  tipoEscala: string
  total: number
  totalValidas: number
  dificuldade: number
  percentualDificuldade: number
  percentualDominio: number
  opcoes: OpcaoResultado[]
}
interface EixoResultado {
  id: string
  nome: string
  total: number
  percentualDominio: number
  percentualDificuldade: number
  perguntas: PerguntaResultado[]
}
interface StatusResumo { status: string; total: number; percentual: number }
interface EscolaResumo {
  id: string
  nome: string
  totalAlunos: number
  totalTurmas: number
  avaliacoesEsperadas: number
  finalizados: number
  percentualFinalizacao: number
}
interface ProfessorResumo {
  cpf: string
  nome: string
  totalEscolas: number
  totalTurmas: number
  totalAlunos: number
  avaliacoesEsperadas: number
  finalizados: number
  percentualFinalizacao: number
}
interface PendenciaResumo {
  escolaId: string
  escolaNome: string
  turmaId: string
  turmaNome: string
  turno: string
  avaliacoesEsperadas: number
  submissoes: number
  pendentes: number
  percentualPendente: number
}
interface ObservacaoTurma {
  alunoId: string
  alunoNome: string
  observacao: string
  status: string
  atualizadoEm: string | null
}
interface ResultadosResponse {
  filtros: {
    visao: string
    status: string
    escolas: EscolaFiltro[]
    etapas: EtapaFiltro[]
    turmas: TurmaFiltro[]
    professores: ProfessorFiltro[]
    fases: FaseFiltro[]
    faseAtual: FaseFiltro | null
  }
  resumo: Resumo
  statusResumo: StatusResumo[]
  opcoesResumo: OpcaoResultado[]
  eixos: EixoResultado[]
  habilidadesCriticas: PerguntaResultado[]
  escolasResumo: EscolaResumo[]
  professoresResumo: ProfessorResumo[]
  pendenciasResumo: PendenciaResumo[]
  observacoesTurma: ObservacaoTurma[]
}

const emptyData: ResultadosResponse = {
  filtros: { visao: 'GERAL', status: 'TODOS', escolas: [], etapas: [], turmas: [], professores: [], fases: [], faseAtual: null },
  resumo: {
    totalAlunos: 0,
    totalTurmas: 0,
    totalEscolas: 0,
    totalProfessores: 0,
    avaliacoesEsperadas: 0,
    finalizados: 0,
    rascunhos: 0,
    submissoes: 0,
    pendentes: 0,
    respostas: 0,
    percentualFinalizacao: 0,
  },
  statusResumo: [],
  opcoesResumo: [],
  eixos: [],
  habilidadesCriticas: [],
  escolasResumo: [],
  professoresResumo: [],
  pendenciasResumo: [],
  observacoesTurma: [],
}

const statusLabels: Record<string, string> = {
  FINALIZADO: 'Finalizados',
  RASCUNHO: 'Rascunhos',
  PENDENTE: 'Pendentes',
  TODOS: 'Todos',
}

function pct(value: number) {
  return `${Number.isFinite(value) ? Math.max(0, Math.min(value, 100)) : 0}%`
}

function number(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value || 0)
}

function formatCpf(cpf: string) {
  return (cpf || '').replace(/\D/g, '').padStart(11, '0').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

interface ColunaResposta {
  key: string
  siglas: string[]
  label: string
  color: string
  ordem: number
}

const respostaColumns: ColunaResposta[] = [
  { key: 'SIM', siglas: ['SIM', 'S'], label: 'SIM', color: '#2ECC71', ordem: 1 },
  { key: 'NAO', siglas: ['NAO', 'NÃO', 'N'], label: 'NAO', color: '#F39C12', ordem: 2 },
  { key: 'SF', siglas: ['SF'], label: 'SF', color: '#2ECC71', ordem: 10 },
  { key: 'SFP', siglas: ['SFP'], label: 'SFP', color: '#3498DB', ordem: 11 },
  { key: 'NSF', siglas: ['NSF'], label: 'NSF', color: '#F39C12', ordem: 12 },
  { key: 'PEA-D', siglas: ['PEA-D', 'D'], label: 'Domina', color: '#2ECC71', ordem: 20 },
  { key: 'PEA-PD', siglas: ['PEA-PD', 'PD'], label: 'Pouca dificuldade', color: '#3498DB', ordem: 21 },
  { key: 'PEA-TD', siglas: ['PEA-TD', 'TD'], label: 'Tem dificuldade', color: '#F1C40F', ordem: 22 },
  { key: 'PEA-NDA', siglas: ['PEA-NDA', 'NDA', 'ND'], label: 'Nao domina ainda', color: '#F39C12', ordem: 23 },
]

function corOpcao(opcao: OpcaoResultado | undefined, fallback: string) {
  return opcao?.corHex || fallback
}

function opcaoPorSiglas(pergunta: PerguntaResultado, siglas: string[]) {
  const aliases = new Set(siglas.map((sigla) => sigla.toUpperCase()))
  return pergunta.opcoes.find((opcao) => aliases.has(String(opcao.sigla || '').toUpperCase()))
}

function colunasDaPergunta(pergunta: PerguntaResultado) {
  const siglasDaPergunta = new Set(pergunta.opcoes.map((opcao) => String(opcao.sigla || '').toUpperCase()))
  return respostaColumns
    .filter((coluna) => coluna.siglas.some((sigla) => siglasDaPergunta.has(sigla.toUpperCase())))
    .sort((a, b) => a.ordem - b.ordem)
}

function agruparPerguntasPorColunas(eixo: EixoResultado) {
  const grupos = new Map<string, { colunas: ColunaResposta[]; perguntas: PerguntaResultado[] }>()

  for (const pergunta of eixo.perguntas) {
    const colunas = colunasDaPergunta(pergunta)
    const key = colunas.map((coluna) => coluna.key).join('|') || `pergunta-${pergunta.perguntaId}`
    if (!grupos.has(key)) grupos.set(key, { colunas, perguntas: [] })
    grupos.get(key)!.perguntas.push(pergunta)
  }

  return Array.from(grupos.values())
}

const card = {
  background: '#fff',
  border: '1px solid var(--line)',
  borderRadius: 8,
  boxShadow: '0 5px 18px rgba(15, 42, 74, 0.06)',
} as const

function ProgressBar({ value, color = 'var(--pmr-green)' }: { value: number; color?: string }) {
  return (
    <div style={{ height: 8, background: '#edf2f7', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: pct(value), height: '100%', background: color }} />
    </div>
  )
}

export default function ResultadosPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<ResultadosResponse>(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visao, setVisao] = useState(searchParams.get('visao') || 'GERAL')
  const [escolaId, setEscolaId] = useState(searchParams.get('escolaId') || '')
  const [etapaId, setEtapaId] = useState(searchParams.get('etapaId') || '')
  const [turmaId, setTurmaId] = useState(searchParams.get('turmaId') || '')
  const [professorCpf, setProfessorCpf] = useState(searchParams.get('professorCpf') || '')
  const [status, setStatus] = useState(searchParams.get('status') || 'TODOS')
  const [faseId, setFaseId] = useState(searchParams.get('faseId') || '')

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('visao', visao)
    params.set('status', status)
    if (escolaId) params.set('escolaId', escolaId)
    if (etapaId) params.set('etapaId', etapaId)
    if (turmaId) params.set('turmaId', turmaId)
    if (professorCpf) params.set('professorCpf', professorCpf)
    if (faseId) params.set('faseId', faseId)

    setLoading(true)
    setError(null)
    api.get(`/resultados?${params.toString()}`)
      .then((res) => {
        const nextData = res.data || emptyData
        setData(nextData)
        if (!faseId && nextData.filtros?.faseAtual?.id) setFaseId(String(nextData.filtros.faseAtual.id))
      })
      .catch((err) => setError(err.response?.data?.error || 'Erro ao carregar resultados.'))
      .finally(() => setLoading(false))
  }, [visao, escolaId, etapaId, turmaId, professorCpf, status, faseId])

  const etapasFiltradas = useMemo(() => {
    if (!escolaId) return []
    return data.filtros.etapas.filter((etapa) => etapa.escolaId === escolaId)
  }, [data.filtros.etapas, escolaId])

  const turmasFiltradas = useMemo(() => {
    return data.filtros.turmas.filter((turma) => {
      if (escolaId && turma.escolaId !== escolaId) return false
      if (etapaId && String(turma.etapaId || '') !== etapaId) return false
      return true
    })
  }, [data.filtros.turmas, escolaId, etapaId])

  const professorDelimitado = Boolean(professorCpf) || data.filtros.professores.length === 1

  function mudarVisao(value: string) {
    setVisao(value)
    setEscolaId('')
    setEtapaId('')
    setTurmaId('')
    setProfessorCpf('')
  }

  function mudarEscola(value: string) {
    setEscolaId(value)
    setEtapaId('')
    setTurmaId('')
  }

  function mudarEtapa(value: string) {
    setEtapaId(value)
    setTurmaId('')
  }

  function filtrosAtuaisParams() {
    const params = new URLSearchParams()
    params.set('visao', visao)
    params.set('status', status)
    if (escolaId) params.set('escolaId', escolaId)
    if (etapaId) params.set('etapaId', etapaId)
    if (turmaId) params.set('turmaId', turmaId)
    if (professorCpf) params.set('professorCpf', professorCpf)
    if (faseId) params.set('faseId', faseId)
    return params
  }

  function abrirGraficos() {
    navigate(`/resultados/graficos?${filtrosAtuaisParams().toString()}`)
  }

  const metricas = [
    { label: 'Escolas', value: data.resumo.totalEscolas },
    { label: 'Turmas', value: data.resumo.totalTurmas },
    { label: 'Professores', value: data.resumo.totalProfessores },
    { label: 'Alunos', value: data.resumo.totalAlunos },
    { label: 'Finalizados', value: data.resumo.finalizados },
    { label: 'Pendentes', value: data.resumo.pendentes },
    { label: '% Concluido', value: pct(data.resumo.percentualFinalizacao) },
  ]

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div className="page-title">
          <h1>Painel de resultados</h1>
          <p>Gestao da aplicacao e dos indicadores pedagogicos do Projeto Instrucao Fonica.</p>
        </div>
        <div className="actions">
          <label className="field" style={{ margin: 0, minWidth: 220 }}>
            <span>Fase</span>
            <select value={faseId} onChange={(event) => setFaseId(event.target.value)}>
              <option value="">Fase atual</option>
              {data.filtros.fases.map((fase) => (
                <option key={fase.id} value={fase.id}>{fase.nome}</option>
              ))}
            </select>
          </label>
          <button onClick={abrirGraficos} className="primary-btn">Ver graficos</button>
          <button onClick={() => navigate('/turmas')} className="secondary-btn">Voltar</button>
        </div>
      </div>

      <section style={{ ...card, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          <label className="field" style={{ margin: 0 }}>
            <span>Visao</span>
            <select value={visao} onChange={(event) => mudarVisao(event.target.value)}>
              <option value="GERAL">Todas as escolas permitidas</option>
              <option value="ESCOLA">Uma escola</option>
              <option value="PROFESSOR">Um professor</option>
            </select>
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span>Escola</span>
            <select value={escolaId} onChange={(event) => mudarEscola(event.target.value)}>
              <option value="">Todas</option>
              {data.filtros.escolas.map((escola) => <option key={escola.id} value={escola.id}>{escola.nome}</option>)}
            </select>
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span>Etapa</span>
            <select value={etapaId} onChange={(event) => mudarEtapa(event.target.value)} disabled={!escolaId}>
              <option value="">{escolaId ? 'Todas' : 'Selecione uma escola'}</option>
              {etapasFiltradas.map((etapa) => <option key={`${etapa.escolaId}-${etapa.id}`} value={etapa.id}>{etapa.escolaNome} - {etapa.nome}</option>)}
            </select>
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span>Turma</span>
            <select value={turmaId} onChange={(event) => setTurmaId(event.target.value)}>
              <option value="">Todas</option>
              {turmasFiltradas.map((turma) => <option key={turma.id} value={turma.id}>{turma.escolaNome} - {turma.nome}</option>)}
            </select>
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span>Professor</span>
            <select value={professorCpf} onChange={(event) => setProfessorCpf(event.target.value)}>
              <option value="">Todos</option>
              {data.filtros.professores.map((professor) => (
                <option key={professor.cpf} value={professor.cpf}>{professor.nome} - {formatCpf(professor.cpf)}</option>
              ))}
            </select>
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span>Respostas</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="TODOS">Todas as opcoes</option>
              <option value="FINALIZADO">Somente finalizadas</option>
              <option value="RASCUNHO">Somente rascunhos</option>
            </select>
          </label>
        </div>
      </section>

      {loading && <p className="loading-text">Carregando painel...</p>}
      {!loading && error && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 12, marginBottom: 16 }}>
            {metricas.map((item) => (
              <div key={item.label} style={{ ...card, padding: '16px 18px' }}>
                <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>{item.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginTop: 6 }}>
                  {typeof item.value === 'number' ? number(item.value) : item.value}
                </div>
              </div>
            ))}
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: 16, alignItems: 'stretch', marginBottom: 16 }}>
            <div style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', minHeight: 360, maxHeight: 460 }}>
              <h2 style={{ margin: '0 0 14px', fontSize: 17, color: 'var(--pmr-blue-dark)' }}>Gestao por escola</h2>
              <div style={{ overflow: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 520 }}>
                  <thead>
                    <tr style={{ color: 'var(--muted)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 6px' }}>Escola</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>Turmas</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>Alunos</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>% Concluido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.escolasResumo.map((escola) => (
                      <tr key={escola.id} style={{ borderTop: '1px solid #edf2f7' }}>
                        <td style={{ padding: '10px 6px', fontWeight: 700 }}>{escola.nome}</td>
                        <td style={{ padding: '10px 6px', textAlign: 'right' }}>{number(escola.totalTurmas)}</td>
                        <td style={{ padding: '10px 6px', textAlign: 'right' }}>{number(escola.avaliacoesEsperadas)}</td>
                        <td style={{ padding: '10px 6px', textAlign: 'right' }}>{pct(escola.percentualFinalizacao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', minHeight: 360, maxHeight: 460 }}>
              <h2 style={{ margin: '0 0 14px', fontSize: 17, color: 'var(--pmr-blue-dark)' }}>Gestao por professor</h2>
              <div style={{ overflow: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 620 }}>
                  <thead>
                    <tr style={{ color: 'var(--muted)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 6px' }}>Professor</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>Turmas</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>Alunos</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>Finalizados</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>% Concluido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.professoresResumo.map((professor) => (
                      <tr key={professor.cpf} style={{ borderTop: '1px solid #edf2f7' }}>
                        <td style={{ padding: '10px 6px' }}>
                          <strong>{professor.nome}</strong>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{formatCpf(professor.cpf)}</div>
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'right' }}>{number(professor.totalTurmas)}</td>
                        <td style={{ padding: '10px 6px', textAlign: 'right' }}>{number(professor.avaliacoesEsperadas)}</td>
                        <td style={{ padding: '10px 6px', textAlign: 'right' }}>{number(professor.finalizados)}</td>
                        <td style={{ padding: '10px 6px', textAlign: 'right' }}>{pct(professor.percentualFinalizacao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, alignItems: 'start', marginBottom: 16 }}>
            <div style={{ ...card, padding: 18 }}>
              <h2 style={{ margin: '0 0 14px', fontSize: 17, color: 'var(--pmr-blue-dark)' }}>Cobertura da aplicacao</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                {data.statusResumo.map((item) => (
                  <div key={item.status}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6, fontSize: 13 }}>
                      <strong>{statusLabels[item.status] || item.status}</strong>
                      <span>{number(item.total)} ({pct(item.percentual)})</span>
                    </div>
                    <ProgressBar value={item.percentual} color={item.status === 'FINALIZADO' ? 'var(--pmr-green)' : item.status === 'RASCUNHO' ? 'var(--pmr-yellow)' : 'var(--muted)'} />
                  </div>
                ))}
                {data.statusResumo.length === 0 && <p className="empty-state" style={{ margin: 0 }}>Sem registros no escopo selecionado.</p>}
              </div>
            </div>
          </section>

          {turmaId && (
            <section style={{ ...card, padding: 18, marginBottom: 16 }}>
              <h2 style={{ margin: '0 0 14px', fontSize: 17, color: 'var(--pmr-blue-dark)' }}>Observacoes da turma</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {data.observacoesTurma.map((item) => (
                  <div key={item.alunoId} style={{ borderTop: '1px solid #edf2f7', paddingTop: 10 }}>
                    <strong style={{ display: 'block', marginBottom: 4 }}>{item.alunoNome}</strong>
                    <p style={{ margin: 0, color: '#475867', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{item.observacao}</p>
                  </div>
                ))}
                {data.observacoesTurma.length === 0 && (
                  <p className="empty-state" style={{ margin: 0 }}>Nao ha observacoes preenchidas para esta turma.</p>
                )}
              </div>
            </section>
          )}

          <section style={{ ...card, padding: 18, overflowX: 'auto', marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 14px', fontSize: 17, color: 'var(--pmr-blue-dark)' }}>Pendencias por escola e turma</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--muted)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 6px' }}>Escola</th>
                  <th style={{ padding: '8px 6px' }}>Turma</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right' }}>Alunos</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right' }}>Com registro</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right' }}>Pendentes</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right' }}>% pendente</th>
                </tr>
              </thead>
              <tbody>
                {data.pendenciasResumo.map((item) => (
                  <tr key={`${item.escolaId}-${item.turmaId}`} style={{ borderTop: '1px solid #edf2f7' }}>
                    <td style={{ padding: '10px 6px', fontWeight: 700 }}>{item.escolaNome}</td>
                    <td style={{ padding: '10px 6px' }}>
                      <strong>{item.turmaNome}</strong>
                      {item.turno && <div style={{ color: 'var(--muted)', fontSize: 12 }}>{item.turno}</div>}
                    </td>
                    <td style={{ padding: '10px 6px', textAlign: 'right' }}>{number(item.avaliacoesEsperadas)}</td>
                    <td style={{ padding: '10px 6px', textAlign: 'right' }}>{number(item.submissoes)}</td>
                    <td style={{ padding: '10px 6px', textAlign: 'right', color: 'var(--pmr-red)', fontWeight: 800 }}>{number(item.pendentes)}</td>
                    <td style={{ padding: '10px 6px', textAlign: 'right' }}>{pct(item.percentualPendente)}</td>
                  </tr>
                ))}
                {data.pendenciasResumo.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '12px 6px', color: 'var(--muted)' }}>Nao ha pendencias no escopo selecionado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, alignItems: 'start', marginBottom: 16 }}>
            <div style={{ ...card, padding: 18, overflowX: 'auto' }}>
              <h2 style={{ fontSize: 18, margin: '0 0 10px', color: 'var(--pmr-blue-dark)' }}>Habilidades por eixo</h2>
              {data.eixos.map((eixo) => {
                const gruposPerguntas = agruparPerguntasPorColunas(eixo)
                return (
                  <div key={eixo.id} style={{ marginBottom: 20 }}>
                    <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>{eixo.nome}</h3>
                    {gruposPerguntas.map((grupoPerguntas, groupIndex) => (
                      <table key={grupoPerguntas.colunas.map((coluna) => coluna.key).join('|') || groupIndex} style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760, marginBottom: 12 }}>
                        <thead>
                          <tr style={{ color: 'var(--muted)', textAlign: 'left' }}>
                            <th style={{ padding: '8px 6px', width: '38%' }}>Pergunta</th>
                            <th style={{ padding: '8px 6px', textAlign: 'right' }}>Validas</th>
                            {grupoPerguntas.colunas.map((coluna) => (
                              <th key={coluna.key} style={{ padding: '8px 6px', textAlign: 'right' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ width: 10, height: 10, borderRadius: 3, background: coluna.color }} />
                                  {coluna.label}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {grupoPerguntas.perguntas.map((pergunta) => (
                            <tr key={pergunta.perguntaId} style={{ borderTop: '1px solid #edf2f7' }}>
                              <td style={{ padding: '10px 6px', fontWeight: 700, lineHeight: 1.35 }}>{pergunta.perguntaTexto}</td>
                              <td style={{ padding: '10px 6px', textAlign: 'right' }}>{number(pergunta.totalValidas || 0)}</td>
                              {grupoPerguntas.colunas.map((coluna) => {
                                const opcao = opcaoPorSiglas(pergunta, coluna.siglas)
                                return (
                                  <td key={coluna.key} style={{ padding: '10px 6px', textAlign: 'right' }}>
                                    <strong style={{ color: corOpcao(opcao, coluna.color) }}>{pct(opcao?.percentual || 0)}</strong>
                                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{number(opcao?.total || 0)} alunos</div>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ))}
                  </div>
                )
              })}
              {data.eixos.length === 0 && <p className="empty-state">Ainda nao ha respostas para os filtros selecionados.</p>}
            </div>

            {professorDelimitado && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 430px), 1fr))', gap: 16 }}>
                {data.eixos.map((eixo) => (
                  <article key={eixo.id} style={{ ...card, padding: 18 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 16, color: 'var(--pmr-blue-dark)' }}>{eixo.nome}</h3>
                    <div style={{ display: 'grid', gap: 14 }}>
                      {eixo.perguntas.map((pergunta) => (
                        <div key={pergunta.perguntaId} style={{ borderTop: '1px solid #edf2f7', paddingTop: 10 }}>
                          <div style={{ fontWeight: 700, lineHeight: 1.35, marginBottom: 8 }}>{pergunta.perguntaTexto}</div>
                          <div style={{ display: 'grid', gap: 7 }}>
                            {pergunta.opcoes.map((opcao) => (
                              <div key={opcao.id}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, marginBottom: 4 }}>
                                  <span>{opcao.descricao || opcao.sigla}</span>
                                  <strong>{number(opcao.total)} ({pct(opcao.percentual)})</strong>
                                </div>
                                <ProgressBar value={opcao.percentual} color={opcao.corHex || '#3498DB'} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div>
              <h2 style={{ fontSize: 18, margin: '0 0 10px', color: 'var(--pmr-blue-dark)' }}>Habilidades criticas</h2>
              <div style={{ ...card, display: 'grid', gap: 12, padding: 18 }}>
                {data.habilidadesCriticas.map((pergunta, index) => (
                  <div key={pergunta.perguntaId} style={{ borderBottom: index === data.habilidadesCriticas.length - 1 ? 'none' : '1px solid #edf2f7', paddingBottom: 12 }}>
                    <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 800 }}>{pergunta.grupoNome}</div>
                    <div style={{ fontWeight: 700, margin: '3px 0 8px', lineHeight: 1.35 }}>{pergunta.perguntaTexto}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 7 }}>
                      <span>{number(pergunta.dificuldade)} respostas indicam dificuldade</span>
                      <strong style={{ color: '#F39C12' }}>{pct(pergunta.percentualDificuldade)}</strong>
                    </div>
                    <ProgressBar value={pergunta.percentualDificuldade} color="#F39C12" />
                  </div>
                ))}
                {data.habilidadesCriticas.length === 0 && <p className="empty-state" style={{ margin: 0 }}>Sem habilidades criticas para exibir.</p>}
              </div>
            </div>
          </section>

        </>
      )}
    </div>
  )
}
