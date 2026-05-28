import { FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api/client'

export default function CadastrarSenhaPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const { data } = await api.post('/auth/cadastrar-senha', {
        token,
        password,
        confirmPassword,
      })
      setSuccess(data.message || 'Senha cadastrada com sucesso.')
      setPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao cadastrar senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <img className="brand-mark" src="/semecel_logo_horizontal_fundo_azul.png" alt="Prefeitura de Rondonópolis e SEMECEL" />
        <h1>Cadastro de senha</h1>
        <p>Crie uma senha pessoal para acessar o Projeto Instrução Fônica com segurança.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">Prefeitura Municipal de Rondonópolis</p>
          <h2>Definir senha</h2>
          <p className="hint">Use o link recebido no e-mail corporativo. O link é individual e temporário.</p>

          {!token && (
            <div>
              <p className="error-text" style={{ fontSize: 14 }}>Link inválido ou incompleto.</p>
              <Link to="/login" className="button-link primary-btn" style={{ display: 'block', textAlign: 'center' }}>
                Voltar para a página inicial
              </Link>
            </div>
          )}

          {token && success && (
            <div>
              <p className="success-text" style={{ fontSize: 14 }}>{success}</p>
              <Link to="/login" className="button-link primary-btn" style={{ display: 'block', textAlign: 'center' }}>
                Ir para a página inicial
              </Link>
            </div>
          )}

          {token && !success && (
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Nova senha</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} autoComplete="new-password" required />
              </div>

              <div className="field">
                <label>Confirmar senha</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={6} autoComplete="new-password" required />
              </div>

              {error && <p className="error-text" style={{ fontSize: 13 }}>{error}</p>}

              <button type="submit" disabled={loading} className="primary-btn" style={{ width: '100%', marginTop: 8 }}>
                {loading ? 'Gravando...' : 'Gravar senha'}
              </button>

              <Link to="/login" style={{ display: 'block', marginTop: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                Voltar para a página inicial
              </Link>
            </form>
          )}
        </div>
      </section>
      <img className="dev-signature" src="/semecel_ti_tecnologia_ajustada_editavel.svg" alt="Desenvolvimento SEMECEL TI" />
    </main>
  )
}
