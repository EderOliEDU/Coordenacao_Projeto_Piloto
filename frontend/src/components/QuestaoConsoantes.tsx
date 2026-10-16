export const CONSOANTES = ['B', 'C', 'D', 'F', 'J', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'X', 'Z'] as const

export default function QuestaoConsoantes({ letra, resposta, opcoes, disabled, salvando, onSelecionar, onResponder }: {
  letra: string
  resposta?: string
  opcoes: { idOpcao: string; codigo: string }[]
  disabled: boolean
  salvando: boolean
  onSelecionar: (letra: string) => void
  onResponder: (idOpcao: string) => void
}) {
  const possuiImagem = CONSOANTES.includes(letra as typeof CONSOANTES[number])
  return <section style={{ background: 'white', padding: 24, borderRadius: 16, border: '1px solid #cbd5e1' }}>
    <div>Questão 5</div>
    <h2>Identificação do som das consoantes</h2>
    <p>Escolha apenas uma consoante para esta avaliação e apresente as seis figuras à criança. Peça que identifique as figuras conforme o som apresentado.</p>
    <fieldset disabled={disabled || salvando} style={{ border: 0, padding: 0, margin: 0 }}>
      <legend style={{ fontWeight: 700, marginBottom: 12 }}>Consoante aplicada</legend>
      <div role="group" aria-label="Escolher consoante" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {CONSOANTES.map(consoante => <button key={consoante} type="button"
          aria-pressed={letra === consoante} onClick={() => onSelecionar(consoante)}
          style={{ width: 48, minHeight: 48, borderRadius: 10, fontSize: 22, fontWeight: 700,
            border: `2px solid ${letra === consoante ? '#1d4ed8' : '#cbd5e1'}`,
            background: letra === consoante ? '#1d4ed8' : '#f8fafc', color: letra === consoante ? 'white' : '#0f172a',
            cursor: disabled || salvando ? 'default' : 'pointer' }}>{consoante}</button>)}
      </div>
    </fieldset>
    {possuiImagem ? <>
      <h3>Consoante {letra}</h3>
      {/* O material original está deitado no PDF. O enquadramento gira a página sem alterar suas figuras. */}
      <div style={{ position: 'relative', overflow: 'hidden', aspectRatio: '595.5 / 842.25', maxWidth: 560, margin: '20px auto' }}>
        <img src={`/questao5-consoantes/${letra}.jpg`} alt={`Consoante ${letra} e seis figuras para identificar pelo som`}
          style={{ position: 'absolute', left: '50%', top: '50%', width: `${842.25 / 595.5 * 100}%`, maxWidth: 'none', transform: 'translate(-50%, -50%) rotate(90deg)' }} />
      </div>
    </> : <p>Selecione a consoante para mostrar as seis figuras e registrar a resposta.</p>}
    <fieldset disabled={disabled || salvando || !possuiImagem} style={{ border: 0, padding: 0, margin: '20px 0 0' }}>
      <legend style={{ fontWeight: 700, marginBottom: 12 }}>Resultado da criança</legend>
      <div role="group" aria-label="Resposta da Questão 5" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {['SIM', 'NAO'].map(codigo => {
          const opcao = opcoes.find(o => o.codigo === codigo)
          if (!opcao) return null
          const selecionada = resposta === opcao.idOpcao
          const cor = codigo === 'SIM' ? '#166534' : '#991b1b'
          return <button key={codigo} type="button" aria-pressed={selecionada} onClick={() => onResponder(opcao.idOpcao)}
            style={{ flex: '1 1 220px', minHeight: 88, padding: '16px 20px', borderRadius: 12,
              border: `3px solid ${selecionada ? cor : '#cbd5e1'}`, textAlign: 'left',
              background: selecionada ? cor : (codigo === 'SIM' ? '#f0fdf4' : '#fef2f2'),
              color: selecionada ? 'white' : cor, opacity: salvando ? 0.65 : 1,
              cursor: disabled || salvando || !possuiImagem ? 'default' : 'pointer' }}>
            <strong style={{ display: 'block', fontSize: 26 }}>{selecionada ? '✓ ' : ''}{codigo === 'SIM' ? 'SIM' : 'NÃO'}</strong>
            <span style={{ display: 'block', marginTop: 4, fontSize: 18, fontWeight: 600 }}>{codigo === 'SIM' ? 'Acertou 3 ou mais figuras' : 'Acertou 2 ou menos figuras'}</span>
          </button>
        })}
      </div>
    </fieldset>
    <p aria-live="polite">{salvando ? 'Salvando resposta…' : resposta ? 'Resposta salva.' : 'Selecione SIM ou NÃO após avaliar as seis figuras.'}</p>
  </section>
}
