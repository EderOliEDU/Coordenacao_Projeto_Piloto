import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

interface Escola { id: string; nome: string; municipio?: string; uf?: string }
interface Turma {
  id: string; nome: string; codigo?: string; anoLetivo: number; turno: string
  escola: Escola; _count: { alunos: number }
}

export default function TurmasPage() {
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const professor = JSON.parse(localStorage.getItem('professor') || '{}')

  useEffect(() => {
    api.get('/turmas').then(r => setTurmas(r.data)).finally(() => setLoading(false))
  }, [])

  function logout() {
    localStorage.clear()
    navigate('/login')
  }

  const turnos: Record<string, string> = { MANHA: 'Manhã', TARDE: 'Tarde', NOITE: 'Noite', INTEGRAL: 'Integral' }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#0984e3' }}>Minhas Turmas</h1>
          <p style={{ margin: '4px 0 0', color: '#636e72', fontSize: 14 }}>Olá, {professor.nome}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/pendencias')} style={{ background: '#74b9ff', color: '#fff' }}>Pendências</button>
          <button onClick={logout} style={{ background: '#dfe6e9', color: '#2d3436' }}>Sair</button>
        </div>
      </div>

      {loading && <p>Carregando...</p>}
      {!loading && turmas.length === 0 && <p style={{ color: '#636e72' }}>Nenhuma turma atribuída.</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {turmas.map(turma => (
          <div
            key={turma.id}
            onClick={() => navigate(`/turmas/${turma.id}/alunos`)}
            style={{
              background: '#fff', borderRadius: 10, padding: '20px 24px', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              transition: 'box-shadow 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(9,132,227,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)')}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{turma.nome}</div>
              <div style={{ color: '#636e72', fontSize: 13, marginTop: 2 }}>
                {turma.escola.nome} · {turnos[turma.turno] || turma.turno} · {turma.anoLetivo}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 22, color: '#0984e3' }}>{turma._count.alunos}</div>
              <div style={{ color: '#b2bec3', fontSize: 12 }}>alunos</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
