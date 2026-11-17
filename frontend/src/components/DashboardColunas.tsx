import { useEffect, useRef, useState } from 'react'
import { paginarGrupos } from '../relatorioTerceira'
import type {GrupoDashboard} from '../terceiraDashboard'
export const numeroDashboard=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:1})
function linhas(texto:string) {
  return texto.split(/\s+/).reduce<string[]>((r,p)=>{const i=r.length-1;if(i>=0&&r[i].length+p.length<23)r[i]+=' '+p;else r.push(p);return r},[])
}
interface Props {grupos:GrupoDashboard[];referencias:{media:number;maior:number;menor:number;grupos:number}|null;unidade:string;titulo:string;onOpen?:(grupo:GrupoDashboard)=>void;nivel:'escola'|'turma';nota?:string;mostrarQuantidade?:boolean;unidadeRegistro?:string;ocultarCobertura?:boolean;notaReferencias?:string;onDetalhes?:()=>void}
export default function DashboardColunas({grupos,referencias:refs,unidade,titulo,onOpen,nivel,nota,mostrarQuantidade=false,unidadeRegistro,ocultarCobertura=false,notaReferencias,onDetalhes}:Props) {
  const [pagina,setPagina]=useState(0)
  const dados=useRef<HTMLDialogElement>(null)
  const area=useRef<HTMLDivElement>(null)
  const [dimensoes,setDimensoes]=useState({width:540,height:216})
  useEffect(()=>{
    if(!area.current)return
    const observar=new ResizeObserver(([e])=>{
      const width=Math.round(e.contentRect.width),height=Math.round(e.contentRect.height)
      if(width>0&&height>0)setDimensoes(atual=>atual.width===width&&atual.height===height?atual:{width,height})
    })
    observar.observe(area.current)
    return()=>observar.disconnect()
  },[])
  const {itens,atual,total}=paginarGrupos(grupos,pagina)
  const referencias=refs?[{nome:'Média',valor:refs.media,cor:'#bc6a00',traco:'7 4'},{nome:'Maior',valor:refs.maior,cor:'#267b67',traco:'3 4'},{nome:'Menor',valor:refs.menor,cor:'#9d526b',traco:'2 5'}]:[]
  const width=dimensoes.width,height=dimensoes.height,top=mostrarQuantidade?32:24,bottom=Math.max(64,height-(nivel==='turma'?68:53)),left=25,right=width-8,step=(right-left)/Math.max(1,itens.length)
  const maxRotulo=Math.max(6,Math.floor((step-5)/4.7))
  const curto=(texto:string,max=maxRotulo)=>texto.length>max?texto.slice(0,max-1)+'…':texto
  const limpar=(nome:string)=>nome.replace(/^(ESCOLA MUNICIPAL DE EDUCAÇÃO INFANTIL|ESCOLA MUNICIPAL|EMEI|CMEI|EMCEB)\s*/i,'')
  const rotulos=(g:GrupoDashboard)=>{
    if(nivel==='turma'){
      const partes=g.nome.split(' · '),nome=partes[partes.length-1].replace(/^Turma\s*/i,'').replace(/Agrupamento/gi,'Agr.')
      const professora=g.subtitulo==='Professora não informada'?'Não informada':g.subtitulo.split(' · ').map(n=>n.trim().split(/\s+/)[0]).filter(Boolean).join(' / ')
      return [...(partes.length>1?[curto(limpar(partes[0]))]:[]),curto(nome),professora].filter(Boolean).slice(0,3)
    }
    const partes=limpar(g.nome).split(/\s+/)
    return [curto(partes[0]),...(partes.length>1?[curto(partes[partes.length-1])]:[])]
  }
  const y=(v:number)=>bottom-v/100*(bottom-top)
  return <div className="td-chart">
    <div className="td-reference">{referencias.map(r=><span key={r.nome}><i style={{borderColor:r.cor}}/>{r.nome}<strong>{numeroDashboard(r.valor)}{unidade==='%'?'%':''}</strong></span>)}<button className="td-data-open" onClick={()=>onDetalhes?onDetalhes():dados.current?.showModal()} aria-label={`Dados e detalhes: ${titulo}`} title="Nomes completos, cobertura e cálculo">ⓘ</button></div>
    {!grupos.length?<div className="td-empty">Nenhum registro neste recorte.</div>:<>
      <div ref={area} className="td-chart-scroll" tabIndex={0} role="region" aria-label={titulo}>
        <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`${titulo}. Escala de 0 a 100 ${unidade}.`}>
          <title>{titulo}</title><desc>Até cinco colunas por página. Referências globais de todas as {nivel==='escola'?'escolas':'turmas'} do projeto. Valores e cobertura disponíveis na tabela.</desc>
          {[0,25,50,75,100].map(v=><g key={v}><line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke="#e8edf2"/><text x={left-9} y={y(v)+4} textAnchor="end" fontSize="9" fill="#7a8998">{v}</text></g>)}
          {itens.map((g,i)=>{
            const x=left+step*(i+.5),v=g.valor
            return <g key={g.id} role={onOpen?'button':undefined} tabIndex={onOpen?0:undefined} className={onOpen?'td-clickable':undefined}
              aria-label={onOpen?`Abrir ${g.nome}`:undefined} onClick={()=>onOpen?.(g)}
              onKeyDown={e=>{if(onOpen&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onOpen(g)}}}>
              <title>{g.nome}{g.subtitulo?' · '+g.subtitulo:''}: {v===null?'sem dados':numeroDashboard(v)+' '+unidade}. {mostrarQuantidade?`Nome completo sem apoio: ${g.n} de ${g.avaliadas}. `:''}{!ocultarCobertura&&<>{unidadeRegistro||'Avaliações válidas'}: {g.avaliadas} de {g.base}.</>}</title>
              <rect x={x-step/2} y={top} width={step} height={height-top} fill="transparent"/>
              {v===null?<text x={x} y={bottom-9} textAnchor="middle" fontSize="9" fill="#7a8998">Sem dados</text>:<>
                <rect className="td-column" x={x-Math.min(17,step*.22)} y={y(v)} width={Math.min(34,step*.44)} height={Math.max(1,bottom-y(v))} rx="3" fill={atual===0&&i===0?'#f2ad24':'#214e71'}/>
                <text x={x} y={y(v)-(mostrarQuantidade?16:10)} textAnchor="middle" fontSize="11" fontWeight="700" fill="#244259">{numeroDashboard(v)}{unidade==='%'?'%':''}</text>
                {mostrarQuantidade&&<text x={x} y={y(v)-4} textAnchor="middle" fontSize="8" fill="#657c8c">{g.n}/{g.avaliadas}</text>}
              </>}
              <text x={x} y={bottom+16} textAnchor="middle" fontSize="9" fill="#344f65">
                {rotulos(g).map((l,j)=><tspan key={j} x={x} dy={j?13:0} fontWeight={j===0?'600':'400'}>{l}</tspan>)}
              </text>
            </g>
          })}
          {referencias.map(r=><line key={r.nome} x1={left} x2={right} y1={y(r.valor)} y2={y(r.valor)} stroke={r.cor} strokeWidth="1.6" strokeDasharray={r.traco} pointerEvents="none"/>)}
        </svg>
      </div>
      <nav className="td-pagination" aria-label={`Páginas: ${titulo}`}>
        <button aria-label="Página anterior" disabled={atual===0} onClick={()=>setPagina(atual-1)}>‹</button>
        <span className="td-page-current">Painel {atual+1} / {total}</span>
        <button aria-label="Próxima página" disabled={atual===total-1} onClick={()=>setPagina(atual+1)}>›</button>
        <span role="status">{atual*5+1}–{Math.min((atual+1)*5,grupos.length)} de {grupos.length}</span>
      </nav>
    </>}
    <dialog ref={dados} className="td-modal td-data" aria-label={`Dados: ${titulo}`}><header className="td-modal-header"><h3>{titulo}</h3><button onClick={()=>dados.current?.close()}>Fechar</button></header><p className="td-method">{nota}</p><p className="td-method">Os rótulos do gráfico são abreviados. A tabela apresenta os nomes completos.</p><div className="td-table-scroll"><table>
      <caption>{titulo}</caption><thead><tr><th scope="col">{nivel==='escola'?'Escola':'Turma'}</th><th scope="col">{unidade==='%'?'Percentual':'Pontuação'}</th>{mostrarQuantidade&&<th scope="col">Nome completo sem apoio</th>}{!ocultarCobertura&&<><th scope="col">{unidadeRegistro?'Leituras válidas':'Válidas'}</th><th scope="col">{unidadeRegistro?'Oportunidades por palavra':'Base'}</th><th scope="col">Sem registro</th></>}</tr></thead>
      <tbody>{grupos.map(g=><tr key={g.id}><th scope="row">{onOpen?<button className="td-text-button" onClick={()=>onOpen(g)}>{g.nome}</button>:g.nome}{g.subtitulo&&<small>{g.subtitulo}</small>}</th><td>{g.valor===null?'—':numeroDashboard(g.valor)+(unidade==='%'?'%':' / 100')}</td>{mostrarQuantidade&&<td>{g.n}</td>}{!ocultarCobertura&&<><td>{g.avaliadas}</td><td>{g.base}</td><td>{Math.max(0,g.base-g.avaliadas)}</td></>}</tr>)}</tbody>
    </table></div>
    <p className="td-global-note">{notaReferencias||<>Referências globais de {refs?.grupos??0} {nivel==='escola'?'escolas':'turmas'} com dados. Média ponderada pela base válida; maior e menor entre os grupos. Independentes da página e do recorte.</>}</p></dialog>
  </div>
}
