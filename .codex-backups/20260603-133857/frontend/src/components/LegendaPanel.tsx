interface OpcaoEscala {
  id: string; chave: string; rotuloUI: string; corHex?: string | null; descricaoLegenda: string
}

interface EscalaResposta {
  codigo: string; nomeExibicao: string; opcoes: OpcaoEscala[]
}

interface Props {
  escalas: EscalaResposta[]
}

export default function LegendaPanel({ escalas }: Props) {
  const peaEscala = escalas.find(e => e.codigo === 'ESC_PEA_COR')
  if (!peaEscala) return null

  return (
    <div style={{
      position: 'sticky', top: 16, background: '#fff', borderRadius: 10,
      padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', fontSize: 13,
    }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#636e72', textTransform: 'uppercase', letterSpacing: 1 }}>Legenda</h3>
      {peaEscala.opcoes.map(op => (
        <div key={op.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 20, height: 20, borderRadius: 4, flexShrink: 0,
            background: op.corHex || '#ccc', border: '1px solid rgba(0,0,0,0.1)',
          }} />
          <div style={{ color: '#4a4a4a', lineHeight: 1.4 }}>{op.descricaoLegenda}</div>
        </div>
      ))}
    </div>
  )
}
