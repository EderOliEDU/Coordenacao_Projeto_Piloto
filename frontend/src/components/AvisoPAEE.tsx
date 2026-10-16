import { useId } from 'react'
import './AvisoPAEE.css'

interface Necessidade {
  necessidadeId: string
  descricao: string
  tipo: string | null
  descricaoOutros: string | null
}

export default function AvisoPAEE({ alunoNome, paee, necessidades = [] }: {
  alunoNome: string
  paee?: boolean
  necessidades?: Necessidade[]
}) {
  const tituloId = useId()
  if (!paee && necessidades.length === 0) return null

  function fechar(details: HTMLDetailsElement) {
    details.open = false
    details.querySelector('summary')?.focus()
  }

  return <details className="paee-aviso" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); fechar(event.currentTarget) }
  }}>
    <summary aria-label="PAEE: consultar necessidades específicas e Educação Especial"
      title="Necessidades específicas / Educação Especial">PAEE</summary>
    <section className="paee-painel" aria-labelledby={tituloId}>
      <div className="paee-painel-topo">
        <strong id={tituloId}>Necessidades específicas / Educação Especial</strong>
        <button type="button" aria-label="Fechar informações PAEE" onClick={event => {
          const details = event.currentTarget.closest('details')
          if (details) fechar(details)
        }}>×</button>
      </div>
      <p><strong>{alunoNome}</strong></p>
      <p><strong>PAEE:</strong> {paee ? 'Sim' : 'Não informado / Não identificado'}</p>
      {necessidades.length > 0 ? <ul>
        {necessidades.map(n => <li key={[n.necessidadeId,n.tipo,n.descricaoOutros].join('-')}>
          {n.descricao}{n.tipo ? ` (${n.tipo})` : ''}{n.descricaoOutros ? ` – ${n.descricaoOutros}` : ''}
        </li>)}
      </ul> : <p>Nenhuma necessidade específica registrada para esta turma/fase.</p>}
    </section>
  </details>
}
