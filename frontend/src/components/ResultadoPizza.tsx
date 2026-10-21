import { useId } from 'react'

interface Resultado { codigo: string; descricao: string; n: number; percentual: number | null }
const cores: Record<string, string> = {
  SIM: '#287a66', NAO: '#bd654a', COM_APOIO: '#c08b25', SEM_APOIO: '#287a66', NAO_ESCREVE: '#bd654a',
  PRE_ALFABETICA: '#bd654a', ALFABETICA_PARCIAL: '#c08b25', ALFABETICA_COMPLETA: '#2867a5', ALFABETICA_CONSOLIDADA: '#287a66',
  NAO_UTILIZA_SONS: '#bd654a', UTILIZA_ALGUNS_SONS: '#c08b25', DECODIFICA: '#2867a5', LE_AUTONOMIA: '#287a66', NAO_RESPONDEU: '#738196',
}
const rotulos: Record<string, string> = {
  SIM: 'Demonstrou', NAO: 'Não demonstrou', COM_APOIO: 'Com apoio', SEM_APOIO: 'Sem apoio', NAO_ESCREVE: 'Não escreveu',
  PRE_ALFABETICA: 'Pré-alfabética', ALFABETICA_PARCIAL: 'Alfabética parcial', ALFABETICA_COMPLETA: 'Alfabética completa', ALFABETICA_CONSOLIDADA: 'Alfabética consolidada',
  NAO_UTILIZA_SONS: 'Não utiliza sons', UTILIZA_ALGUNS_SONS: 'Utiliza alguns sons', DECODIFICA: 'Decodifica', LE_AUTONOMIA: 'Lê com autonomia', NAO_RESPONDEU: 'Não respondeu',
}
const percentual = (n: number | null) => n === null ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const ponto = (angulo: number, raio: number) => [100 + raio * Math.cos(angulo), 100 + raio * Math.sin(angulo)]

export default function ResultadoPizza({ item, avaliadas, resultados }: { item: string; avaliadas: number; resultados: Resultado[] }) {
  const id = useId()
  const titulo = `${item}: ${avaliadas ? resultados.map(r => `${rotulos[r.codigo] || r.descricao}: ${r.n} (${percentual(r.percentual)})`).join('; ') : 'Sem dados: nenhuma resposta válida'}`
  let inicio = -Math.PI / 2
  return <figure className="ar-pizza">
    <svg viewBox="0 0 200 200" role="img" aria-labelledby={id}>
      <title id={id}>{titulo}</title>
      {!avaliadas ? <><circle cx="100" cy="100" r="88" fill="#f0f3f6" stroke="#b8c4cf" strokeDasharray="5 5" /><text x="100" y="105" textAnchor="middle" fill="#526477" fontSize="15">Sem dados</text></> : resultados.filter(r => r.n > 0).map(r => {
        const angulo = r.n / avaliadas * 2 * Math.PI
        const fim = inicio + angulo
        const [x1, y1] = ponto(inicio, 88); const [x2, y2] = ponto(fim, 88)
        const [tx, ty] = ponto(inicio + angulo / 2, 57)
        const path = `M 100 100 L ${x1} ${y1} A 88 88 0 ${angulo > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`
        inicio = fim
        return <g key={r.codigo}>
          {r.n === avaliadas ? <circle cx="100" cy="100" r="88" fill={cores[r.codigo] || '#526477'} /> : <path d={path} fill={cores[r.codigo] || '#526477'} stroke="#fff" strokeWidth="1.5" />}
          {r.n / avaliadas >= .07 && <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central" fill="#fff" fontWeight="600" fontSize="13">{percentual(r.percentual)}</text>}
        </g>
      })}
    </svg>
    <figcaption>
      <span className="ar-pizza-base">{avaliadas} respostas válidas</span>
      {avaliadas > 0 && <ul>{resultados.filter(r => r.n > 0).map(r => <li key={r.codigo}>
        <i aria-hidden="true" style={{ background: cores[r.codigo] || '#526477' }} />
        <span>{rotulos[r.codigo] || r.descricao}: {r.n} ({percentual(r.percentual)})</span>
      </li>)}</ul>}
    </figcaption>
  </figure>
}
