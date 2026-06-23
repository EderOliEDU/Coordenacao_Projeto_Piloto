import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

interface ProfessorAdmin {
  cpf: string
  nome: string
  nomeSocial: string | null
  email: string | null
  corporativoEmail: string | null
  senhaConfigurada: boolean
}

function formatarCpf(cpf: string) {
  const digitos = (cpf || '').replace(/\D/g, '').padStart(11, '0')
  return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

export default function SuperadminPage() {
  const navigate = useNavigate()
  const professor = JSON.parse(localStorage.getItem('professor') || '{}')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [professores, setProfessores] = useState<ProfessorAdmin[]>([])
  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setProfessores([])
      return
    }

    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      api.get('/superadmin/professores', { params: { q: trimmed } })
        .then((res) => setProfessores(res.data || []))
        .catch((err) => setError(err.response?.data?.error || 'Não foi possível buscar professores'))
        .finally(() => setLoading(false))
    }, 300)

    return () => window.clearTimeout(timer)
  }, [query])

  function selectProfessor(item: ProfessorAdmin) {
    setCpf(item.cpf)
    setMessage(`Professor selecionado: ${item.nome || formatarCpf(item.cpf)}`)
    setError('')
  }

  async function resetarSenha(targetCpf: string) {
    const cpfLimpo = onlyDigits(targetCpf)
    if (!window.confirm(`Resetar a senha do CPF ${formatarCpf(cpfLimpo)} para NULL?`)) return

    setMessage('')
    setError('')
    try {
      await api.post('/superadmin/professores/resetar-senha', { cpf: cpfLimpo })
      setMessage(`Senha resetada para NULL: ${formatarCpf(cpfLimpo)}`)
      setProfessores((items) => items.map((item) => item.cpf === cpfLimpo ? { ...item, senhaConfigurada: false } : item))
    } catch (err: any) {
      setError(err.response?.data?.error || 'Não foi possível resetar a senha')
    }
  }

  async function alterarSenha(event: FormEvent) {
    event.preventDefault()
    const cpfLimpo = onlyDigits(cpf)

    setMessage('')
    setError('')
    try {
      await api.post('/superadmin/professores/alterar-senha', { cpf: cpfLimpo, senha })
      setMessage(`Senha alterada: ${formatarCpf(cpfLimpo)}`)
      setSenha('')
      setProfessores((items) => items.map((item) => item.cpf === cpfLimpo ? { ...item, senhaConfigurada: true } : item))
    } catch (err: any) {
      setError(err.response?.data?.error || 'Não foi possível alterar a senha')
    }
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, color: '#0984e3', fontSize: 24 }}>Superadministração</h1>
          <p style={{ margin: '4px 0 0', color: '#636e72', fontSize: 14 }}>Olá, {professor.nome || 'superadministrador'}</p>
        </div>
        <button onClick={() => navigate('/turmas')} style={{ background: '#dfe6e9', color: '#2d3436' }}>Voltar</button>
      </div>

      {(message || error) && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 8,
            background: error ? '#fff5f5' : '#f0fff8',
            border: `1px solid ${error ? '#fab1a0' : '#55efc4'}`,
            color: error ? '#c0392b' : '#006b54',
            fontWeight: 600,
          }}
        >
          {error || message}
        </div>
      )}

      <div className="superadmin-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.75fr)', gap: 16, alignItems: 'start' }}>
        <section style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Buscar professores</h2>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome, CPF ou e-mail corporativo"
            autoFocus
          />

          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            {loading && <p style={{ margin: 0, color: '#636e72' }}>Buscando...</p>}
            {!loading && query.trim().length >= 2 && professores.length === 0 && (
              <p style={{ margin: 0, color: '#636e72' }}>Nenhum professor encontrado.</p>
            )}

            {professores.map((item) => (
              <div
                key={item.cpf}
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  padding: 14,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{item.nomeSocial || item.nome || 'Nome não informado'}</div>
                  <div style={{ color: '#636e72', fontSize: 13, marginTop: 3 }}>
                    {formatarCpf(item.cpf)} · {item.corporativoEmail || item.email || 'e-mail não informado'}
                  </div>
                  <div style={{ color: item.senhaConfigurada ? '#00b894' : '#d63031', fontSize: 12, marginTop: 5, fontWeight: 700 }}>
                    {item.senhaConfigurada ? 'Senha configurada' : 'Senha NULL'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button onClick={() => selectProfessor(item)} style={{ background: '#74b9ff', color: '#fff' }}>Selecionar</button>
                  <button onClick={() => resetarSenha(item.cpf)} style={{ background: '#ff7675', color: '#fff' }}>Resetar</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Alterar senha por CPF</h2>
          <form onSubmit={alterarSenha} style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6, fontWeight: 700, fontSize: 13 }}>
              CPF
              <input
                value={cpf}
                onChange={(event) => setCpf(event.target.value)}
                placeholder="00000000000"
                inputMode="numeric"
                required
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontWeight: 700, fontSize: 13 }}>
              Nova senha
              <input
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                type="password"
                placeholder="Mínimo de 6 caracteres"
                minLength={6}
                required
              />
            </label>
            <button type="submit" style={{ background: '#0984e3', color: '#fff', width: '100%' }}>Alterar senha</button>
            <button type="button" onClick={() => resetarSenha(cpf)} style={{ background: '#ff7675', color: '#fff', width: '100%' }}>
              Resetar senha para NULL
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
