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

interface EscolaAdmin {
  id: string
  nome: string
}

interface TurmaAdmin {
  id: string
  nome: string
  escolaId: string
  escolaNome: string
  etapaDescricao: string | null
  turno: string | null
}

interface AtribuicaoProfessor {
  cpf: string
  nome: string | null
  turmaId: string
  turmaNome: string
  escolaId: string
  escolaNome: string
  etapaDescricao: string | null
  turno: string | null
}

interface AlunoAdmin {
  id: string
  nome: string
  cpf: string | null
  inep: string | null
  situacao: string | null
}

interface EnturmacaoAluno {
  alunoId: string
  alunoNome: string | null
  turmaId: string
  turmaNome: string
  escolaId: string
  escolaNome: string
  etapaDescricao: string | null
  turno: string | null
}

interface AvaliacaoFase {
  id: string
  nome: string
  dataInicio: string
  dataFim: string
  ativa: boolean
  ordem: number
  descricao: string | null
}

type PerfilAcesso = 'SUPERADMIN' | 'ADMINISTRADOR' | 'COORDENADOR' | 'DIRETOR'

interface UsuarioAcesso {
  id: string
  cpf: string
  nome: string | null
  perfil: PerfilAcesso
  escolaId: string | null
  escolaNome: string | null
  ativo: boolean
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
  const [escolas, setEscolas] = useState<EscolaAdmin[]>([])
  const [turmas, setTurmas] = useState<TurmaAdmin[]>([])
  const [acessos, setAcessos] = useState<UsuarioAcesso[]>([])
  const [acessosLoading, setAcessosLoading] = useState(false)
  const [acessosQuery, setAcessosQuery] = useState('')
  const [acessoCpf, setAcessoCpf] = useState('')
  const [acessoNome, setAcessoNome] = useState('')
  const [acessoPerfil, setAcessoPerfil] = useState<PerfilAcesso>('COORDENADOR')
  const [acessoEscolaId, setAcessoEscolaId] = useState('')
  const [novoProfessor, setNovoProfessor] = useState({
    cpf: '',
    nome: '',
    nomeSocial: '',
    email: '',
    corporativoEmail: '',
  })
  const [novoAluno, setNovoAluno] = useState({
    nome: '',
    cpf: '',
    inep: '',
    situacao: 'ATIVO',
    turmaId: '',
  })
  const [atribuicaoCpf, setAtribuicaoCpf] = useState('')
  const [atribuicaoNome, setAtribuicaoNome] = useState('')
  const [atribuicaoTurmaId, setAtribuicaoTurmaId] = useState('')
  const [atribuicoes, setAtribuicoes] = useState<AtribuicaoProfessor[]>([])
  const [atribuicoesLoading, setAtribuicoesLoading] = useState(false)
  const [alunoQuery, setAlunoQuery] = useState('')
  const [alunos, setAlunos] = useState<AlunoAdmin[]>([])
  const [alunosLoading, setAlunosLoading] = useState(false)
  const [enturmacaoAlunoId, setEnturmacaoAlunoId] = useState('')
  const [enturmacaoAlunoNome, setEnturmacaoAlunoNome] = useState('')
  const [enturmacaoTurmaId, setEnturmacaoTurmaId] = useState('')
  const [enturmacoes, setEnturmacoes] = useState<EnturmacaoAluno[]>([])
  const [enturmacoesLoading, setEnturmacoesLoading] = useState(false)
  const [fases, setFases] = useState<AvaliacaoFase[]>([])
  const [novaFase, setNovaFase] = useState({
    nome: '',
    dataInicio: '',
    dataFim: '',
    ordem: '1',
    descricao: '',
  })

  function carregarFases() {
    api.get('/superadmin/avaliacao-fases')
      .then((res) => setFases(res.data || []))
      .catch((err) => setError(err.response?.data?.error || 'Nao foi possivel carregar fases'))
  }

  function carregarAcessos(q = acessosQuery) {
    setAcessosLoading(true)
    api.get('/superadmin/acessos', { params: q.trim() ? { q: q.trim() } : {} })
      .then((res) => setAcessos(res.data || []))
      .catch((err) => setError(err.response?.data?.error || 'Nao foi possivel carregar acessos'))
      .finally(() => setAcessosLoading(false))
  }

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

