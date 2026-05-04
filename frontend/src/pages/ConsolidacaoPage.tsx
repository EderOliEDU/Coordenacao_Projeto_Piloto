import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

interface Escola { id: string; nome: string; municipio?: string }
interface Turma { id: string; nome: string; codigo?: string; anoLetivo: number; turno: string; escola: Escola }
interface Aluno { id: string; nome: string; matricula?: string }
interface Formulario { id: string; nome: string; versao: string }
interface Professor { nome: string; login: string; papel: string }

interface Submissao {
  id: string
  status: string
  criadaEm: string
  enviadaEm: string | null
  observacoes: string | null
  totalRespostas: number
  aluno: Aluno
  turma: { id: string; nome: string; codigo?: string; anoLetivo: number; turno: string }
  escola: Escola
  formulario: Formulario
  professores: Professor[]
}

interface ConsolidacaoData {
  total: number
  porStatus: Record<string, number>
  percentuais: Record<string, string>
  submissoes: Submissao[]
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  RASCUNHO: { label: 'Rascunho', color: '#856404', bg: '#fff3cd' },
  ENVIADA:  { label: 'Enviada',  color: '#155724', bg: '#d4edda' },
  VALIDADA: { label: 'Validada', color: '#0c5460', bg: '#d1ecf1' },
  CANCELADA:{ label: 'Cancelada',color: '#721c24', bg: '#f8d7da' },
}

