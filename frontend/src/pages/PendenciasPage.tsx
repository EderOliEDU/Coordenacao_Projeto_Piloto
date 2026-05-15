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
  status: 'RASCUNHO' | 'FINALIZADO'
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
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate('/turmas')} style={{ background: '#dfe6e9', color: '#2d3436', padding: '8px 14px' }}>← Voltar</button>
        <h1 style={{ margin: 0, fontSize: 22 }}>Pendências do Questionário</h1>
      </div>

      <div style={{ marginBottom: 20 }}>
        <select
          value={turmaId}
          onChange={(e) => setTurmaId(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #dfe6e9', minWidth: 260 }}
        >
          <option value="">Todas as turmas</option>
          {turmas.map((turma) => (
            <option key={turma.id} value={turma.id}>{turma.nome}</option>
          ))}
        </select>
      </div>

      {loading && <p>Carregando pendências...</p>}

      {!loading && (
        <>
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>Alunos sem finalização ({semFinalizacao.length})</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {semFinalizacao.map((item) => (
                <div key={`${item.turmaId}-${item.alunoId}`} style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.alunoNome}</div>
                    <div style={{ color: '#636e72', fontSize: 13 }}>{item.turmaNome} · {item.totalRespondidas}/{item.totalPerguntas} respostas</div>
                  </div>
                  <button onClick={() => navigate(`/turmas/${item.turmaId}/alunos/${item.alunoId}/formulario`)} style={{ background: '#0984e3', color: '#fff' }}>
                    Abrir questionário
                  </button>
                </div>
              ))}
              {semFinalizacao.length === 0 && <p style={{ color: '#636e72' }}>Sem pendências de finalização.</p>}
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>Rascunhos ({rascunhos.length})</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {rascunhos.map((item) => (
                <div key={item.submissaoId} style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.alunoNome}</div>
                    <div style={{ color: '#636e72', fontSize: 13 }}>
                      {item.turmaNome} · {item.totalRespondidas}/{item.totalPerguntas} respostas · atualizado em {new Date(item.atualizadaEm).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <button onClick={() => navigate(`/turmas/${item.turmaId}/alunos/${item.alunoId}/formulario`)} style={{ background: '#fdcb6e', color: '#2d3436' }}>
                    Retomar
                  </button>
                </div>
              ))}
              {rascunhos.length === 0 && <p style={{ color: '#636e72' }}>Nenhum rascunho encontrado.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
