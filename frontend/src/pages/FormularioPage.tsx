import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import EscalaSelector from '../components/EscalaSelector'
import LegendaPanel from '../components/LegendaPanel'

interface OpcaoEscala { id: string; chave: string; rotuloUI: string; corHex?: string | null; descricaoLegenda: string; ordem: number }
interface EscalaResposta { id: string; codigo: string; nomeExibicao: string; opcoes: OpcaoEscala[] }
interface Pergunta { id: string; codigo: string; enunciado: string; ordem: number; escala?: EscalaResposta | null }
interface Secao { id: string; titulo: string; ordem: number; perguntas: Pergunta[] }
interface Formulario { id: string; nome: string; versao: string; secoes: Secao[] }

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
  const [status, setStatus] = useState<'RASCUNHO' | 'ENVIADA' | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [observacoes, setObservacoes] = useState('')
  const [notification, setNotification] = useState<Notification | null>(null)

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
    ]).then(([formRes, alunosRes, turmasRes, subRes]) => {
      setFormulario(formRes.data)
      const foundAluno = alunosRes.data.find((a: any) => a.id === alunoId)
      setAluno(foundAluno || null)
      const foundTurma = turmasRes.data.find((t: any) => t.id === turmaId)
      setTurma(foundTurma || null)

      const subs: any[] = subRes.data
      if (subs.length > 0) {
        const sub = subs[0]
        setSubmissaoId(sub.id)
        setStatus(sub.status)
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

  const allEscalas = useCallback((): EscalaResposta[] => {
    if (!formulario) return []
    const map = new Map<string, EscalaResposta>()
    formulario.secoes.forEach(s => s.perguntas.forEach(p => {
      if (p.escala) map.set(p.escala.id, p.escala)
    }))
    return Array.from(map.values())
  }, [formulario])

  async function salvar(enviar = false) {
    if (!formulario || !turma) return
    setSaving(true)
    try {
      const body = {
        formularioId: formulario.id,
        escolaId: turma.escolaId,
        turmaId,
        alunoId,
        observacoes,
        respostas: Object.entries(respostas).map(([perguntaId, opcaoEscalaId]) => ({ perguntaId, opcaoEscalaId })),
      }

      const res = await api.post('/submissoes', body)
      const sid: string = res.data.id
      setSubmissaoId(sid)
      setStatus('RASCUNHO')

      if (enviar) {
        await api.put(`/submissoes/${sid}/enviar`)
        setStatus('ENVIADA')
        showNotification('success', 'Formulário enviado com sucesso!')
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

  const isEnviada = status === 'ENVIADA'
  const escalas = allEscalas()

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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={() => navigate(`/turmas/${turmaId}/alunos`)} style={{ background: '#dfe6e9', color: '#2d3436', padding: '8px 14px' }}>← Voltar</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>{formulario.nome}</h1>
          <p style={{ margin: '2px 0 0', color: '#636e72', fontSize: 13 }}>Aluno: <strong>{aluno.nome}</strong> {aluno.matricula ? `· Mat. ${aluno.matricula}` : ''}{submissaoId ? ` · #${submissaoId.slice(0, 8)}` : ''}</p>
        </div>
        {isEnviada && (
          <span style={{ marginLeft: 'auto', background: '#00b894', color: '#fff', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 700 }}>Enviada</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 24, alignItems: 'start' }}>
        {/* Form */}
        <div>
          {formulario.secoes.map(secao => (
            <div key={secao.id} style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 16, color: '#0984e3', borderBottom: '2px solid #f0f0f0', paddingBottom: 10 }}>{secao.titulo}</h2>
              {secao.perguntas.map(pergunta => (
                <div key={pergunta.id} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f5f6fa' }}>
                  <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 500, color: '#2d3436' }}>
                    <span style={{ color: '#b2bec3', fontSize: 12, marginRight: 6 }}>{pergunta.codigo}</span>
                    {pergunta.enunciado}
                  </div>
                  {pergunta.escala ? (
                    <EscalaSelector
                      opcoes={pergunta.escala.opcoes}
                      value={respostas[pergunta.id] || null}
                      onChange={(opcaoId) => setRespostas(prev => ({ ...prev, [pergunta.id]: opcaoId }))}
                      disabled={isEnviada}
                    />
                  ) : (
                    <span style={{ color: '#b2bec3', fontSize: 12 }}>Sem escala definida</span>
                  )}
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
                disabled={saving}
                style={{ background: '#0984e3', color: '#fff', padding: '10px 24px', flex: 2 }}
              >
                {saving ? 'Enviando...' : 'Enviar Formulário'}
              </button>
            </div>
          )}
        </div>

        {/* Legenda */}
        <LegendaPanel escalas={escalas} />
      </div>
    </div>
  )
}
