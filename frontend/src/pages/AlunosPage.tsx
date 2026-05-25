import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'

interface Aluno { id: string; nome: string; matricula?: string; dataNascimento?: string; sexo?: string }
interface Submissao { id: string; alunoId: string; status: string }

export default function AlunosPage() {
  const { turmaId } = useParams<{ turmaId: string }>()
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [submissoes, setSubmissoes] = useState<Submissao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    async function carregarAlunos() {
      setLoading(true)
      setError(null)

      try {
        const alunosRes = await api.get(`/turmas/${turmaId}/alunos`)
        if (!active) return
        setAlunos(Array.isArray(alunosRes.data) ? alunosRes.data : [])

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
    RASCUNHO: { label: 'Rascunho', color: '#fdcb6e' },
    ENVIADA:  { label: 'Finalizada',  color: '#00b894' },
    FINALIZADO:  { label: 'Finalizada',  color: '#00b894' },
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button onClick={() => navigate('/turmas')} style={{ background: '#dfe6e9', color: '#2d3436', padding: '8px 14px' }}>← Voltar</button>
        <h1 style={{ margin: 0, fontSize: 22 }}>Alunos da Turma</h1>
      </div>

      {loading && <p>Carregando...</p>}
      {!loading && error && <p style={{ color: '#d63031' }}>{error}</p>}
      {!loading && !error && alunos.length === 0 && <p style={{ color: '#636e72' }}>Nenhum aluno encontrado nesta turma.</p>}

      <div style={{ display: 'grid', gap: 8 }}>
        {alunos.map(aluno => {
          const status = getStatus(aluno.id)
          const st = status ? statusLabel[status] : null
          return (
            <div
              key={aluno.id}
              onClick={() => navigate(`/turmas/${turmaId}/alunos/${aluno.id}/formulario`)}
              style={{
                background: '#fff', borderRadius: 10, padding: '16px 20px', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{aluno.nome}</div>
                {aluno.matricula && <div style={{ color: '#b2bec3', fontSize: 12 }}>Mat. {aluno.matricula}</div>}
              </div>

              {st && (
                <span style={{
                  background: st.color,
                  color: '#fff',
                  borderRadius: 20,
                  padding: '3px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  {st.label}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}