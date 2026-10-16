import { useEffect, useState } from 'react'
import AplicadorAcompanhamento from './AplicadorAcompanhamento'

export default function AplicadorAcompanhamentoPage() {
  const [fases, setFases] = useState<{ idFase: string; nome: string; ordem: number }[]>([])
  const [faseId, setFaseId] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/superadmin/aplicador/fases', { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }, signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Não foi possível carregar as fases.')
        const data = await response.json()
        if (controller.signal.aborted) return
        setFases(data)
        setFaseId([...data].sort((a, b) => b.ordem - a.ordem)[0]?.idFase || '')
      }).catch(error => { if (!controller.signal.aborted) setErro(error.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])
  return <div style={{ maxWidth: 1180, padding: 24, margin: '0 auto' }}>
    <h1>Acompanhamento das verificações por aplicadores</h1>
    <p>Consulte a coleta da etapa 2: turmas atribuídas, responsáveis pelas aplicações, andamento e observações dos alunos.</p>
    {erro && <p role="alert" className="error-text">{erro}</p>}
    <label htmlFor="fase-acompanhamento">Fase de avaliação</label>
    <select id="fase-acompanhamento" value={faseId} disabled={loading} onChange={event => setFaseId(event.target.value)} style={{ maxWidth: 500, display: 'block', margin: '8px 0 24px' }}>
      <option value="">{loading ? 'Carregando fases...' : 'Selecione uma fase'}</option>
      {fases.map(f => <option key={f.idFase} value={f.idFase}>{f.nome}</option>)}
    </select>
    <AplicadorAcompanhamento faseId={faseId} revisao={0} />
  </div>
}
