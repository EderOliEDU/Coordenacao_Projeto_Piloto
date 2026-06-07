import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'

interface Aluno { id: string; nome: string; matricula?: string; dataNascimento?: string; sexo?: string }
interface Submissao { id: string; alunoId: string; status: string }
interface Turma { id: string; nome: string; turno: string; escola: { id: string; nome: string } }

export default function AlunosPage() {
  const { turmaId } = useParams<{ turmaId: string }>()
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [submissoes, setSubmissoes] = useState<Submissao[]>([])
  const [turma, setTurma] = useState<Turma | null>(null)
  const [professorNome, setProfessorNome] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    async function carregarAlunos() {
      setLoading(true)
      setError(null)

      try {
        const [alunosRes, turmasRes, meRes] = await Promise.all([
          api.get(`/turmas/${turmaId}/alunos`),
          api.get('/turmas'),
          api.get('/auth/me').catch(() => ({ data: null })),
        ])
        if (!active) return
        setAlunos(Array.isArray(alunosRes.data) ? alunosRes.data : [])
        setTurma((Array.isArray(turmasRes.data) ? turmasRes.data : []).find((item: Turma) => item.id === turmaId) || null)
        setProfessorNome(meRes.data?.professor?.nome || JSON.parse(localStorage.getItem('professor') || '{}').nome || '')

        try {
          const subRes = await api.get(`/submissoes?turmaId=${turmaId}`)
          if (active) setSubmissoes(Array.isArray(subRes.data) ? subRes.data : [])
        } catch {
          if (active) setSubmissoes([])
        }
      } catch (err: any) {
        if (active) {
          setAlunos([])
          setSubmissoes([])
          setError(err.response?.data?.error || 'Erro ao carregar alunos da turma.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    carregarAlunos()
    return () => {
      active = false
    }
  }, [turmaId])

  function getStatus(alunoId: string) {
    const sub = submissoes.find(s => s.alunoId === alunoId)
    if (!sub) return null
    return sub.status
  }

  const statusLabel: Record<string, { label: string; color: string }> = {
    RASCUNHO: { label: 'Rascunho', color: '#f2c230' },
    ENVIADA: { label: 'Finalizada', color: '#1f9d55' },
    FINALIZADO: { label: 'Finalizada', color: '#1f9d55' },
  }

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
            <h1>Alunos da turma</h1>
            {(professorNome || turma) && (
              <p>
                {professorNome && <>Professor: <strong>{professorNome}</strong></>}
                {turma && <> · {turma.nome} · {turma.escola.nome}</>}
              </p>
            )}
            <p>Selecione um estudante para preencher ou revisar o formulário de observação.</p>
          </div>
        </div>

        {loading && <p className="loading-text">Carregando...</p>}
        {!loading && error && <p className="error-text">{error}</p>}
        {!loading && !error && alunos.length === 0 && <p className="empty-state">Nenhum aluno encontrado nesta turma.</p>}

        <div className="card-list">
          {alunos.map(aluno => {
            const status = getStatus(aluno.id)
            const st = status ? statusLabel[status] : null
            return (
              <div
                key={aluno.id}
                onClick={() => navigate(`/turmas/${turmaId}/alunos/${aluno.id}/formulario`)}
                className="data-card clickable-card split-card"
              >
                <div>
                  <div className="card-title">{aluno.nome}</div>
                  {aluno.matricula && <div className="card-meta">Mat. {aluno.matricula}</div>}
                </div>

                {st && <span className="badge" style={{ background: st.color }}>{st.label}</span>}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
