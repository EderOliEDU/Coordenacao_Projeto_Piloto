import { useState } from 'react'
import type { Armazenamento } from '../hooks/useArmazenamento'
const GiB=1024**3
const data=(s:string)=>new Date(s).toLocaleString('pt-BR',{timeZone:'America/Cuiaba',dateStyle:'short',timeStyle:'short'})
export default function GraficoArmazenamento({dados}:{dados:Armazenamento}){
 const [dias,setDias]=useState(7)
 const [modo,setModo]=useState<'ocupacao'|'midias'>('ocupacao')
 const [selecionado,setSelecionado]=useState<number|null>(null)
 const disco=dados.discos[0]
 const pontos=(dados.historico||[]).filter(p=>Date.parse(p.coletadoEm)>=Date.now()-dias*86400000)
 const passo=Math.max(1,Math.ceil(pontos.length/72))
 const serie=pontos.filter((_,i)=>i%passo===0||i===pontos.length-1)
 const percentual=disco?100*disco.ocupado/disco.total:0
 const valores=serie.map(p=>modo==='ocupacao'?[100*(p.total-p.disponivel)/p.total]:[p.audiosBytes/GiB,p.fotosBytes/GiB])
 const ymax=modo==='ocupacao'?100:Math.max(1,...valores.flat())*1.1
 const x=(i:number)=>40+(serie.length<=1?300:i*600/(serie.length-1))
 const y=(n:number)=>190-160*n/ymax
 const linha=(indice:number)=>serie.map((_,i)=>`${x(i)},${y(valores[i][indice])}`).join(' ')
 const atual=selecionado!==null?serie[selecionado]:undefined
 return <section className="section-card armazenamento-grafico"><h2>Gráficos do armazenamento</h2>
  {disco&&<div className="armazenamento-capacidade"><svg viewBox="0 0 160 160" role="img" aria-label={`Disco de mídias: ${percentual.toFixed(1)}% ocupado ou reservado; ${(100-percentual).toFixed(1)}% disponível.`}>
   <circle cx="80" cy="80" r="60" fill="none" stroke="#dce9e3" strokeWidth="20"/>
   <circle cx="80" cy="80" r="60" fill="none" stroke={disco.nivel==='critico'?'#be3932':disco.nivel==='atencao'?'#b9840e':'#287a66'} strokeWidth="20" pathLength="100" strokeDasharray={`${percentual} ${100-percentual}`} transform="rotate(-90 80 80)"/>
   <text x="80" y="78" textAnchor="middle" fontSize="22" fontWeight="700">{percentual.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</text><text x="80" y="98" textAnchor="middle" fontSize="11">ocupado / reservado</text>
  </svg><div><h3>Disco de áudios e fotos</h3><p><strong>{(disco.disponivel/GiB).toLocaleString('pt-BR',{maximumFractionDigits:2})} GiB disponíveis</strong> de {(disco.total/GiB).toLocaleString('pt-BR',{maximumFractionDigits:2})} GiB.</p><p>Os espaços do sistema, banco e mídias não são somados quando compartilham o mesmo disco.</p></div></div>}
  <div className="armazenamento-grafico-filtros"><label>Período<select value={dias} onChange={e=>{setDias(Number(e.target.value));setSelecionado(null)}}><option value={1}>Últimas 24 horas</option><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option></select></label><label>Indicador<select value={modo} onChange={e=>{setModo(e.target.value as typeof modo);setSelecionado(null)}}><option value="ocupacao">Ocupação do disco (%)</option><option value="midias">Tamanho de áudios e fotos (GiB)</option></select></label></div>
  {dados.avisoHistorico&&<p>{dados.avisoHistorico}</p>}
  {!serie.length?<p>O histórico será exibido a partir das próximas coletas. Não há dados anteriores registrados.</p>:<>
   <p>{modo==='ocupacao'?'Ocupação do disco (%)':'Áudios (verde) e fotos (azul), em GiB'}. Registros por hora, atualizados a cada coleta. Passe o cursor ou selecione um ponto para consultar os valores.</p>
   <svg viewBox="0 0 680 230" role="img" aria-label={`Evolução do armazenamento: ${serie.length} pontos, de ${data(serie[0].coletadoEm)} a ${data(serie[serie.length-1].coletadoEm)}`}>
    {[0,.5,1].map(t=><g key={t}><line x1="40" x2="640" y1={y(ymax*t)} y2={y(ymax*t)} stroke="#dbe3eb"/><text x="4" y={y(ymax*t)+4} fontSize="11">{(ymax*t).toLocaleString('pt-BR',{maximumFractionDigits:1})}</text></g>)}
    <polyline points={linha(0)} fill="none" stroke="#287a66" strokeWidth="3"/>
    {modo==='midias'&&<polyline points={linha(1)} fill="none" stroke="#2867a5" strokeWidth="3"/>}
    {serie.map((p,i)=><g key={p.coletadoEm}>{valores[i].map((valor,j)=><circle key={j} cx={x(i)} cy={y(valor)} r="4" fill={j?'#2867a5':'#287a66'} tabIndex={0} onFocus={()=>setSelecionado(i)} onMouseEnter={()=>setSelecionado(i)} aria-label={`${data(p.coletadoEm)}: ${valor.toFixed(2)} ${modo==='ocupacao'?'%':'GiB'}`}><title>{`${data(p.coletadoEm)}: ${valor.toFixed(2)} ${modo==='ocupacao'?'%':'GiB'}`}</title></circle>)}</g>)}
    <text x="40" y="220" fontSize="10">{data(serie[0].coletadoEm)}</text><text x="640" y="220" fontSize="10" textAnchor="end">{data(serie[serie.length-1].coletadoEm)}</text>
   </svg>
   {atual&&<p role="status">{data(atual.coletadoEm)} · {((atual.total-atual.disponivel)*100/atual.total).toLocaleString('pt-BR',{maximumFractionDigits:1})}% ocupado · {atual.audiosQuantidade.toLocaleString('pt-BR')} áudios · {atual.fotosQuantidade.toLocaleString('pt-BR')} fotos.</p>}
   <details><summary>Consultar os dados do gráfico</summary><div style={{overflowX:'auto'}}><table><thead><tr><th>Coleta (Cuiabá)</th><th>Disponível (GiB)</th><th>Áudios</th><th>Fotos</th></tr></thead><tbody>{serie.map(p=><tr key={p.coletadoEm}><td>{data(p.coletadoEm)}</td><td>{(p.disponivel/GiB).toFixed(2)}</td><td>{p.audiosQuantidade.toLocaleString('pt-BR')}</td><td>{p.fotosQuantidade.toLocaleString('pt-BR')}</td></tr>)}</tbody></table></div></details>
  </>}
 </section>
}
