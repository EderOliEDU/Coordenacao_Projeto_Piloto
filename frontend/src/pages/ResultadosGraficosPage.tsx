import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'

interface FaseFiltro { id: number; nome: string; dataInicio: string; dataFim: string; ativa: boolean; ordem: number }
interface Resumo {
  totalAlunos: number
  totalTurmas: number
  totalEscolas: number
  totalProfessores: number
  finalizados: number
  pendentes: number
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
}
interface PerguntaResultado {
  perguntaId: string
  perguntaTexto: string
  grupoNome: string
  tipoEscala: string
  totalValidas: number
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
interface ResultadosResponse {
  filtros: {
    visao: string
    status: string
    fases: FaseFiltro[]
    faseAtual: FaseFiltro | null
  }
  resumo: Resumo
  eixos: EixoResultado[]
}

const emptyData: ResultadosResponse = {
  filtros: { visao: 'GERAL', status: 'TODOS', fases: [], faseAtual: null },
  resumo: {
    totalAlunos: 0,
    totalTurmas: 0,
    totalEscolas: 0,
    totalProfessores: 0,
    finalizados: 0,
    pendentes: 0,
    percentualFinalizacao: 0,
  },
  eixos: [],
}

interface ColunaResposta {
  key: string
  siglas: string[]
  label: string
  shortLabel: string
  color: string
  ordem: number
}

const respostaColumns: ColunaResposta[] = [
  { key: 'SIM', siglas: ['SIM', 'S'], label: 'SIM', shortLabel: 'SIM', color: '#2ECC71', ordem: 1 },
  { key: 'NAO', siglas: ['NAO', 'NÃO', 'N'], label: 'NAO', shortLabel: 'NAO', color: '#F39C12', ordem: 2 },
  { key: 'SF', siglas: ['SF'], label: 'SF', shortLabel: 'SF', color: '#2ECC71', ordem: 10 },
  { key: 'SFP', siglas: ['SFP'], label: 'SFP', shortLabel: 'SFP', color: '#3498DB', ordem: 11 },
  { key: 'NSF', siglas: ['NSF'], label: 'NSF', shortLabel: 'NSF', color: '#F39C12', ordem: 12 },
  { key: 'PEA-D', siglas: ['PEA-D', 'D'], label: 'Domina', shortLabel: 'D', color: '#2ECC71', ordem: 20 },
  { key: 'PEA-PD', siglas: ['PEA-PD', 'PD'], label: 'Pouca dificuldade', shortLabel: 'PD', color: '#3498DB', ordem: 21 },
  { key: 'PEA-TD', siglas: ['PEA-TD', 'TD'], label: 'Tem dificuldade', shortLabel: 'TD', color: '#F1C40F', ordem: 22 },
  { key: 'PEA-NDA', siglas: ['PEA-NDA', 'NDA', 'ND'], label: 'Nao domina ainda', shortLabel: 'NDA', color: '#F39C12', ordem: 23 },
]

const card = {
  background: '#fff',
  border: '1px solid var(--line)',
  borderRadius: 8,
  boxShadow: '0 5px 18px rgba(15, 42, 74, 0.06)',
} as const

function pct(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(value, 100)) : 0
  return `${safe}%`
}

function number(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value || 0)
}

