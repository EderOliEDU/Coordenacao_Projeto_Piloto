import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

interface EscolaFiltro { id: string; nome: string }
interface TurmaFiltro { id: string; nome: string; escolaId: string; escolaNome: string; turno?: string }
interface Resumo {
  totalAlunos: number
  totalTurmas: number
  totalEscolas: number
  finalizados: number
  rascunhos: number
  submissoes: number
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
}
interface PerguntaResultado {
  perguntaId: string
  perguntaTexto: string
  grupoNome: string
  total: number
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
interface ResultadosResponse {
  filtros: { escolas: EscolaFiltro[]; turmas: TurmaFiltro[]; status: string }
  resumo: Resumo
  eixos: EixoResultado[]
  habilidadesCriticas: PerguntaResultado[]
}

const emptyData: ResultadosResponse = {
  filtros: { escolas: [], turmas: [], status: 'FINALIZADO' },
  resumo: {
    totalAlunos: 0,
    totalTurmas: 0,
    totalEscolas: 0,
    finalizados: 0,
    rascunhos: 0,
    submissoes: 0,
    respostas: 0,
    percentualFinalizacao: 0,
  },
  eixos: [],
  habilidadesCriticas: [],
}

function pct(value: number) {
  return `${Number.isFinite(value) ? value : 0}%`
}

function cardStyle() {
  return {
    background: '#fff',
    border: '1px solid #e8edf1',
    borderRadius: 8,
    padding: 16,
    boxShadow: '0 2px 8px rgba(45,52,54,0.05)',
  }
}

export default function ResultadosPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<ResultadosResponse>(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [escolaId, setEscolaId] = useState('')
  const [turmaId, setTurmaId] = useState('')
  const [status, setStatus] = useState('FINALIZADO')

  useEffect(() => {
    const params = new URLSearchParams()
    if (escolaId) params.set('escolaId', escolaId)
    if (turmaId) params.set('turmaId', turmaId)
    if (status) params.set('status', status)

    setLoading(true)
    setError(null)
    api.get(`/resultados?${params.toString()}`)
      .then((res) => setData(res.data || emptyData))
      .catch((err) => setError(err.response?.data?.error || 'Erro ao carregar resultados.'))
      .finally(() => setLoading(false))
  }, [escolaId, turmaId, status])

  const turmasFiltradas = useMemo(() => {
    if (!escolaId) return data.filtros.turmas
    return data.filtros.turmas.filter((turma) => turma.escolaId === escolaId)
  }, [data.filtros.turmas, escolaId])

  function onEscolaChange(value: string) {
    setEscolaId(value)
    setTurmaId('')
  }

  const resumoCards = [
    { label: 'Alunos', value: data.resumo.totalAlunos },
    { label: 'Finalizados', value: data.resumo.finalizados },
    { label: 'Pendentes', value: Math.max(data.resumo.totalAlunos - data.resumo.finalizados, 0) },
    { label: 'Finalizacao', value: pct(data.resumo.percentualFinalizacao) },
  ]

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 16px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#0984e3' }}>Resultados</h1>
          <p style={{ margin: '4px 0 0', color: '#636e72', fontSize: 14 }}>Indicadores do Projeto Instrução Fônica</p>
        </div>
        <button onClick={() => navigate('/turmas')} style={{ background: '#dfe6e9', color: '#2d3436' }}>Voltar</button>
      </div>

      <div style={{ ...cardStyle(), marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, color: '#636e72', fontWeight: 700 }}>
            Escola
            <select value={escolaId} onChange={(e) => onEscolaChange(e.target.value)} style={{ padding: '9px 10px', borderRadius: 6, border: '1px solid #dfe6e9' }}>
              <option value="">Todas</option>
              {data.filtros.escolas.map((escola) => <option key={escola.id} value={escola.id}>{escola.nome}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, color: '#636e72', fontWeight: 700 }}>
            Turma
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} style={{ padding: '9px 10px', borderRadius: 6, border: '1px solid #dfe6e9' }}>
              <option value="">Todas</option>
              {turmasFiltradas.map((turma) => <option key={turma.id} value={turma.id}>{turma.escolaNome} - {turma.nome}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, color: '#636e72', fontWeight: 700 }}>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: '9px 10px', borderRadius: 6, border: '1px solid #dfe6e9' }}>
              <option value="FINALIZADO">Finalizados</option>
              <option value="RASCUNHO">Rascunhos</option>
              <option value="TODOS">Todos com resposta</option>
            </select>
          </label>
        </div>
      </div>

      {loading && <p>Carregando resultados...</p>}
      {!loading && error && <p style={{ color: '#d63031' }}>{error}</p>}

      {!loading && !error && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
            {resumoCards.map((item) => (
              <div key={item.label} style={cardStyle()}>
                <div style={{ color: '#636e72', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{item.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#2d3436', marginTop: 6 }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 16, alignItems: 'start' }}>
            <section>
              <h2 style={{ fontSize: 18, margin: '0 0 10px' }}>Resultados por eixo</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                {data.eixos.map((eixo) => (
                  <div key={eixo.id} style={cardStyle()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16 }}>{eixo.nome}</h3>
                        <div style={{ color: '#636e72', fontSize: 13 }}>{eixo.total} respostas registradas</div>
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 800, color: '#00a383' }}>{pct(eixo.percentualDominio)}</div>
                    </div>
                    <div style={{ height: 10, background: '#edf2f4', borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
                      <div style={{ height: '100%', width: pct(eixo.percentualDominio), background: '#00b894' }} />
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {eixo.perguntas.slice(0, 5).map((pergunta) => (
                        <div key={pergunta.perguntaId} style={{ borderTop: '1px solid #f0f2f4', paddingTop: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                            <span>{pergunta.perguntaTexto}</span>
                            <strong>{pct(pergunta.percentualDominio)}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {data.eixos.length === 0 && <p style={{ color: '#636e72' }}>Ainda não há respostas para os filtros selecionados.</p>}
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 18, margin: '0 0 10px' }}>Habilidades críticas</h2>
              <div style={{ ...cardStyle(), display: 'grid', gap: 12 }}>
                {data.habilidadesCriticas.map((pergunta, index) => (
                  <div key={pergunta.perguntaId} style={{ borderBottom: index === data.habilidadesCriticas.length - 1 ? 'none' : '1px solid #f0f2f4', paddingBottom: 12 }}>
                    <div style={{ color: '#636e72', fontSize: 12, fontWeight: 700 }}>{pergunta.grupoNome}</div>
                    <div style={{ fontWeight: 700, margin: '3px 0 8px', lineHeight: 1.35 }}>{pergunta.perguntaTexto}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 7 }}>
                      <span>{pergunta.dificuldade} com dificuldade</span>
                      <strong style={{ color: '#d63031' }}>{pct(pergunta.percentualDificuldade)}</strong>
                    </div>
                    <div style={{ display: 'grid', gap: 5 }}>
                      {pergunta.opcoes.map((opcao) => {
                        const percentual = pergunta.total ? Math.round((opcao.total / pergunta.total) * 100) : 0
                        return (
                          <div key={opcao.id} title={opcao.descricao} style={{ display: 'grid', gridTemplateColumns: '58px 1fr 42px', gap: 8, alignItems: 'center', fontSize: 12 }}>
                            <strong>{opcao.simbolo || opcao.sigla}</strong>
                            <div style={{ height: 7, background: '#edf2f4', borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: pct(percentual), background: opcao.corHex || '#74b9ff' }} />
                            </div>
                            <span style={{ textAlign: 'right' }}>{opcao.total}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {data.habilidadesCriticas.length === 0 && <p style={{ color: '#636e72', margin: 0 }}>Sem habilidades críticas para exibir.</p>}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
