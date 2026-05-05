import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

export default function LoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { login, password })
      localStorage.setItem('token', data.token)
      localStorage.setItem('professor', JSON.stringify(data.professor))
      navigate('/turmas')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 40, width: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, color: '#0984e3' }}>Piloto EI</h1>
        <p style={{ margin: '0 0 28px', color: '#636e72', fontSize: 14 }}>Coordenação – Projeto Piloto Educação Infantil</p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#636e72', display: 'block', marginBottom: 6 }}>Login (rede)</label>
            <input value={login} onChange={e => setLogin(e.target.value)} placeholder="seu.login" autoComplete="username" required />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#636e72', display: 'block', marginBottom: 6 }}>Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
          </div>
          {error && <p style={{ color: '#d63031', fontSize: 13, marginBottom: 16 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: '100%', background: '#0984e3', color: '#fff', padding: '12px 0', fontSize: 15 }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
