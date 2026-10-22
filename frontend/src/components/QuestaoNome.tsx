import { useState } from 'react'

export default function QuestaoNome({ opcoes, respostaId, nomeEscrito, disabled, salvando, onPendente, onSalvar }: {
  opcoes: { idOpcao: string; codigo: string; descricao: string }[]
  respostaId?: string
  nomeEscrito: string | null
  disabled: boolean
  salvando: boolean
  onPendente: () => void
  onSalvar: (idOpcao: string, nome: string | null) => void
}) {
  const [escolhida, setEscolhida] = useState(respostaId || '')
  const opcao = opcoes.find(o => o.idOpcao === escolhida)
  const precisaNome = opcao?.codigo === 'COM_APOIO' || opcao?.codigo === 'SEM_APOIO'
  const nomes = [['NOME','Só o nome'],['NOME_COMPOSTO','Nome composto'],['NOME_COMPLETO','Nome completo']]
  return <section style={{ background: 'white', padding: 24, borderRadius: 16, border: '1px solid #cbd5e1' }}>
    <div>Questão 7</div><h2>Escrita do nome</h2>
    <p>A criança escreveu o nome com apoio, sem apoio ou não escreveu?</p>
    <fieldset disabled={disabled || salvando} style={{ border: 0, padding: 0 }}>
      <legend style={{ fontWeight: 700, marginBottom: 12 }}>Apoio para escrever</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {opcoes.map(o => <button key={o.idOpcao} type="button" aria-pressed={escolhida === o.idOpcao}
          onClick={() => {
            if (escolhida === o.idOpcao && respostaId) return
            setEscolhida(o.idOpcao)
            onPendente()
            if (o.codigo === 'NAO_ESCREVE') onSalvar(o.idOpcao, null)
          }} style={{ minHeight: 48, padding: '12px 20px', borderRadius: 10,
            border: '2px solid #cbd5e1', background: escolhida === o.idOpcao ? '#1d4ed8' : '#f8fafc',
            color: escolhida === o.idOpcao ? 'white' : '#0f172a', fontSize: 17, fontWeight: 700 }}>{o.descricao}</button>)}
      </div>
    </fieldset>
    {precisaNome && <fieldset disabled={disabled || salvando} style={{ border: 0, padding: 0, marginTop: 20 }}>
      <legend style={{ fontWeight: 700, marginBottom: 12 }}>Quanto do nome a criança escreveu {opcao?.codigo === 'COM_APOIO' ? 'com apoio' : 'sem apoio'}?</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {nomes.map(([codigo, descricao]) => {
          const selecionada = respostaId === escolhida && nomeEscrito === codigo
          return <button key={codigo} type="button" aria-pressed={selecionada}
            onClick={() => onSalvar(escolhida, codigo)} style={{ minHeight: 48, padding: '12px 20px', borderRadius: 10,
              border: '2px solid #cbd5e1', background: selecionada ? '#166534' : '#f0fdf4',
              color: selecionada ? 'white' : '#166534', fontSize: 17, fontWeight: 700 }}>{descricao}</button>
        })}
      </div>
    </fieldset>}
    <p aria-live="polite">{salvando ? 'Salvando resposta…' : respostaId
      ? precisaNome && !nomeEscrito ? 'Detalhamento não registrado na avaliação anterior.' : 'Resposta salva.'
      : precisaNome ? 'Selecione quanto do nome foi escrito para salvar a resposta.' : 'Selecione uma resposta.'}</p>
  </section>
}
