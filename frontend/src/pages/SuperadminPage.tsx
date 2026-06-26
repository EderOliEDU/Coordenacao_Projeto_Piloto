import { useEffect, useState } from 'react'
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
        .catch((err) => setError(err.response?.data?.error || 'Nao foi possivel buscar professores'))
        .finally(() => setLoading(false))
    }, 300)

    return () => window.clearTimeout(timer)
  }, [query])

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
      setError(err.response?.data?.error || 'Nao foi possivel resetar a senha')
    }
  }

  async function alterarSenha(targetCpf: string) {
    const cpfLimpo = onlyDigits(targetCpf)
    const novaSenha = window.prompt(`Nova senha para ${formatarCpf(cpfLimpo)}:`)
    if (!novaSenha) return

    setMessage('')
    setError('')
    try {
      await api.post('/superadmin/professores/alterar-senha', { cpf: cpfLimpo, senha: novaSenha })
      setMessage(`Senha alterada: ${formatarCpf(cpfLimpo)}`)
      setProfessores((items) => items.map((item) => item.cpf === cpfLimpo ? { ...item, senhaConfigurada: true } : item))
    } catch (err: any) {
      setError(err.response?.data?.error || 'Nao foi possivel alterar a senha')
    }
  }

  async function alterarEmailCorporativo(item: ProfessorAdmin) {
    const cpfLimpo = onlyDigits(item.cpf)
    const emailAtual = item.corporativoEmail || ''
    const contaAtual = emailAtual.replace(/@edu\.rondonopolis\.mt\.gov\.br$/i, '')
    const conta = window.prompt('Conta corporativa sem dominio:', contaAtual)
    if (!conta) return

    setMessage('')
    setError('')
    try {
      const res = await api.post('/superadmin/professores/alterar-email-corporativo', { cpf: cpfLimpo, conta })
      const corporativoEmail = res.data?.corporativoEmail || `${conta}@edu.rondonopolis.mt.gov.br`
      setMessage(`E-mail corporativo atualizado: ${corporativoEmail}`)
      setProfessores((items) => items.map((professorItem) => (
        professorItem.cpf === cpfLimpo ? { ...professorItem, corporativoEmail } : professorItem
      )))
    } catch (err: any) {
      setError(err.response?.data?.error || 'Nao foi possivel alterar o e-mail corporativo')
    }
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, color: '#0984e3', fontSize: 24 }}>Superadministracao</h1>
          <p style={{ margin: '4px 0 0', color: '#636e72', fontSize: 14 }}>Ola, {professor.nome || 'superadministrador'}</p>
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
                gap: 10,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: 8, alignItems: 'center' }}>
                <div style={{ fontWeight: 700 }}>Nome:</div>
                <div>{item.nomeSocial || item.nome || 'Nome nao informado'}</div>

                <div style={{ fontWeight: 700 }}>CPF:</div>
                <div>{formatarCpf(item.cpf)}</div>

                <div style={{ fontWeight: 700 }}>Senha:</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: item.senhaConfigurada ? '#00b894' : '#d63031', fontWeight: 700 }}>
                    {item.senhaConfigurada ? 'OK' : 'NULL'}
                  </span>
                  {item.senhaConfigurada ? (
                    <button onClick={() => resetarSenha(item.cpf)} style={{ background: '#ff7675', color: '#fff' }}>Resetar</button>
                  ) : (
                    <button onClick={() => alterarSenha(item.cpf)} style={{ background: '#0984e3', color: '#fff' }}>Alterar</button>
                  )}
                </div>

                <div style={{ fontWeight: 700 }}>E-mail:</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>{item.corporativoEmail || item.email || 'e-mail nao informado'}</span>
                  <button onClick={() => alterarEmailCorporativo(item)} style={{ background: '#74b9ff', color: '#fff' }}>
                    {item.corporativoEmail ? 'Alterar' : 'Inserir'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