  useEffect(() => {
    api.get('/superadmin/escolas')
      .then((res) => setEscolas(res.data || []))
      .catch(() => setEscolas([]))
    api.get('/superadmin/turmas')
      .then((res) => setTurmas(res.data || []))
      .catch(() => setTurmas([]))
    carregarAcessos('')
    carregarFases()
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => carregarAcessos(acessosQuery), 300)
    return () => window.clearTimeout(timer)
  }, [acessosQuery])

  useEffect(() => {
    const trimmed = alunoQuery.trim()
    if (trimmed.length < 2) {
      setAlunos([])
      return
    }

    const timer = window.setTimeout(() => {
      setAlunosLoading(true)
      setError('')
      api.get('/superadmin/alunos', { params: { q: trimmed } })
        .then((res) => setAlunos(res.data || []))
        .catch((err) => setError(err.response?.data?.error || 'Nao foi possivel buscar alunos'))
        .finally(() => setAlunosLoading(false))
    }, 300)

    return () => window.clearTimeout(timer)
  }, [alunoQuery])

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

  function selecionarParaAcesso(item: ProfessorAdmin) {
    setAcessoCpf(onlyDigits(item.cpf))
    setAcessoNome(item.nomeSocial || item.nome || '')
  }

  function selecionarParaAtribuicao(item: ProfessorAdmin) {
    const cpfLimpo = onlyDigits(item.cpf)
    setAtribuicaoCpf(cpfLimpo)
    setAtribuicaoNome(item.nomeSocial || item.nome || '')
    carregarAtribuicoes(cpfLimpo)
  }

  function selecionarAlunoParaEnturmacao(item: AlunoAdmin) {
    setEnturmacaoAlunoId(item.id)
    setEnturmacaoAlunoNome(item.nome || '')
    carregarEnturmacoes(item.id)
  }

  function carregarAtribuicoes(cpf = atribuicaoCpf) {
    const cpfLimpo = onlyDigits(cpf)
    if (cpfLimpo.length !== 11) {
      setAtribuicoes([])
      return
    }

    setAtribuicoesLoading(true)
    api.get(`/superadmin/professores/${cpfLimpo}/atribuicoes`)
      .then((res) => setAtribuicoes(res.data || []))
      .catch((err) => setError(err.response?.data?.error || 'Nao foi possivel carregar atribuicoes'))
      .finally(() => setAtribuicoesLoading(false))
  }

  function carregarEnturmacoes(alunoId = enturmacaoAlunoId) {
    if (!alunoId) {
      setEnturmacoes([])
      return
    }

    setEnturmacoesLoading(true)
    api.get(`/superadmin/alunos/${alunoId}/turmas`)
      .then((res) => setEnturmacoes(res.data || []))
      .catch((err) => setError(err.response?.data?.error || 'Nao foi possivel carregar turmas do aluno'))
      .finally(() => setEnturmacoesLoading(false))
  }

  async function salvarAcesso() {
    const cpfLimpo = onlyDigits(acessoCpf)
    const precisaEscola = acessoPerfil === 'COORDENADOR' || acessoPerfil === 'DIRETOR'

    setMessage('')
    setError('')
    try {
      await api.post('/superadmin/acessos', {
        cpf: cpfLimpo,
        perfil: acessoPerfil,
        escolaId: precisaEscola ? acessoEscolaId : null,
      })
      setMessage(`Acesso cadastrado para ${formatarCpf(cpfLimpo)}`)
      setAcessoCpf('')
      setAcessoNome('')
      setAcessoEscolaId('')
      carregarAcessos('')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Nao foi possivel cadastrar o acesso')
    }
  }

  async function alterarStatusAcesso(item: UsuarioAcesso) {
    setMessage('')
    setError('')
    try {
      await api.patch(`/superadmin/acessos/${item.id}`, { ativo: !item.ativo })
      setMessage(`${item.ativo ? 'Acesso desativado' : 'Acesso ativado'}: ${item.perfil}`)
      setAcessos((items) => items.map((acesso) => acesso.id === item.id ? { ...acesso, ativo: !item.ativo } : acesso))
    } catch (err: any) {
      setError(err.response?.data?.error || 'Nao foi possivel alterar o acesso')
    }
  }

  async function cadastrarProfessor() {
    setMessage('')
    setError('')
    try {
      await api.post('/superadmin/professores', {
        ...novoProfessor,
        cpf: onlyDigits(novoProfessor.cpf),
      })
      setMessage(`Professor cadastrado: ${formatarCpf(novoProfessor.cpf)}`)
      setNovoProfessor({ cpf: '', nome: '', nomeSocial: '', email: '', corporativoEmail: '' })
      setQuery(novoProfessor.nome || novoProfessor.cpf)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Nao foi possivel cadastrar o professor')
    }
  }

  async function cadastrarAluno() {
    setMessage('')
    setError('')
    try {
      const res = await api.post('/superadmin/alunos', {
        ...novoAluno,
        cpf: onlyDigits(novoAluno.cpf),
      })
      setMessage(`Aluno cadastrado e enturmado. ID: ${res.data?.alunoId || ''}`)
      setNovoAluno({ nome: '', cpf: '', inep: '', situacao: 'ATIVO', turmaId: '' })
      setAlunoQuery(novoAluno.nome || novoAluno.cpf || novoAluno.inep)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Nao foi possivel cadastrar o aluno')
    }
  }

  async function cadastrarFase() {
    setMessage('')
    setError('')
    try {
      await api.post('/superadmin/avaliacao-fases', {
        ...novaFase,
        ordem: Number(novaFase.ordem) || 1,
      })
      setMessage('Fase cadastrada')
      setNovaFase({ nome: '', dataInicio: '', dataFim: '', ordem: '1', descricao: '' })
      carregarFases()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Nao foi possivel cadastrar a fase')
    }
  }

  async function alterarStatusFase(item: AvaliacaoFase) {
    setMessage('')
    setError('')
    try {
      await api.patch(`/superadmin/avaliacao-fases/${item.id}`, { ativa: !item.ativa })
      setMessage(item.ativa ? 'Fase desativada' : 'Fase ativada')
      carregarFases()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Nao foi possivel alterar a fase')
    }
  }

  async function adicionarAtribuicao() {
    const cpfLimpo = onlyDigits(atribuicaoCpf)
    setMessage('')
    setError('')
    try {
      await api.post(`/superadmin/professores/${cpfLimpo}/atribuicoes`, { turmaId: atribuicaoTurmaId })
      setMessage('Turma atribuida ao professor')
      setAtribuicaoTurmaId('')
      carregarAtribuicoes(cpfLimpo)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Nao foi possivel atribuir a turma')
    }
  }

  async function removerAtribuicao(item: AtribuicaoProfessor) {
    if (!window.confirm(`Remover ${item.turmaNome} de ${formatarCpf(item.cpf)}?`)) return

    setMessage('')
    setError('')
    try {
      await api.delete(`/superadmin/professores/${item.cpf}/atribuicoes/${item.turmaId}`)
      setMessage('Atribuicao removida')
      setAtribuicoes((items) => items.filter((atribuicao) => atribuicao.turmaId !== item.turmaId))
    } catch (err: any) {
      setError(err.response?.data?.error || 'Nao foi possivel remover a atribuicao')
    }
  }

  async function adicionarEnturmacao() {
    setMessage('')
    setError('')
    try {
      await api.post(`/superadmin/alunos/${enturmacaoAlunoId}/turmas`, { turmaId: enturmacaoTurmaId })
      setMessage('Turma atribuida ao aluno')
      setEnturmacaoTurmaId('')
      carregarEnturmacoes(enturmacaoAlunoId)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Nao foi possivel atribuir a turma ao aluno')
    }
  }

  async function removerEnturmacao(item: EnturmacaoAluno) {
    if (!window.confirm(`Desatribuir ${item.turmaNome} do aluno ${item.alunoNome || enturmacaoAlunoNome}?`)) return

    setMessage('')
    setError('')
    try {
      await api.delete(`/superadmin/alunos/${item.alunoId}/turmas/${item.turmaId}`)
      setMessage('Turma desatribuida do aluno')
      setEnturmacoes((items) => items.filter((enturmacao) => enturmacao.turmaId !== item.turmaId))
    } catch (err: any) {
      setError(err.response?.data?.error || 'Nao foi possivel desatribuir a turma do aluno')
    }
  }

  const perfilPrecisaEscola = acessoPerfil === 'COORDENADOR' || acessoPerfil === 'DIRETOR'

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

      <section style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Fases da avaliacao</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            Nome
            <input value={novaFase.nome} onChange={(event) => setNovaFase((item) => ({ ...item, nome: event.target.value }))} placeholder="Ex.: 2ª Fase" />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            Inicio
            <input type="date" value={novaFase.dataInicio} onChange={(event) => setNovaFase((item) => ({ ...item, dataInicio: event.target.value }))} />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            Fim
            <input type="date" value={novaFase.dataFim} onChange={(event) => setNovaFase((item) => ({ ...item, dataFim: event.target.value }))} />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            Ordem
            <input value={novaFase.ordem} onChange={(event) => setNovaFase((item) => ({ ...item, ordem: onlyDigits(event.target.value) || '1' }))} />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            Descricao
            <input value={novaFase.descricao} onChange={(event) => setNovaFase((item) => ({ ...item, descricao: event.target.value }))} placeholder="Opcional" />
          </label>
          <button type="button" onClick={cadastrarFase} style={{ background: '#0984e3', color: '#fff' }}>
            Cadastrar fase
          </button>
        </div>

        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#636e72', textAlign: 'left' }}>
                <th style={{ padding: '8px 6px' }}>Fase</th>
                <th style={{ padding: '8px 6px' }}>Periodo</th>
                <th style={{ padding: '8px 6px' }}>Status</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Acao</th>
              </tr>
            </thead>
            <tbody>
              {fases.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid #edf2f7' }}>
                  <td style={{ padding: '10px 6px', fontWeight: 800 }}>{item.nome}</td>
                  <td style={{ padding: '10px 6px' }}>{item.dataInicio} a {item.dataFim}</td>
                  <td style={{ padding: '10px 6px', color: item.ativa ? '#00b894' : '#636e72', fontWeight: 700 }}>{item.ativa ? 'Ativa' : 'Inativa'}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                    <button type="button" onClick={() => alterarStatusFase(item)} style={{ background: item.ativa ? '#ff7675' : '#00b894', color: '#fff' }}>
                      {item.ativa ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
              {fases.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '12px 6px', color: '#636e72' }}>Nenhuma fase cadastrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Cadastrar professor</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            CPF
            <input value={novoProfessor.cpf} onChange={(event) => setNovoProfessor((item) => ({ ...item, cpf: onlyDigits(event.target.value) }))} placeholder="CPF" />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            Nome
            <input value={novoProfessor.nome} onChange={(event) => setNovoProfessor((item) => ({ ...item, nome: event.target.value }))} placeholder="Nome completo" />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            Nome social
            <input value={novoProfessor.nomeSocial} onChange={(event) => setNovoProfessor((item) => ({ ...item, nomeSocial: event.target.value }))} placeholder="Opcional" />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            E-mail
            <input value={novoProfessor.email} onChange={(event) => setNovoProfessor((item) => ({ ...item, email: event.target.value }))} placeholder="E-mail pessoal" />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            E-mail corporativo
            <input value={novoProfessor.corporativoEmail} onChange={(event) => setNovoProfessor((item) => ({ ...item, corporativoEmail: event.target.value }))} placeholder="usuario@edu.rondonopolis.mt.gov.br" />
          </label>
          <button type="button" onClick={cadastrarProfessor} style={{ background: '#0984e3', color: '#fff' }}>
            Cadastrar professor
          </button>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Cadastrar aluno</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            Nome
            <input value={novoAluno.nome} onChange={(event) => setNovoAluno((item) => ({ ...item, nome: event.target.value }))} placeholder="Nome do aluno" />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            CPF
            <input value={novoAluno.cpf} onChange={(event) => setNovoAluno((item) => ({ ...item, cpf: onlyDigits(event.target.value) }))} placeholder="Opcional" />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            INEP
            <input value={novoAluno.inep} onChange={(event) => setNovoAluno((item) => ({ ...item, inep: event.target.value }))} placeholder="Opcional" />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            Situacao
            <input value={novoAluno.situacao} onChange={(event) => setNovoAluno((item) => ({ ...item, situacao: event.target.value }))} placeholder="ATIVO" />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            Turma
            <select value={novoAluno.turmaId} onChange={(event) => setNovoAluno((item) => ({ ...item, turmaId: event.target.value }))}>
              <option value="">Selecione a turma</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>{turma.escolaNome} - {turma.nome}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={cadastrarAluno} style={{ background: '#00b894', color: '#fff' }}>
            Cadastrar aluno
          </button>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Atribuir e desatribuir turmas do aluno</h2>

        <input
          value={alunoQuery}
          onChange={(event) => setAlunoQuery(event.target.value)}
          placeholder="Buscar aluno por nome, CPF ou INEP"
        />

        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {alunosLoading && <p style={{ margin: 0, color: '#636e72' }}>Buscando alunos...</p>}
          {!alunosLoading && alunoQuery.trim().length >= 2 && alunos.length === 0 && (
            <p style={{ margin: 0, color: '#636e72' }}>Nenhum aluno encontrado.</p>
          )}
          {alunos.map((item) => (
            <div key={item.id} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{item.nome || 'Nome nao informado'}</div>
                <div style={{ color: '#636e72', fontSize: 13 }}>
                  ID {item.id}
                  {item.cpf && <> · CPF {formatarCpf(item.cpf)}</>}
                  {item.inep && <> · INEP {item.inep}</>}
                  {item.situacao && <> · {item.situacao}</>}
                </div>
              </div>
              <button type="button" onClick={() => selecionarAlunoParaEnturmacao(item)} style={{ background: '#00b894', color: '#fff' }}>
                Gerenciar turmas
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'end', marginTop: 16 }}>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            Aluno
            <input value={enturmacaoAlunoNome} onChange={(event) => setEnturmacaoAlunoNome(event.target.value)} placeholder="Selecionado na busca" disabled />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            ID do aluno
            <input
              value={enturmacaoAlunoId}
              onChange={(event) => setEnturmacaoAlunoId(onlyDigits(event.target.value))}
              onBlur={() => carregarEnturmacoes()}
              placeholder="ID"
            />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            Turma
            <select value={enturmacaoTurmaId} onChange={(event) => setEnturmacaoTurmaId(event.target.value)}>
              <option value="">Selecione a turma</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>{turma.escolaNome} - {turma.nome}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={adicionarEnturmacao} style={{ background: '#0984e3', color: '#fff' }}>
            Atribuir turma ao aluno
          </button>
        </div>

        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#636e72', textAlign: 'left' }}>
                <th style={{ padding: '8px 6px' }}>Escola</th>
                <th style={{ padding: '8px 6px' }}>Turma</th>
                <th style={{ padding: '8px 6px' }}>Turno</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Acao</th>
              </tr>
            </thead>
            <tbody>
              {enturmacoesLoading && (
                <tr>
                  <td colSpan={4} style={{ padding: '12px 6px', color: '#636e72' }}>Carregando turmas do aluno...</td>
                </tr>
              )}
              {!enturmacoesLoading && enturmacaoAlunoId && enturmacoes.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '12px 6px', color: '#636e72' }}>Nenhuma turma atribuida a este aluno.</td>
                </tr>
              )}
              {!enturmacoesLoading && enturmacoes.map((item) => (
                <tr key={item.turmaId} style={{ borderTop: '1px solid #edf2f7' }}>
                  <td style={{ padding: '10px 6px', fontWeight: 700 }}>{item.escolaNome}</td>
                  <td style={{ padding: '10px 6px' }}>{item.turmaNome}</td>
                  <td style={{ padding: '10px 6px' }}>{item.turno || '-'}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                    <button type="button" onClick={() => removerEnturmacao(item)} style={{ background: '#ff7675', color: '#fff' }}>
                      Desatribuir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
                  <button onClick={() => selecionarParaAcesso(item)} style={{ background: '#6c5ce7', color: '#fff' }}>
                    Usar em acessos
                  </button>
                  <button onClick={() => selecionarParaAtribuicao(item)} style={{ background: '#00b894', color: '#fff' }}>
                    Atribuir turmas
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginTop: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Atribuir e desatribuir turmas do professor</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            CPF do professor
            <input
              value={atribuicaoCpf}
              onChange={(event) => setAtribuicaoCpf(onlyDigits(event.target.value))}
              onBlur={() => carregarAtribuicoes()}
              placeholder="CPF"
            />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            Nome
            <input value={atribuicaoNome} onChange={(event) => setAtribuicaoNome(event.target.value)} placeholder="Selecionado na busca" disabled />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            Turma
            <select value={atribuicaoTurmaId} onChange={(event) => setAtribuicaoTurmaId(event.target.value)}>
              <option value="">Selecione a turma</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>{turma.escolaNome} - {turma.nome}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={adicionarAtribuicao} style={{ background: '#0984e3', color: '#fff' }}>
            Atribuir turma
          </button>
        </div>

        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#636e72', textAlign: 'left' }}>
                <th style={{ padding: '8px 6px' }}>Escola</th>
                <th style={{ padding: '8px 6px' }}>Turma</th>
                <th style={{ padding: '8px 6px' }}>Turno</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Acao</th>
              </tr>
            </thead>
            <tbody>
              {atribuicoesLoading && (
                <tr>
                  <td colSpan={4} style={{ padding: '12px 6px', color: '#636e72' }}>Carregando atribuicoes...</td>
                </tr>
              )}
              {!atribuicoesLoading && atribuicaoCpf.length === 11 && atribuicoes.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '12px 6px', color: '#636e72' }}>Nenhuma turma atribuida a este professor.</td>
                </tr>
              )}
              {!atribuicoesLoading && atribuicoes.map((item) => (
                <tr key={item.turmaId} style={{ borderTop: '1px solid #edf2f7' }}>
                  <td style={{ padding: '10px 6px', fontWeight: 700 }}>{item.escolaNome}</td>
                  <td style={{ padding: '10px 6px' }}>{item.turmaNome}</td>
                  <td style={{ padding: '10px 6px' }}>{item.turno || '-'}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                    <button type="button" onClick={() => removerAtribuicao(item)} style={{ background: '#ff7675', color: '#fff' }}>
                      Desatribuir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginTop: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Perfis de acesso</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            CPF
            <input value={acessoCpf} onChange={(event) => setAcessoCpf(onlyDigits(event.target.value))} placeholder="CPF do usuario" />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            Nome
            <input value={acessoNome} onChange={(event) => setAcessoNome(event.target.value)} placeholder="Selecionado na busca" disabled />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            Perfil
            <select value={acessoPerfil} onChange={(event) => {
              const perfil = event.target.value as PerfilAcesso
              setAcessoPerfil(perfil)
              if (perfil === 'SUPERADMIN' || perfil === 'ADMINISTRADOR') setAcessoEscolaId('')
            }}>
              <option value="SUPERADMIN">Superadministrador</option>
              <option value="ADMINISTRADOR">Administrador</option>
              <option value="COORDENADOR">Coordenador</option>
              <option value="DIRETOR">Diretor</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, color: '#475867', fontSize: 13 }}>
            Escola
            <select value={acessoEscolaId} onChange={(event) => setAcessoEscolaId(event.target.value)} disabled={!perfilPrecisaEscola}>
              <option value="">{perfilPrecisaEscola ? 'Selecione a escola' : 'Nao se aplica'}</option>
              {escolas.map((escola) => <option key={escola.id} value={escola.id}>{escola.nome}</option>)}
            </select>
          </label>
          <button type="button" onClick={salvarAcesso} style={{ background: '#0984e3', color: '#fff' }}>
            Cadastrar acesso
          </button>
        </div>

        <div style={{ marginTop: 18 }}>
          <input
            value={acessosQuery}
            onChange={(event) => setAcessosQuery(event.target.value)}
            placeholder="Filtrar acessos por nome, CPF ou e-mail"
          />
        </div>

        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#636e72', textAlign: 'left' }}>
                <th style={{ padding: '8px 6px' }}>Usuario</th>
                <th style={{ padding: '8px 6px' }}>Perfil</th>
                <th style={{ padding: '8px 6px' }}>Escola</th>
                <th style={{ padding: '8px 6px' }}>Status</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Acao</th>
              </tr>
            </thead>
            <tbody>
              {acessosLoading && (
                <tr>
                  <td colSpan={5} style={{ padding: '12px 6px', color: '#636e72' }}>Carregando acessos...</td>
                </tr>
              )}
              {!acessosLoading && acessos.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '12px 6px', color: '#636e72' }}>Nenhum acesso cadastrado.</td>
                </tr>
              )}
              {!acessosLoading && acessos.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid #edf2f7' }}>
                  <td style={{ padding: '10px 6px' }}>
                    <strong>{item.nome || 'Nome nao encontrado'}</strong>
                    <div style={{ color: '#636e72', fontSize: 12 }}>{formatarCpf(item.cpf)}</div>
                  </td>
                  <td style={{ padding: '10px 6px', fontWeight: 700 }}>{item.perfil}</td>
                  <td style={{ padding: '10px 6px' }}>{item.escolaNome || '-'}</td>
                  <td style={{ padding: '10px 6px', color: item.ativo ? '#00b894' : '#d63031', fontWeight: 700 }}>
                    {item.ativo ? 'Ativo' : 'Inativo'}
                  </td>
                  <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => alterarStatusAcesso(item)}
                      style={{ background: item.ativo ? '#ff7675' : '#00b894', color: '#fff' }}
                    >
                      {item.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}
