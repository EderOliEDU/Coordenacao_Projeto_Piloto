import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

interface Turma { id: string; nome: string }
interface Pendencia {
  alunoId: string
  alunoNome: string
  turmaId: string
  turmaNome: string
  submissaoId: string | null
  totalRespondidas: number
  totalPerguntas: number
}
interface Rascunho {
  submissaoId: string
  alunoId: string
  alunoNome: string
  turmaId: string
  turmaNome: string
  totalRespondidas: number
  totalPerguntas: number
  atualizadaEm: string
}

export default function PendenciasPage() {
  const navigate = useNavigate()
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [turmaId, setTurmaId] = useState('')
  const [loading, setLoading] = useState(true)
  const [semFinalizacao, setSemFinalizacao] = useState<Pendencia[]>([])
  const [rascunhos, setRascunhos] = useState<Rascunho[]>([])

  function formatarData(valor: string) {
    const data = new Date(valor)
    return isNaN(data.getTime()) ? 'Data indisponível' : data.toLocaleString('pt-BR')
  }

  useEffect(() => {
    api.get('/turmas').then((res) => setTurmas(res.data))
  }, [])

  useEffect(() => {
    setLoading(true)
    const query = turmaId ? `?turmaId=${turmaId}` : ''
    api.get(`/submissoes/pendencias${query}`)
      .then((res) => {
        setSemFinalizacao(res.data.semFinalizacao || [])
        setRascunhos(res.data.rascunhos || [])
      })
      .finally(() => setLoading(false))
  }, [turmaId])

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="topbar-inner">
          <div className="topbar-brand">
            <img className="mini-mark" src="/semecel_logo_horizontal_editavel.svg" alt="Prefeitura de Rondonópolis e SEMECEL" />
            <div>
              <strong>Projeto Instrução Fônica</strong>
              <span>Prefeitura Municipal de Rondonópolis</span>
            </div>
          </div>
          <button onClick={() => navigate('/turmas')} className="secondary-btn">Voltar</button>
        </div>
      </header>

      <main className="page">
        <div className="page-header">
          <div className="page-title">
            <h1>Pendências do questionário</h1>
            <p>Acompanhe formulários em rascunho e estudantes sem finalização.</p>
          </div>
          <div style={{ minWidth: 260 }}>
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              <option value="">Todas as turmas</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>{turma.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && <p className="loading-text">Carregando pendências...</p>}

        {!loading && (
          <>
            <section className="section-card">
              <h2>Alunos sem finalização ({semFinalizacao.length})</h2>
              <div className="card-list">
                {semFinalizacao.map((item) => (
                  <div key={`${item.turmaId}-${item.alunoId}`} className="data-card split-card">
                    <div>
                      <div className="card-title">{item.alunoNome}</div>
                      <div className="card-meta">{item.turmaNome} · {item.totalRespondidas}/{item.totalPerguntas} respostas</div>
                    </div>
                    <button onClick={() => navigate(`/turmas/${item.turmaId}/alunos/${item.alunoId}/formulario`)} className="primary-btn">
                      Abrir questionário
                    </button>
                  </div>
                ))}
                {semFinalizacao.length === 0 && <p className="empty-state">Sem pendências de finalização.</p>}
              </div>
            </section>

            <section className="section-card">
              <h2>Rascunhos ({rascunhos.length})</h2>
              <div className="card-list">
                {rascunhos.map((item) => (
                  <div key={item.submissaoId} className="data-card split-card">
                    <div>
                      <div className="card-title">{item.alunoNome}</div>
                      <div className="card-meta">
                        {item.turmaNome} · {item.totalRespondidas}/{item.totalPerguntas} respostas · atualizado em {formatarData(item.atualizadaEm)}
                      </div>
                    </div>
                    <button onClick={() => navigate(`/turmas/${item.turmaId}/alunos/${item.alunoId}/formulario`)} className="warning-btn">
                      Retomar
                    </button>
                  </div>
                ))}
                {rascunhos.length === 0 && <p className="empty-state">Nenhum rascunho encontrado.</p>}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
