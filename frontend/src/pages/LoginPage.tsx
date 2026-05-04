import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

type LoginMode = 'cpf' | 'admin'

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('cpf')
  const [cpf, setCpf] = useState('')
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function formatCpf(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body =
        mode === 'admin'
          ? { usuario, senha }
          : { cpf: cpf.replace(/\D/g, ''), senha }

      const { data } = await api.post('/auth/login', body)
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))

      if (data.user?.role === 'ADMIN') {
        navigate('/admin/consolidacao')
      } else if (data.user?.mustChangePassword) {
        navigate('/trocar-senha')
      } else {
        navigate('/turmas')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 40, width: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, color: '#0984e3' }}>Piloto EI</h1>
        <p style={{ margin: '0 0 24px', color: '#636e72', fontSize: 13 }}>Coordenação – Projeto Piloto Educação Infantil</p>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid #dfe6e9' }}>
          <button
            type="button"
            onClick={() => setMode('cpf')}
            style={{
              flex: 1, padding: '9px 0', fontSize: 13, fontWeight: mode === 'cpf' ? 700 : 400,
              background: mode === 'cpf' ? '#0984e3' : '#fff', color: mode === 'cpf' ? '#fff' : '#636e72',
              border: 'none', cursor: 'pointer',
            }}
          >
            Professor (CPF)
          </button>
          <button
            type="button"
            onClick={() => setMode('admin')}
            style={{
              flex: 1, padding: '9px 0', fontSize: 13, fontWeight: mode === 'admin' ? 700 : 400,
              background: mode === 'admin' ? '#6c5ce7' : '#fff', color: mode === 'admin' ? '#fff' : '#636e72',
              border: 'none', cursor: 'pointer',
            }}
          >
            Administrador
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'cpf' ? (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#636e72', display: 'block', marginBottom: 6 }}>CPF</label>
              <input
                value={formatCpf(cpf)}
                onChange={e => setCpf(e.target.value.replace(/\D/g, ''))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                autoComplete="username"
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #dfe6e9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#636e72', display: 'block', marginBottom: 6 }}>Usuário</label>
              <input
                value={usuario}
                onChange={e => setUsuario(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #dfe6e9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#636e72', display: 'block', marginBottom: 6 }}>
              {mode === 'cpf' ? 'Senha (data de nascimento no 1º acesso: DDMMAAAA)' : 'Senha'}
            </label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #dfe6e9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          {error && <p style={{ color: '#d63031', fontSize: 13, marginBottom: 16, margin: '0 0 16px' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: mode === 'admin' ? '#6c5ce7' : '#0984e3',
              color: '#fff', padding: '12px 0', fontSize: 15, fontWeight: 600,
              border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