const TURNOS: Record<string, string> = {
  MANHA: 'Manhã', TARDE: 'Tarde', NOITE: 'Noite', INTEGRAL: 'Integral',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ConsolidacaoPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<ConsolidacaoData | null>(null)
  const [escolas, setEscolas] = useState<Escola[]>([])
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Filters
  const [filtroEscola, setFiltroEscola] = useState('')
  const [filtroTurma, setFiltroTurma] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
  })()

  function logout() {
    localStorage.clear()
    navigate('/login')
  }

  // Load escolas on mount
  useEffect(() => {
    api.get('/admin/consolidacao/escolas')
      .then(r => setEscolas(r.data))
      .catch(() => {})
  }, [])

  // Load turmas when escola changes
  useEffect(() => {
    const url = filtroEscola
      ? `/admin/consolidacao/turmas?escolaId=${filtroEscola}`
      : '/admin/consolidacao/turmas'
    api.get(url)
      .then(r => setTurmas(r.data))
      .catch(() => {})
    // Reset turma filter when escola changes
    setFiltroTurma('')
  }, [filtroEscola])

  const buscar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filtroEscola) params.set('escolaId', filtroEscola)
      if (filtroTurma) params.set('turmaId', filtroTurma)
      if (filtroStatus) params.set('status', filtroStatus)
      if (filtroDataInicio) params.set('dataInicio', filtroDataInicio)
      if (filtroDataFim) params.set('dataFim', filtroDataFim)

      const url = `/admin/consolidacao${params.toString() ? '?' + params.toString() : ''}`
      const res = await api.get(url)
      setData(res.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }, [filtroEscola, filtroTurma, filtroStatus, filtroDataInicio, filtroDataFim])

  // Load data on mount
  useEffect(() => {
    buscar()
  }, [buscar])

  function exportarCSV() {
    const params = new URLSearchParams()
    if (filtroEscola) params.set('escolaId', filtroEscola)
    if (filtroTurma) params.set('turmaId', filtroTurma)
    if (filtroStatus) params.set('status', filtroStatus)
    if (filtroDataInicio) params.set('dataInicio', filtroDataInicio)
    if (filtroDataFim) params.set('dataFim', filtroDataFim)

    const token = localStorage.getItem('token')
    const url = `/api/admin/consolidacao/csv${params.toString() ? '?' + params.toString() : ''}`
    // Baixar CSV via link com header de Authorization
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'consolidacao.csv'
        a.click()
      })
      .catch(() => alert('Erro ao exportar CSV'))
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e0e0e0', padding: '0 24px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#6c5ce7' }}>Piloto EI</span>
            <span style={{ color: '#dfe6e9' }}>|</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#2d3436' }}>Consolidação de Respostas</span>
            <span style={{
              background: '#f3f0ff', color: '#6c5ce7', fontSize: 11, fontWeight: 700,
              padding: '2px 8px', borderRadius: 10, letterSpacing: 0.5,
            }}>ADMIN</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#636e72' }}>{user.nome}</span>
            <button
              onClick={logout}
              style={{ background: '#dfe6e9', color: '#2d3436', padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13 }}
            >
              Sair
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
        {/* Filtros */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#636e72', textTransform: 'uppercase', letterSpacing: 0.5 }}>Filtros</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Escola</label>
              <select value={filtroEscola} onChange={e => setFiltroEscola(e.target.value)} style={selectStyle}>
                <option value="">Todas</option>
                {escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Turma</label>
              <select value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)} style={selectStyle}>
                <option value="">Todas</option>
                {turmas.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nome} {t.anoLetivo} {TURNOS[t.turno] || t.turno}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={selectStyle}>
                <option value="">Todos</option>
                <option value="RASCUNHO">Rascunho</option>
                <option value="ENVIADA">Enviada</option>
                <option value="VALIDADA">Validada</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Data início</label>
              <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Data fim</label>
              <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              onClick={buscar}
              disabled={loading}
              style={{ background: '#0984e3', color: '#fff', padding: '9px 24px', borderRadius: 6, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14 }}
            >
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
            <button
              onClick={exportarCSV}
              style={{ background: '#00b894', color: '#fff', padding: '9px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14 }}
            >
              ↓ Exportar CSV
            </button>
            <a
              href="https://github.com/EderOliEDU/Coordenacao_Projeto_Piloto/blob/main/PROJETO%20PLANO%20PILOTO%20PILOTO%20DA%20EDUCA%C3%87%C3%83O%20INFANTIL%20ok.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginLeft: 'auto', fontSize: 13, color: '#0984e3', alignSelf: 'center', textDecoration: 'none' }}
            >
              📄 PDF do Projeto
            </a>
          </div>
        </div>

        {error && (
          <div style={{ background: '#f8d7da', color: '#721c24', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Totais */}
        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={cardStyle}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#2d3436' }}>{data.total}</div>
              <div style={{ fontSize: 12, color: '#636e72', marginTop: 2 }}>Total de submissões</div>
            </div>
            {Object.entries(data.porStatus).map(([status, count]) => {
              const st = STATUS_LABELS[status] || { label: status, color: '#2d3436', bg: '#f0f0f0' }
              return (
                <div key={status} style={{ ...cardStyle, borderTop: `3px solid ${st.color}` }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: st.color }}>{count}</div>
                  <div style={{ fontSize: 12, color: '#636e72', marginTop: 2 }}>
                    {st.label} ({data.percentuais[status]})
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Tabela */}
        {data && (
          <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, color: '#2d3436' }}>
                Submissões ({data.submissoes.length})
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {data.submissoes.length === 0 ? (
                <div style={{ padding: '32px 24px', color: '#636e72', textAlign: 'center' }}>
                  Nenhuma submissão encontrada com os filtros aplicados.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th style={thStyle}>Escola</th>
                      <th style={thStyle}>Turma</th>
                      <th style={thStyle}>Aluno</th>
                      <th style={thStyle}>Matrícula</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Respostas</th>
                      <th style={thStyle}>Criada em</th>
                      <th style={thStyle}>Enviada em</th>
                      <th style={thStyle}>Professor(es)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.submissoes.map((s, i) => {
                      const st = STATUS_LABELS[s.status] || { label: s.status, color: '#2d3436', bg: '#f0f0f0' }
                      return (
                        <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc', borderBottom: '1px solid #f0f0f0' }}>
                          <td style={tdStyle}>{s.escola.nome}</td>
                          <td style={tdStyle}>{s.turma.nome}{s.turma.codigo ? ` (${s.turma.codigo})` : ''}</td>
                          <td style={tdStyle}><strong>{s.aluno.nome}</strong></td>
                          <td style={tdStyle}>{s.aluno.matricula || '—'}</td>
                          <td style={tdStyle}>
                            <span style={{
                              background: st.bg, color: st.color,
                              padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                            }}>{st.label}</span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{s.totalRespostas}</td>
                          <td style={tdStyle}>{formatDate(s.criadaEm)}</td>
                          <td style={tdStyle}>{formatDate(s.enviadaEm)}</td>
                          <td style={tdStyle}>
                            {s.professores.length > 0
                              ? s.professores.map(p => p.nome).join(', ')
                              : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {loading && !data && (
          <div style={{ textAlign: 'center', padding: 48, color: '#636e72' }}>Carregando...</div>
        )}
      </div>
    </div>
  )
}

// Styles
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#636e72', marginBottom: 4,
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #dfe6e9', borderRadius: 6, fontSize: 13,
  background: '#fff', cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #dfe6e9', borderRadius: 6, fontSize: 13,
  boxSizing: 'border-box',
}

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 10, padding: '16px 20px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '3px solid #e0e0e0',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#636e72',
  fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 16px', color: '#2d3436', verticalAlign: 'middle',
}
