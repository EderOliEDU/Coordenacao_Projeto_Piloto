interface OpcaoEscala {
  id: string; chave: string; rotuloUI: string; corHex?: string | null; descricaoLegenda: string; ordem: number
}

interface Props {
  opcoes: OpcaoEscala[]
  value: string | null
  onChange: (opcaoId: string) => void
  disabled?: boolean
  textOnly?: boolean
}

export default function EscalaSelector({ opcoes, value, onChange, disabled, textOnly = false }: Props) {
  const useColorSwatches = !textOnly && opcoes.some(o => o.corHex)

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {opcoes.map(op => {
        const selected = value === op.id
        return useColorSwatches ? (
          <button
            key={op.id}
            onClick={() => !disabled && onChange(op.id)}
            disabled={disabled}
            title={op.descricaoLegenda}
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              padding: 0,
              background: op.corHex || '#ccc',
              border: selected ? '3px solid #2d3436' : '3px solid transparent',
              outline: selected ? '2px solid #0984e3' : 'none',
              outlineOffset: 1,
              transition: 'border 0.1s, outline 0.1s',
            }}
          />
        ) : (
          <button
            key={op.id}
            onClick={() => !disabled && onChange(op.id)}
            disabled={disabled}
            title={op.descricaoLegenda}
            style={{
              background: selected ? '#0984e3' : '#fff',
              color: selected ? '#fff' : '#2d3436',
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
              border: selected ? '2px solid #0984e3' : '2px solid #dfe6e9',
            }}
          >
            {op.rotuloUI || op.chave}
          </button>
        )
      })}
    </div>
  )
}
