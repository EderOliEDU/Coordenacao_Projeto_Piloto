import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

interface Escola { id: string; nome: string; municipio?: string; uf?: string }
interface Turma {
  id: string; nome: string; codigo?: string; anoLetivo: number; turno: string
  escola: Escola; _count: { alunos: number }
}
interface ProfessorBusca {
  cpf: string
  nome: string
  nomeSocial?: string | null
  email?: string | null
  corporativoEmail?: string | null
}

function formatarCpf(cpf: string) {
  return (cpf || '').replace(/\D/g, '').padStart(11, '0').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function getViewAsProfessor(): ProfessorBusca | null {
  try {
    return JSON.parse(localStorage.getItem('viewAsProfessor') || 'null')
  } catch {
    localStorage.removeItem('viewAsProfessor')
    return null
  }
}

export default function TurmasPage() {
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const professor = JSON.parse(localStorage.getItem('professor') || '{}')
  const [canViewResultados, setCanViewResultados] = useState(Boolean(professor.permissoes?.resultados))
  const [canViewSuperadmin, setCanViewSuperadmin] = useState(Boolean(professor.permissoes?.superadmin))
  const [canAdministrar, setCanAdministrar] = useState(Boolean(professor.permissoes?.administrador || professor.permissoes?.resultados || professor.permissoes?.superadmin))
  const [viewAs, setViewAs] = useState<ProfessorBusca | null>(() => getViewAsProfessor())
  const [buscaProfessor, setBuscaProfessor] = useState('')
  const [professoresBusca, setProfessoresBusca] = useState<ProfessorBusca[]>([])
  const [buscandoProfessor, setBuscandoProfessor] = useState(false)
  const [erroBuscaProfessor, setErroBuscaProfessor] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get('/turmas').then(r => setTurmas(r.data)).finally(() => setLoading(false))
    api.get('/auth/me').then((res) => {
      const refreshedProfessor = res.data?.professor
      if (refreshedProfessor) {
        localStorage.setItem('professor', JSON.stringify(refreshedProfessor))
        setCanViewResultados(Boolean(refreshedProfessor.permissoes?.resultados))
        setCanViewSuperadmin(Boolean(refreshedProfessor.permissoes?.superadmin))
        setCanAdministrar(Boolean(refreshedProfessor.permissoes?.administrador || refreshedProfessor.permissoes?.resultados || refreshedProfessor.permissoes?.superadmin))
      }
    }).catch(() => {
      setCanViewResultados(Boolean(professor.permissoes?.resultados))
      setCanViewSuperadmin(Boolean(professor.permissoes?.superadmin))
      setCanAdministrar(Boolean(professor.permissoes?.administrador || professor.permissoes?.resultados || professor.permissoes?.superadmin))
    })
  }, [viewAs])

  useEffect(() => {
    const termo = buscaProfessor.trim()
    if (!canAdministrar || termo.length < 2) {
      setProfessoresBusca([])
      return
    }

    const timer = window.setTimeout(() => {
      setBuscandoProfessor(true)
      setErroBuscaProfessor('')
      api.get('/superadmin/professores', { params: { q: termo } })
        .then((res) => setProfessoresBusca(res.data || []))
        .catch((err) => setErroBuscaProfessor(err.response?.data?.error || 'Não foi possível buscar professores'))
        .finally(() => setBuscandoProfessor(false))
    }, 300)

    return () => window.clearTimeout(timer)
  }, [buscaProfessor, canAdministrar])

  function logout() {
    localStorage.clear()
    navigate('/login')
  }

  function iniciarVisualizacao(item: ProfessorBusca) {
    const professorVisualizado = {
      cpf: item.cpf,
      nome: item.nomeSocial || item.nome || formatarCpf(item.cpf),
    }
    localStorage.setItem('viewAsProfessor', JSON.stringify(professorVisualizado))
    setViewAs(professorVisualizado)
    setBuscaProfessor('')
    setProfessoresBusca([])
  }

  function sairVisualizacao() {
    localStorage.removeItem('viewAsProfessor')
    setViewAs(null)
  }

  const turnos: Record<string, string> = { MANHA: 'Manhã', TARDE: 'Tarde', NOITE: 'Noite', INTEGRAL: 'Integral' }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#0984e3' }}>Minhas Turmas</h1>
          <p style={{ margin: '4px 0 0', color: '#636e72', fontSize: 14 }}>
            Olá, {professor.nome}
            {viewAs && <> · visualizando {viewAs.nome} ({formatarCpf(viewAs.cpf)})</>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={() => navigate('/pendencias')} style={{ background: '#74b9ff', color: '#fff' }}>Pendências</button>
          {canViewResultados && <button onClick={() => navigate('/resultados')} style={{ background: '#00b894', color: '#fff' }}>Resultados</button>}
          {canViewSuperadmin && <button onClick={() => navigate('/superadmin')} style={{ background: '#6c5ce7', color: '#fff' }}>Superadmin</button>}
          <button onClick={logout} style={{ background: '#dfe6e9', color: '#2d3436' }}>Sair</button>
        </div>
      </div>

      {viewAs && (
        <div style={{ background: '#fff7d6', border: '1px solid #f2c230', borderRadius: 8, padding: '12px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <strong>Modo conferência somente leitura: {viewAs.nome} ({formatarCpf(viewAs.cpf)})</strong>
          <button onClick={sairVisualizacao} style={{ background: '#dfe6e9', color: '#2d3436' }}>Sair da visualização</button>
        </div>
      )}

      {canAdministrar && !viewAs && (
        <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 16, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Conferir visão de professor</div>
          <input
            value={buscaProfessor}
            onChange={(event) => setBuscaProfessor(event.target.value)}
            placeholder="Digite nome, CPF ou e-mail do professor"
          />
          {buscandoProfessor && <p style={{ color: '#636e72', marginBottom: 0 }}>Buscando...</p>}
          {erroBuscaProfessor && <p style={{ color: '#d63031', marginBottom: 0 }}>{erroBuscaProfessor}</p>}
          {professoresBusca.length > 0 && (
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {professoresBusca.map((item) => (
                <div key={item.cpf} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, border: '1px solid #f0f0f0', borderRadius: 8, padding: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.nomeSocial || item.nome || 'Nome não informado'}</div>
                    <div style={{ color: '#636e72', fontSize: 13 }}>{formatarCpf(item.cpf)} · {item.corporativoEmail || item.email || 'e-mail não informado'}</div>
                  </div>
                  <button onClick={() => iniciarVisualizacao(item)} style={{ background: '#0984e3', color: '#fff' }}>Visualizar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && <p>Carregando...</p>}
      {!loading && turmas.length === 0 && <p style={{ color: '#636e72' }}>Nenhuma turma atribuída.</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {turmas.map(turma => (
          <div
            key={turma.id}
            onClick={() => navigate(`/turmas/${turma.id}/cronograma`)}
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
