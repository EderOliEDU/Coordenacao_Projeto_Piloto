import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

export default function LoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const { data } = await api.post('/auth/login', { login, password })
      if (data.ok && data.message && !data.token) {
        setMessage(data.message)
        return
      }

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
    <main className="auth-shell">
      <section className="auth-brand">
        <img className="brand-mark" src="/semecel_logo_horizontal_fundo_branco.png" alt="Prefeitura de Rondonópolis e SEMECEL" />
        <h1>Projeto Instrução Fônica</h1>
        <p>Ambiente de acompanhamento pedagógico da Educação Infantil na rede municipal de Rondonópolis.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">Prefeitura Municipal de Rondonópolis</p>
          <h2>Acesso ao sistema</h2>
          <p className="hint">Informe o CPF somente com números. No primeiro acesso, deixe a senha em branco para receber o link de cadastro no e-mail corporativo.</p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>CPF somente números</label>
              <input value={login} onChange={e => setLogin(e.target.value)} placeholder="Somente números" autoComplete="username" required />
            </div>

            <div className="field">
              <label>Senha</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Deixe em branco no primeiro acesso" autoComplete="current-password" />
            </div>

            {message && <p className="success-text" style={{ fontSize: 13 }}>{message}</p>}
            {error && <p className="error-text" style={{ fontSize: 13 }}>{error}</p>}

            <button type="submit" disabled={loading} className="primary-btn" style={{ width: '100%', marginTop: 8 }}>
              {loading ? 'Processando...' : 'Entrar ou enviar link'}
            </button>
          </form>
        </div>
      </section>
      <img className="dev-signature" src="/semecel_ti_tecnologia_ajustada_editavel.svg" alt="Desenvolvimento SEMECEL TI" />
    </main>
  )
}
