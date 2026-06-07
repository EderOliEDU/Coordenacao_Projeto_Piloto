import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import EscalaSelector from '../components/EscalaSelector'

const orientacaoRespostas = [
  'As legendas a seguir têm caráter formativo e orientador, servindo como apoio ao registro e à análise do percurso de aprendizagem das crianças no Plano Piloto. Elas não têm finalidade classificatória, mas auxiliam professoras e coordenadoras a identificar avanços, dificuldades e necessidades de intervenção pedagógica. Cada marcação deve considerar o ritmo, o contexto e as especificidades de cada criança, incluindo aquelas público-alvo da Educação Especial ou em estudo de caso.',
  'A avaliação do projeto será realizada de forma contínua, sistemática e formativa, com o objetivo de acompanhar os processos de aprendizagem das crianças e contribuir com o aprimoramento do fazer pedagógico dos professores nas unidades participantes do Plano Piloto.',
  'Ressalta-se que esta avaliação não tem como finalidade medir, classificar ou ranquear as crianças, mas sim compreender seus percursos de aprendizagem, respeitando seus tempos, ritmos e singularidades.',
  'Parte-se do princípio de que as crianças não são números ou dados, mas sujeitos em pleno desenvolvimento. Assim, o compromisso da proposta está centrado no desenvolvimento integral e em um olhar sensível e individualizado para cada criança, considerando suas potencialidades, necessidades e contextos.',
  'O processo contará com a aplicação de uma atividade diagnóstica inicial, com a finalidade de identificar os conhecimentos prévios das crianças no início do projeto, e uma atividade diagnóstica final, possibilitando a análise dos avanços ao longo do percurso, especialmente nas turmas do 5º agrupamento.',
  'O monitoramento contínuo ocorrerá por meio de registros realizados pelas professoras, a partir de enfoques de observação previamente definidos. Este instrumento se configura como um apoio à prática docente, favorecendo a organização do olhar pedagógico, a reflexão sobre as estratégias utilizadas e o acompanhamento intencional das aprendizagens, sem caráter avaliativo classificatório.',
  'Esse instrumento de registro será de caráter mensal, realizado pelas professoras em conjunto com as coordenadoras, em um processo colaborativo de análise e acompanhamento das aprendizagens. O registro será feito por meio de um website, com marcações orientadas pelos enfoques de observação e também por um sistema de cores, facilitando a visualização, o acompanhamento e a tomada de decisões pedagógicas.',
  'Com o objetivo de fortalecer o alinhamento e garantir a unidade na implementação da proposta, a coordenadora de cada unidade realizará, mensalmente, momentos de acompanhamento junto às professoras, auxiliando na análise dos registros e no direcionamento das práticas.',
  'Os registros contemplarão, principalmente, as habilidades relacionadas à consciência fonológica e fonêmica, à compreensão do princípio alfabético, à matemática e ao desenvolvimento do senso de organização, possibilitando um acompanhamento individualizado e próximo, respeitando as especificidades de cada turma e os diferentes ritmos de aprendizagem.',
  'O projeto também considerará as crianças público-alvo da Educação Especial, assegurando práticas inclusivas, as adaptações necessárias e o respeito às particularidades de cada criança.',
  'Ressalta-se que o relatório semestral descritivo será mantido, preservando-se, assim, um instrumento já consolidado na rede, que possibilita uma análise qualitativa mais ampla do desenvolvimento das crianças.',
  'Além dos instrumentos estruturados, o acompanhamento será complementado por meio da observação das práticas em sala, registros pedagógicos e devolutivas formativas. A evolução ao longo do processo será sistematizada e analisada, permitindo a identificação de avanços, desafios e necessidades de ajuste, subsidiando a tomada de decisões pedagógicas e contribuindo para o aperfeiçoamento da proposta.',
  'Os enfoques de observação permitem identificar desde o domínio das habilidades até situações que demandam maior intervenção pedagógica, assegurando um olhar individualizado para o percurso de aprendizagem das crianças.',
  'Para as crianças público-alvo da Educação Especial e para aquelas que se encontram em estudo de caso, os enfoques consideram o nível de acompanhamento em relação ao fluxo das propostas pedagógicas, respeitando suas especificidades, ritmo de aprendizagem e a necessidade de estratégias diferenciadas. Nesse sentido, utiliza-se: SF, SFP e NSF.',
]