function formatCpf(cpf: string) {
  return (cpf || '').replace(/\D/g, '').padStart(11, '0').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
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

function filtroLabel(searchParams: URLSearchParams, data: ResultadosResponse) {
  const faseId = searchParams.get('faseId')
  const fase = data.filtros.fases.find((item) => String(item.id) === faseId) || data.filtros.faseAtual
  const labels = [
    fase ? `Fase: ${fase.nome}` : 'Fase atual',
    `Visao: ${searchParams.get('visao') || data.filtros.visao || 'GERAL'}`,
    `Status: ${searchParams.get('status') || data.filtros.status || 'TODOS'}`,
  ]
  if (searchParams.get('escolaId')) labels.push(`Escola ID: ${searchParams.get('escolaId')}`)
  if (searchParams.get('etapaId')) labels.push(`Etapa ID: ${searchParams.get('etapaId')}`)
  if (searchParams.get('turmaId')) labels.push(`Turma ID: ${searchParams.get('turmaId')}`)
  if (searchParams.get('professorCpf')) labels.push(`Professor: ${formatCpf(searchParams.get('professorCpf') || '')}`)
  return labels
}

function ChartQuestion({ pergunta }: { pergunta: PerguntaResultado }) {
  const colunas = colunasDaPergunta(pergunta)

  return (
    <div className="grafico-question-row">
      <div className="grafico-question-label">
        <strong>{pergunta.perguntaTexto}</strong>
        <span>{number(pergunta.totalValidas || 0)} respostas validas</span>
      </div>
      <div className="grafico-bars">
        {colunas.map((coluna) => {
          const opcao = opcaoPorSiglas(pergunta, coluna.siglas)
          const value = opcao?.percentual || 0
          const color = opcao?.corHex || coluna.color
          return (
            <div key={coluna.key} className="grafico-bar-line">
              <span className="grafico-bar-key">{coluna.shortLabel}</span>
              <div className="grafico-bar-track">
                <div className="grafico-bar-fill" style={{ width: pct(value), background: color }} />
              </div>
              <strong className="grafico-bar-value">{pct(value)}</strong>
              <span className="grafico-bar-count">{number(opcao?.total || 0)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ResultadosGraficosPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<ResultadosResponse>(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeEixoId, setActiveEixoId] = useState('')

  const queryString = searchParams.toString()

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get(`/resultados?${queryString}`)
      .then((res) => {
        const nextData = res.data || emptyData
        setData(nextData)
        setActiveEixoId((current) => current || nextData.eixos?.[0]?.id || '')
      })
      .catch((err) => setError(err.response?.data?.error || 'Erro ao carregar graficos.'))
      .finally(() => setLoading(false))
  }, [queryString])

  const activeEixo = useMemo(() => {
    return data.eixos.find((eixo) => eixo.id === activeEixoId) || data.eixos[0] || null
  }, [data.eixos, activeEixoId])

  const legendas = useMemo(() => {
    if (!activeEixo) return []
    const usadas = new Map<string, ColunaResposta>()
    for (const pergunta of activeEixo.perguntas) {
      for (const coluna of colunasDaPergunta(pergunta)) {
        if (!usadas.has(coluna.key)) usadas.set(coluna.key, coluna)
      }
    }
    return Array.from(usadas.values()).sort((a, b) => a.ordem - b.ordem)
  }, [activeEixo])

  function voltarResultados() {
    navigate(`/resultados?${queryString}`)
  }

  function imprimirAba() {
    window.print()
  }

  return (
    <div className="page resultados-graficos-page" style={{ maxWidth: 1320 }}>
      <div className="page-header no-print">
        <div className="page-title">
          <h1>Graficos dos resultados</h1>
          <p>Visualizacao por grupo com os mesmos filtros do painel de resultados.</p>
        </div>
        <div className="actions">
          <button onClick={imprimirAba} className="primary-btn" disabled={!activeEixo}>Gerar PDF desta aba</button>
          <button onClick={voltarResultados} className="secondary-btn">Voltar aos resultados</button>
        </div>
      </div>

      {loading && <p className="loading-text">Carregando graficos...</p>}
      {!loading && error && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <>
          <section className="no-print" style={{ ...card, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              <div>
                <strong>{number(data.resumo.totalAlunos)}</strong>
                <span> alunos</span>
              </div>
              <div>
                <strong>{number(data.resumo.finalizados)}</strong>
                <span> finalizados</span>
              </div>
              <div>
                <strong>{pct(data.resumo.percentualFinalizacao)}</strong>
                <span> concluido</span>
              </div>
              <div>
                <strong>{number(data.resumo.totalTurmas)}</strong>
                <span> turmas</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, color: 'var(--muted)', fontSize: 13 }}>
              {filtroLabel(searchParams, data).map((item) => <span key={item}>{item}</span>)}
            </div>
          </section>

          <nav className="grafico-tabs no-print" aria-label="Grupos de resultados">
            {data.eixos.map((eixo) => (
              <button
                key={eixo.id}
                type="button"
                onClick={() => setActiveEixoId(eixo.id)}
                className={activeEixo?.id === eixo.id ? 'grafico-tab active' : 'grafico-tab'}
              >
                {eixo.nome}
              </button>
            ))}
          </nav>

          {activeEixo ? (
            <section className="grafico-print-area" style={{ ...card, padding: 20 }}>
              <header className="grafico-print-header">
                <div>
                  <h2>{activeEixo.nome}</h2>
                  <p>{filtroLabel(searchParams, data).join(' | ')}</p>
                </div>
                <div>
                  <strong>{number(data.resumo.totalAlunos)}</strong>
                  <span> alunos no recorte</span>
                </div>
              </header>

              <div className="grafico-legend">
                {legendas.map((coluna) => (
                  <span key={coluna.key}>
                    <i style={{ background: coluna.color }} />
                    {coluna.shortLabel} - {coluna.label}
                  </span>
                ))}
              </div>

              <div className="grafico-chart">
                {activeEixo.perguntas.map((pergunta) => (
                  <ChartQuestion key={pergunta.perguntaId} pergunta={pergunta} />
                ))}
              </div>
            </section>
          ) : (
            <p className="empty-state">Nao ha perguntas para os filtros selecionados.</p>
          )}
        </>
      )}
    </div>
  )
}
