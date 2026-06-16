import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'

interface CronogramaItem {
  id: string
  tema: string
  ordem: number
  marcado: boolean
}

interface CronogramaResponse {
  turma: {
    id: string
    nome: string
    escolaNome: string
    etapaId: number
    etapaDescricao: string
  }
  itens: CronogramaItem[]
  preenchido: boolean
}

export default function CronogramaTurmaPage() {
  const { turmaId } = useParams<{ turmaId: string }>()
  const navigate = useNavigate()
  const [dados, setDados] = useState<CronogramaResponse | null>(null)
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    api.get(`/cronogramas/${turmaId}`)
      .then((res) => {
        if (!active) return
        const response = res.data as CronogramaResponse
        const itensOrdenados = [...response.itens].sort(
          (a, b) => a.ordem - b.ordem || Number(a.id) - Number(b.id)
        )
        setDados({ ...response, itens: itensOrdenados })
        setMarcados(new Set(itensOrdenados.filter((item) => item.marcado).map((item) => item.id)))
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.error || 'Erro ao carregar o cronograma da turma.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [turmaId])

  const ultimoMarcado = useMemo(() => {
    if (!dados) return null
    return [...dados.itens].reverse().find((item) => marcados.has(item.id)) || null
  }, [dados, marcados])

  function alternarItem(id: string) {
    setMensagem(null)
    setError(null)
    setMarcados((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(id)) proximo.delete(id)
      else proximo.add(id)
      return proximo
    })
  }

  async function salvar(abrirAlunos: boolean) {
    if (marcados.size === 0) {
      setError('Marque ao menos um conteúdo apresentado antes de salvar.')
      return
    }

    setSalvando(true)
    setError(null)
    setMensagem(null)
    try {
      await api.put(`/cronogramas/${turmaId}`, {
        itensMarcados: Array.from(marcados).map(Number),
      })
      if (abrirAlunos) {
        navigate(`/turmas/${turmaId}/alunos`)
        return
      }
      setMensagem('Cronograma salvo com sucesso.')
      setDados((atual) => atual ? {
        ...atual,
        preenchido: true,
        itens: atual.itens.map((item) => ({ ...item, marcado: marcados.has(item.id) })),
      } : atual)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar o cronograma da turma.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="topbar-inner">
          <div className="topbar-brand">
            <img className="mini-mark" src="/semecel_logo_horizontal_editavel.svg" alt="Prefeitura de Rondonópolis e SEMECEL" />
            <div>
              <strong>Projeto Instrução Fônica</strong>
              <span>Prefeitura Municipal de Rondonópolis</span>
            </div>
          </div>
          <button onClick={() => navigate('/turmas')} className="secondary-btn">Voltar</button>
        </div>
      </header>

      <main className="page cronograma-page">
        <div className="page-header">
          <div className="page-title">
            <p className="eyebrow">Andamento da turma</p>
            <h1>Cronograma de aplicação</h1>
            {dados && (
              <p>
                <strong>{dados.turma.nome}</strong> · {dados.turma.escolaNome}<br />
                Marque os conteúdos que já foram apresentados à turma até esta avaliação.
              </p>
            )}
          </div>
          {dados?.preenchido && (
            <button onClick={() => navigate(`/turmas/${turmaId}/alunos`)} className="secondary-btn">
              Ver alunos
            </button>
          )}
        </div>

        {loading && <p className="loading-text">Carregando cronograma...</p>}
        {!loading && error && !dados && <p className="error-text">{error}</p>}

        {!loading && dados && dados.itens.length === 0 && (
          <div className="section-card">
            <p className="empty-state">
              Não há itens de cronograma com etapa e ordem válidas para esta turma.
            </p>
          </div>
        )}

        {dados && dados.itens.length > 0 && (
          <>
            <div className="cronograma-summary">
              <div>
                <strong>{marcados.size}</strong>
                <span>conteúdos apresentados</span>
              </div>
              <p>
                {ultimoMarcado
                  ? <>Ponto atual: <strong>{ultimoMarcado.ordem}. {ultimoMarcado.tema}</strong></>
                  : 'Nenhum conteúdo marcado.'}
              </p>
            </div>

            <div className="cronograma-list">
              {dados.itens.map((item) => {
                const checked = marcados.has(item.id)
                return (
                  <label key={item.id} className={`cronograma-item ${checked ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => alternarItem(item.id)}
                    />
                    <span className="cronograma-order">{item.ordem}</span>
                    <span className="cronograma-topic">{item.tema}</span>
                  </label>
                )
              })}
            </div>

            {error && <p className="error-text">{error}</p>}
            {mensagem && <p className="success-text">{mensagem}</p>}

            <div className="cronograma-actions">
              <button onClick={() => salvar(false)} disabled={salvando} className="secondary-btn">
                {salvando ? 'Salvando...' : 'Salvar alterações'}
              </button>
              <button onClick={() => salvar(true)} disabled={salvando} className="primary-btn">
                {salvando ? 'Salvando...' : 'Salvar e escolher aluno'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