interface OpcaoEscala { id: string; chave: string; rotuloUI: string; corHex?: string | null; descricaoLegenda: string; ordem: number }
interface EscalaResposta { id: string; codigo: string; nomeExibicao: string; opcoes: OpcaoEscala[] }
interface Pergunta { id: string; codigo: string; enunciado: string; ordem: number; escala?: EscalaResposta | null }
interface Secao { id: string; titulo: string; ordem: number; perguntas: Pergunta[] }
interface Formulario { id: string; nome: string; versao: string; secoes: Secao[] }
interface NecessidadeEspecifica { id: string; descricao: string; tipo: string }

type Respostas = Record<string, string> // perguntaId -> opcaoEscalaId

type Notification = { type: 'success' | 'error'; message: string }

export default function FormularioPage() {
  const { turmaId, alunoId } = useParams<{ turmaId: string; alunoId: string }>()
  const navigate = useNavigate()

  const [formulario, setFormulario] = useState<Formulario | null>(null)
  const [aluno, setAluno] = useState<any>(null)
  const [turma, setTurma] = useState<any>(null)
  const [respostas, setRespostas] = useState<Respostas>({})
  const [submissaoId, setSubmissaoId] = useState<string | null>(null)
  const [status, setStatus] = useState<'RASCUNHO' | 'FINALIZADO' | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [observacoes, setObservacoes] = useState('')
  const [notification, setNotification] = useState<Notification | null>(null)
  const [professorNome, setProfessorNome] = useState('')
  const [necessidades, setNecessidades] = useState<NecessidadeEspecifica[]>([])
  const [necessidadesSelecionadas, setNecessidadesSelecionadas] = useState<string[]>([])
  const [caminhoNaoPaee, setCaminhoNaoPaee] = useState<'' | 'ESTUDO_CASO' | 'APOIO'>('')
  const [apoioPedagogico, setApoioPedagogico] = useState<'' | 'SIM' | 'NAO'>('')
  const [descricaoOutros, setDescricaoOutros] = useState('')
  const [orientacaoAberta, setOrientacaoAberta] = useState(false)

  function showNotification(type: 'success' | 'error', message: string) {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  useEffect(() => {
    Promise.all([
      api.get('/formularios/ativo'),
      api.get(`/turmas/${turmaId}/alunos`),
      api.get(`/turmas`),
      api.get(`/submissoes?turmaId=${turmaId}&alunoId=${alunoId}`),
      api.get('/auth/me').catch(() => ({ data: null })),
      api.get('/necessidades-especificas').catch(() => ({ data: [] })),
      api.get(`/necessidades-especificas/aluno/${alunoId}?turmaId=${turmaId}`).catch(() => ({ data: null })),
    ]).then(([formRes, alunosRes, turmasRes, subRes, meRes, necessidadesRes, alunoNecRes]) => {
      setFormulario(formRes.data)
      const foundAluno = alunosRes.data.find((a: any) => a.id === alunoId)
      setAluno(foundAluno || null)
      const foundTurma = turmasRes.data.find((t: any) => t.id === turmaId)
      setTurma(foundTurma || null)
      setProfessorNome(meRes.data?.professor?.nome || JSON.parse(localStorage.getItem('professor') || '{}').nome || '')
      setNecessidades(Array.isArray(necessidadesRes.data) ? necessidadesRes.data : [])

      const necessidadesSalvas = alunoNecRes.data?.necessidades || []
      setNecessidadesSelecionadas(necessidadesSalvas.filter((item: any) => item.necessidadeId).map((item: any) => item.necessidadeId))
      const outroSalvo = necessidadesSalvas.find((item: any) => item.descricaoOutros)
      setDescricaoOutros(outroSalvo?.descricaoOutros || '')
      const contexto = alunoNecRes.data?.contexto
      if (contexto?.estudoCaso === true) setCaminhoNaoPaee('ESTUDO_CASO')
      if (contexto?.apoioPedagogico !== null && contexto?.apoioPedagogico !== undefined) setCaminhoNaoPaee('APOIO')
      if (contexto?.apoioPedagogico === true) setApoioPedagogico('SIM')
      if (contexto?.apoioPedagogico === false) setApoioPedagogico('NAO')

      const subs: any[] = subRes.data
      if (subs.length > 0) {
        const sub = subs[0]
        setSubmissaoId(sub.id)
        setStatus(sub.status === 'ENVIADA' ? 'FINALIZADO' : sub.status)
        // Load full submission with respostas
        api.get(`/submissoes/${sub.id}`).then(r => {
          const rs: Respostas = {}
          r.data.respostas?.forEach((resp: any) => {
            rs[resp.perguntaId] = resp.opcaoEscalaId
          })
          setRespostas(rs)
          setObservacoes(r.data.observacoes || '')
        })
      }
    }).finally(() => setLoading(false))
  }, [turmaId, alunoId])

  function normalizarTexto(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]+/gi, ' ')
      .trim()
      .toUpperCase()
  }

  function isPerguntaPublicoAlvo(pergunta: Pergunta) {
    return normalizarTexto(pergunta.enunciado).includes('PUBLICO ALVO DA EDUCACAO ESPECIAL')
  }

  function isPerguntaEstudoCaso(pergunta: Pergunta) {
    const texto = normalizarTexto(`${pergunta.codigo} ${pergunta.enunciado}`)
    return pergunta.id === '2' || pergunta.codigo === 'P2' || pergunta.codigo === 'P02' || texto.includes('ESTUDO DE CASO')
  }

  function isPerguntaFluxoInicial(pergunta: Pergunta) {
    return pergunta.id === '3' || pergunta.codigo === 'P3' || pergunta.codigo === 'P03'
  }

  function respostaSimNao(pergunta: Pergunta | null) {
    if (!pergunta?.escala) return null
    const opcaoId = respostas[pergunta.id]
    const opcao = pergunta.escala.opcoes.find(item => item.id === opcaoId)
    const texto = normalizarTexto(`${opcao?.chave || ''} ${opcao?.rotuloUI || ''} ${opcao?.descricaoLegenda || ''}`)
    if (texto.includes('SIM') || texto === 'S') return 'SIM'
    if (texto.includes('NAO') || texto === 'N') return 'NAO'
    return null
  }

  function toggleNecessidade(id: string) {
    setNecessidadesSelecionadas(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  function selecionarResposta(pergunta: Pergunta, opcaoId: string) {
    setRespostas(prev => ({ ...prev, [pergunta.id]: opcaoId }))
    if (isPerguntaPublicoAlvo(pergunta)) {
      const opcao = pergunta.escala?.opcoes.find(item => item.id === opcaoId)
      const texto = normalizarTexto(`${opcao?.chave || ''} ${opcao?.rotuloUI || ''} ${opcao?.descricaoLegenda || ''}`)
      if (texto.includes('SIM') || texto === 'S') {
        setCaminhoNaoPaee('')
        setApoioPedagogico('')
        setDescricaoOutros('')
      }
    }
  }

  function selecionarCaminhoNaoPaee(caminho: 'ESTUDO_CASO' | 'APOIO') {
    setCaminhoNaoPaee(caminho)
    if (caminho === 'ESTUDO_CASO') {
      const idsPaee = new Set(necessidades.filter(item => item.tipo === 'PAEE').map(item => item.id))
      setNecessidadesSelecionadas(prev => prev.filter(id => idsPaee.has(id)))
      setApoioPedagogico('')
      setDescricaoOutros('')
    } else {
      const idsApoio = new Set(necessidades.filter(item => item.tipo !== 'PAEE').map(item => item.id))
      setNecessidadesSelecionadas(prev => prev.filter(id => idsApoio.has(id)))
    }
  }

  async function salvar(enviar = false) {
    if (!formulario || !turma) return
    setSaving(true)
    try {
      const perguntaPublicoAlvo = formulario.secoes.flatMap(secao => secao.perguntas).find(isPerguntaPublicoAlvo) || null
      const respostaPublicoAlvo = respostaSimNao(perguntaPublicoAlvo)
      const idsPaee = new Set(necessidades.filter(item => item.tipo === 'PAEE').map(item => item.id))
      const idsApoio = new Set(necessidades.filter(item => item.tipo !== 'PAEE').map(item => item.id))
      const estudoCaso = respostaPublicoAlvo === 'NAO' && caminhoNaoPaee === 'ESTUDO_CASO'
      const tipoNecessidade = respostaPublicoAlvo === 'SIM' || estudoCaso ? 'PAEE' : respostaPublicoAlvo === 'NAO' && caminhoNaoPaee === 'APOIO' && apoioPedagogico === 'SIM' ? 'APOIO' : null
      const selecionadas = necessidadesSelecionadas.filter(id => tipoNecessidade === 'PAEE' ? idsPaee.has(id) : tipoNecessidade === 'APOIO' ? idsApoio.has(id) : false)

      const body = {
        formularioId: formulario.id,
        escolaId: turma.escolaId,
        turmaId,
        alunoId,
        observacoes,
        status: enviar ? 'FINALIZADO' : 'RASCUNHO',
        respostas: Object.entries(respostas).map(([perguntaId, opcaoEscalaId]) => ({ perguntaId, opcaoEscalaId })),
        necessidadesEspecificas: {
          paee: respostaPublicoAlvo === 'SIM' ? true : respostaPublicoAlvo === 'NAO' ? false : null,
          estudoCaso,
          apoioPedagogico: respostaPublicoAlvo === 'NAO' && caminhoNaoPaee === 'APOIO' ? apoioPedagogico === 'SIM' : null,
          tipo: tipoNecessidade,
          selecionadas,
          descricaoOutros: tipoNecessidade === 'APOIO' ? descricaoOutros : '',
        },
      }

      const res = await api.post('/submissoes/respostas', body)
      const sid: string = res.data.id
      setSubmissaoId(sid)
      setStatus(enviar ? 'FINALIZADO' : 'RASCUNHO')

      if (enviar) {
        showNotification('success', 'Formulário finalizado com sucesso!')
        navigate(`/turmas/${turmaId}/alunos`)
      } else {
        showNotification('success', 'Rascunho salvo com sucesso!')
      }
    } catch (err: any) {
      showNotification('error', err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 32 }}>Carregando...</div>
  if (!formulario || !aluno) return <div style={{ padding: 32, color: '#d63031' }}>Formulário ou aluno não encontrado.</div>

  const isEnviada = status === 'FINALIZADO'
  const perguntaPublicoAlvo = formulario.secoes.flatMap(secao => secao.perguntas).find(isPerguntaPublicoAlvo) || null
  const respostaPublicoAlvo = respostaSimNao(perguntaPublicoAlvo)
  const paeeOptions = necessidades.filter(item => item.tipo === 'PAEE')
  const apoioOptions = necessidades.filter(item => item.tipo !== 'PAEE')
  const selectedPaeeCount = necessidadesSelecionadas.filter(id => paeeOptions.some(item => item.id === id)).length
  const selectedApoioCount = necessidadesSelecionadas.filter(id => apoioOptions.some(item => item.id === id)).length
  const precisaOutros = descricaoOutros.trim().length > 0
  const totalNecessidadesObrigatorias = respostaPublicoAlvo === 'SIM'
    ? 1
    : respostaPublicoAlvo === 'NAO'
      ? (caminhoNaoPaee === 'ESTUDO_CASO' ? 2 : caminhoNaoPaee === 'APOIO' ? (apoioPedagogico === 'SIM' ? 3 : 2) : 1)
      : 0
  const totalNecessidadesRespondidas = respostaPublicoAlvo === 'SIM'
    ? (selectedPaeeCount > 0 ? 1 : 0)
    : respostaPublicoAlvo === 'NAO'
      ? (caminhoNaoPaee ? 1 : 0)
        + (caminhoNaoPaee === 'ESTUDO_CASO' && selectedPaeeCount > 0 ? 1 : 0)
        + (caminhoNaoPaee === 'APOIO' && apoioPedagogico ? 1 : 0)
        + (caminhoNaoPaee === 'APOIO' && apoioPedagogico === 'SIM' && (selectedApoioCount > 0 || precisaOutros) ? 1 : 0)
      : 0
  const perguntasObrigatorias = formulario.secoes.flatMap(secao => secao.perguntas).filter(pergunta => pergunta.escala && !isPerguntaEstudoCaso(pergunta))
  const totalObrigatorias = perguntasObrigatorias.length + totalNecessidadesObrigatorias
  const totalRespondidas = perguntasObrigatorias.filter(pergunta => Boolean(respostas[pergunta.id])).length + totalNecessidadesRespondidas
  const formularioCompleto = totalObrigatorias > 0 && totalRespondidas === totalObrigatorias
  const faltantes = Math.max(totalObrigatorias - totalRespondidas, 0)
  const turnos: Record<string, string> = { MANHA: 'Manhã', TARDE: 'Tarde', NOITE: 'Noite', INTEGRAL: 'Integral' }

  const renderOpcoesNecessidades = (opcoes: NecessidadeEspecifica[]) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
      {opcoes.map(opcao => {
        const selected = necessidadesSelecionadas.includes(opcao.id)
        return (
          <label
            key={opcao.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 8,
              border: selected ? '2px solid #0984e3' : '1px solid #dfe6e9',
              borderRadius: 6,
              padding: '8px 10px',
              background: selected ? '#eef7ff' : '#fff',
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.25,
              textAlign: 'left',
              cursor: isEnviada ? 'default' : 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={selected}
              disabled={isEnviada}
              onChange={() => toggleNecessidade(opcao.id)}
              style={{ flex: '0 0 16px', width: 16, height: 16, minWidth: 16, margin: 0 }}
            />
            <span style={{ flex: 1, minWidth: 0, textAlign: 'left', overflowWrap: 'anywhere' }}>{opcao.descricao}</span>
          </label>
        )
      })}
    </div>
  )

  const renderNecessidadesPanel = () => {
    if (respostaPublicoAlvo === 'SIM') {
      return (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid #dfe6e9', borderRadius: 8, background: '#f8fbff' }}>
          <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#2d3436' }}>Marque a necessidade especifica do estudante</div>
          {renderOpcoesNecessidades(paeeOptions)}
        </div>
      )
    }

    if (respostaPublicoAlvo === 'NAO') {
      return (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid #dfe6e9', borderRadius: 8, background: '#f8fbff' }}>
          <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#2d3436' }}>Selecione a situação do estudante</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: caminhoNaoPaee ? 12 : 0 }}>
            <button
              type="button"
              disabled={isEnviada}
              onClick={() => selecionarCaminhoNaoPaee('ESTUDO_CASO')}
              style={{
                background: caminhoNaoPaee === 'ESTUDO_CASO' ? '#0984e3' : '#fff',
                color: caminhoNaoPaee === 'ESTUDO_CASO' ? '#fff' : '#2d3436',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                border: caminhoNaoPaee === 'ESTUDO_CASO' ? '2px solid #0984e3' : '2px solid #dfe6e9',
              }}
            >
              P2 Em estudo de caso?
            </button>
            <button
              type="button"
              disabled={isEnviada}
              onClick={() => selecionarCaminhoNaoPaee('APOIO')}
              style={{
                background: caminhoNaoPaee === 'APOIO' ? '#0984e3' : '#fff',
                color: caminhoNaoPaee === 'APOIO' ? '#fff' : '#2d3436',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                border: caminhoNaoPaee === 'APOIO' ? '2px solid #0984e3' : '2px solid #dfe6e9',
              }}
            >
              Não são PAEE, mas podem precisar de apoio pedagógico?
            </button>
          </div>

          {caminhoNaoPaee === 'ESTUDO_CASO' && (
            <>
              <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#2d3436' }}>Marque a necessidade específica do estudante em estudo de caso</div>
              {renderOpcoesNecessidades(paeeOptions)}
            </>
          )}

          {caminhoNaoPaee === 'APOIO' && (
            <>
              <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#2d3436' }}>Precisa de apoio pedagógico?</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: apoioPedagogico === 'SIM' ? 12 : 0 }}>
            {(['SIM', 'NAO'] as const).map(opcao => (
              <button
                key={opcao}
                type="button"
                disabled={isEnviada}
                onClick={() => setApoioPedagogico(opcao)}
                style={{
                  background: apoioPedagogico === opcao ? '#0984e3' : '#fff',
                  color: apoioPedagogico === opcao ? '#fff' : '#2d3436',
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  border: apoioPedagogico === opcao ? '2px solid #0984e3' : '2px solid #dfe6e9',
                }}
              >
                {opcao === 'SIM' ? 'Sim' : 'Não'}
              </button>
            ))}
              </div>

              {apoioPedagogico === 'SIM' && (
                <>
                  {renderOpcoesNecessidades(apoioOptions)}
                  <label style={{ display: 'block', marginTop: 10, fontSize: 13, fontWeight: 700, color: '#2d3436' }}>
                    Outros
                    <input
                      value={descricaoOutros}
                      onChange={event => setDescricaoOutros(event.target.value)}
                      disabled={isEnviada}
                      style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #dfe6e9', borderRadius: 6, padding: '8px 10px', fontSize: 14 }}
                      placeholder="Descreva outra necessidade de apoio"
                    />
                  </label>
                </>
              )}
            </>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      {/* Inline notification */}
      {notification && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 1000,
          background: notification.type === 'success' ? '#00b894' : '#d63031',
          color: '#fff', padding: '12px 20px', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)', fontSize: 14, fontWeight: 500,
          maxWidth: 360,
        }}>
          {notification.message}
        </div>
      )}

      {orientacaoAberta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="orientacao-respostas-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(45, 52, 54, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setOrientacaoAberta(false)}
        >
          <div
            style={{
              width: 'min(760px, 100%)',
              maxHeight: '86vh',
              overflowY: 'auto',
              background: '#fff',
              borderRadius: 8,
              padding: '20px 24px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.22)',
            }}
            onClick={event => event.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
              <div>
                <h2 id="orientacao-respostas-title" style={{ margin: 0, fontSize: 18, color: '#2d3436' }}>Orientação para as respostas</h2>
                <p style={{ margin: '4px 0 0', color: '#636e72', fontSize: 13 }}>Texto de apoio ao registro e à análise do percurso de aprendizagem.</p>
              </div>
              <button
                type="button"
                onClick={() => setOrientacaoAberta(false)}
                style={{ background: '#dfe6e9', color: '#2d3436', padding: '6px 12px', borderRadius: 6 }}
              >
                Fechar
              </button>
            </div>

            <div style={{ color: '#2d3436', fontSize: 14, lineHeight: 1.55 }}>
              {orientacaoRespostas.map((paragrafo, index) => (
                <p key={index} style={{ margin: index === 0 ? '0 0 12px' : '12px 0' }}>{paragrafo}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={() => navigate(`/turmas/${turmaId}/alunos`)} style={{ background: '#dfe6e9', color: '#2d3436', padding: '8px 14px' }}>Voltar</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>{formulario.nome}</h1>
          <p style={{ margin: '2px 0 0', color: '#636e72', fontSize: 13 }}>
            {professorNome && <>Professor: <strong>{professorNome}</strong> · </>}
            {turma && <>{turma.nome} · {turma.escola?.nome} · {turnos[turma.turno] || turma.turno}</>}
          </p>
          <p style={{ margin: '2px 0 0', color: '#636e72', fontSize: 13 }}>Aluno: <strong>{aluno.nome}</strong> {aluno.matricula ? `· Mat. ${aluno.matricula}` : ''}{submissaoId ? ` · #${submissaoId.slice(0, 8)}` : ''}</p>
        </div>
        {isEnviada && (
          <span style={{ marginLeft: 'auto', background: '#00b894', color: '#fff', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 700 }}>Finalizada</span>
        )}
      </div>

      {!isEnviada && (
        <div style={{ background: formularioCompleto ? '#e8f8f3' : '#fff8e1', border: `1px solid ${formularioCompleto ? '#b7eadb' : '#ffe3a3'}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#2d3436', fontSize: 14 }}>
          {formularioCompleto
            ? 'Todas as perguntas obrigatórias foram respondidas. O formulário já pode ser finalizado.'
            : `${totalRespondidas}/${totalObrigatorias} perguntas obrigatórias respondidas. Faltam ${faltantes}; enquanto isso, salve como rascunho.`}
        </div>
      )}

      <div>
        {/* Form */}
        <div>
          {formulario.secoes.map(secao => (
            <div key={secao.id} style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 16, color: '#0984e3', borderBottom: '2px solid #f0f0f0', paddingBottom: 10 }}>{secao.titulo}</h2>
              {secao.perguntas.filter(pergunta => !isPerguntaEstudoCaso(pergunta)).map(pergunta => (
                <div key={pergunta.id} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f5f6fa' }}>
                  <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 500, color: '#2d3436', display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setOrientacaoAberta(true)}
                      style={{
                        background: 'transparent',
                        border: 0,
                        color: '#0984e3',
                        padding: 0,
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: 'underline',
                      }}
                    >
                      Orientações
                    </button>
                    <span style={{ color: '#b2bec3', fontSize: 12 }}>{pergunta.codigo}</span>
                    <span>{pergunta.enunciado}</span>
                  </div>
                  {pergunta.escala ? (
                    <EscalaSelector
                      opcoes={pergunta.escala.opcoes}
                      value={respostas[pergunta.id] || null}
                      onChange={(opcaoId) => selecionarResposta(pergunta, opcaoId)}
                      disabled={isEnviada}
                      textOnly={isPerguntaFluxoInicial(pergunta)}
                    />
                  ) : (
                    <span style={{ color: '#b2bec3', fontSize: 12 }}>Sem escala definida</span>
                  )}
                  {isPerguntaPublicoAlvo(pergunta) && renderNecessidadesPanel()}
                </div>
              ))}
            </div>
          ))}

          {/* Observações */}
          <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 16, color: '#636e72' }}>Observações</h2>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              disabled={isEnviada}
              rows={4}
              style={{
                width: '100%', border: '1px solid #dfe6e9', borderRadius: 6, padding: '10px 14px',
                fontSize: 14, resize: 'vertical', fontFamily: 'inherit',
              }}
              placeholder="Observações adicionais sobre o aluno..."
            />
          </div>

          {/* Action buttons */}
          {!isEnviada && (
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => salvar(false)}
                disabled={saving}
                style={{ background: '#dfe6e9', color: '#2d3436', padding: '10px 24px', flex: 1 }}
              >
                {saving ? 'Salvando...' : 'Salvar Rascunho'}
              </button>
              <button
                onClick={() => salvar(true)}
                disabled={saving || !formularioCompleto}
                title={!formularioCompleto ? 'Responda todas as perguntas para finalizar.' : undefined}
                style={{ background: formularioCompleto ? '#0984e3' : '#b2bec3', color: '#fff', padding: '10px 24px', flex: 2, cursor: formularioCompleto ? 'pointer' : 'not-allowed' }}
              >
                {saving ? 'Finalizando...' : 'Finalizar Formulário'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
