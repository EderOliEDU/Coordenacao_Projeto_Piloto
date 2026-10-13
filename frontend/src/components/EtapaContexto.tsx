import { ETAPAS, etapaDaPagina } from './etapas'
import './EtapaContexto.css'

export default function EtapaContexto({ pathname }: { pathname: string }) {
  const chave = etapaDaPagina(pathname)
  if (!chave) return null
  const etapa = ETAPAS[chave]
  return <section className={`pif-etapa-banner pif-etapa-${chave} no-print`} aria-label={`Etapa ${etapa.numero}: ${etapa.titulo}`}>
    <span className="pif-etapa-numero" aria-hidden="true">{etapa.numero}</span>
    <div><strong>Etapa {etapa.numero} · {etapa.titulo}</strong><p>{etapa.descricao}</p></div>
  </section>
}

export function VisaoDasEtapas() {
  return <section className="pif-etapas-visao" aria-label="Etapas de coleta do projeto">
    {Object.entries(ETAPAS).map(([chave, etapa]) => <article className={`pif-etapa-card pif-etapa-${chave}`} key={chave}>
      <span className="pif-etapa-numero" aria-hidden="true">{etapa.numero}</span>
      <h2>{etapa.titulo}</h2><p>{etapa.descricao}</p>
      <small>{etapa.roteiro}</small>
    </article>)}
  </section>
}
