export interface RespostaVogal {
  vogal: string
  acertou: boolean | null
  origem: 'LEGADO' | 'NOVO' | 'NAO_APRESENTADA'
}

const figuras = [
  { vogal: 'A', nomes: 'abelha, bola e abacaxi', inicio: 0, fim: 354 },
  { vogal: 'E', nomes: 'estrela, elefante e tênis', inicio: 355, fim: 633 },
  { vogal: 'I', nomes: 'casa, ímã e iguana', inicio: 634, fim: 925 },
  { vogal: 'O', nomes: 'ovo, gato e orelha', inicio: 926, fim: 1217 },
  { vogal: 'U', nomes: 'bola, uva e unha', inicio: 1218, fim: 1536 }
]

export default function QuestaoVogais({ respostas, versao, disabled, salvando, onResponder }: {
  respostas: RespostaVogal[]
  versao: number
  disabled: boolean
  salvando: boolean
  onResponder: (vogal: string, acertou: boolean) => void
}) {
  const avaliadas = respostas.filter(v => v.acertou !== null).length
  const acertos = respostas.filter(v => v.acertou === true).length
  const primeiraPendente = figuras.findIndex(({ vogal }) =>
    typeof respostas.find(r => r.vogal === vogal)?.acertou !== 'boolean')
  const figurasVisiveis = figuras.filter(({ vogal }, indice) => {
    const respondida = typeof respostas.find(r => r.vogal === vogal)?.acertou === 'boolean'
    // Respostas históricas continuam visíveis mesmo quando as anteriores são NULL.
    return respondida || (!disabled && (primeiraPendente === -1 || indice <= primeiraPendente))
  })
  return <section style={{ background: 'white', padding: 24, borderRadius: 16, border: '1px solid #cbd5e1' }}>
    <div>Questão 2</div>
    <h2>Aliteração das vogais</h2>
    <p>Apresente cada vogal e as três figuras. Marque SIM quando a criança identificar as duas figuras que começam com a vogal apresentada. Marque NÃO quando identificar apenas uma ou nenhuma.</p>
    <p>{versao === 2 ? 'Avalie as cinco vogais antes de finalizar.' : 'Avaliação iniciada no formato anterior: as vogais não apresentadas podem permanecer sem avaliação.'}</p>
    {figurasVisiveis.map(({ vogal, nomes, inicio, fim }) => {
      const resposta = respostas.find(r => r.vogal === vogal)
      const valor = resposta?.acertou ?? null
      return <fieldset key={vogal} disabled={disabled || salvando} style={{ border: '1px solid #cbd5e1', borderRadius: 12, margin: '20px 0', padding: 12 }}>
        <legend style={{ fontWeight: 700 }}>Vogal {vogal}</legend>
        <div style={{ position: 'relative', overflow: 'hidden', aspectRatio: `1024 / ${fim - inicio}`, maxWidth: 900, margin: 'auto' }}>
          <img src="/questao2-vogais.jpg" alt={`${vogal}: ${nomes}`} style={{ position: 'absolute', width: '100%', maxWidth: 'none', left: 0, top: `${-inicio / (fim - inicio) * 100}%` }} />
        </div>
        <div role="group" aria-label={`Resposta da vogal ${vogal}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, paddingTop: 16 }}>
          {[true, false].map(opcao => {
            const selecionada = valor === opcao
            const cor = opcao ? '#166534' : '#991b1b'
            return <button key={String(opcao)} type="button" aria-pressed={selecionada}
              onClick={() => onResponder(vogal, opcao)}
              style={{ flex: '1 1 220px', minHeight: 88, padding: '16px 20px', borderRadius: 12,
                border: `3px solid ${selecionada ? cor : '#cbd5e1'}`,
                background: selecionada ? cor : (opcao ? '#f0fdf4' : '#fef2f2'),
                color: selecionada ? '#ffffff' : cor, textAlign: 'left',
                cursor: disabled || salvando ? 'default' : 'pointer', opacity: salvando ? 0.65 : 1 }}>
              <strong style={{ display: 'block', fontSize: 26 }}>{selecionada ? '✓ ' : ''}{opcao ? 'SIM' : 'NÃO'}</strong>
              <span style={{ display: 'block', marginTop: 4, fontSize: 16 }}>{opcao ? 'Acertou as duas figuras' : 'Acertou uma ou nenhuma'}</span>
            </button>
          })}
        </div>
        {resposta?.origem === 'LEGADO' && <p>Resposta preservada da avaliação anterior, realizada com uma vogal.</p>}
      </fieldset>
    })}
    <p aria-live="polite">{salvando ? 'Salvando resposta…' : `${avaliadas}/5 vogais avaliadas. ${avaliadas ? `Acertos: ${acertos}/${avaliadas} (${Math.round(acertos / avaliadas * 100)}%).` : 'Sem resultado ainda.'}`}</p>
  </section>
}
