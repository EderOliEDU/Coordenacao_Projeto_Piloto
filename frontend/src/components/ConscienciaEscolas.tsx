import { useState } from 'react'
import { paginarGrupos, type ReferenciasQ1Q5, type IndiceEscola } from '../relatorioTerceira'
const quebrar=(texto:string)=>texto.split(/\s+/).reduce<string[]>((linhas,palavra)=>{
  const ultima=linhas.length-1
  if(ultima>=0 && linhas[ultima].length+palavra.length<24)linhas[ultima]+=' '+palavra
  else linhas.push(palavra)
  return linhas
},[])
const numero=(v:number)=>v.toLocaleString('pt-BR',{maximumFractionDigits:1})
export default function ConscienciaEscolas({escolas,onSelect,nivel="escola",referencias}:{escolas:IndiceEscola[];onSelect?:(id:number)=>void;nivel?:"escola"|"turma";referencias:ReferenciasQ1Q5|null}) {
  const [pagina,setPagina]=useState(0)
  const {itens:visiveis,atual,total}=paginarGrupos(escolas,pagina)
  const refs=referencias
  if(!escolas.length)return <p>Não há aplicações concluídas neste recorte.</p>
  const largura=Math.max(760,visiveis.length*150+100),altura=nivel==="turma"?Math.max(440,350+Math.max(...visiveis.map(e=>(quebrar(e.subtitulo||"").length+quebrar(e.escola).length)))*16):490,topo=38,fundo=300,esquerda=52,direita=largura-24
  const y=(v:number)=>fundo-v/100*(fundo-topo)
  const passo=(direita-esquerda)/visiveis.length
  const linhas=refs ? [
    {nome:'Maior',valor:refs.maior,cor:'#23754f',traco:'8 4'},
    {nome:'Média',valor:refs.media,cor:'#9a5800',traco:'4 4'},
    {nome:'Menor',valor:refs.menor,cor:'#9f3650',traco:'2 4'},
  ] : []
  return <figure className="ar-escolas">
    <figcaption>Pontuação por {nivel} · escala de 0 a 100</figcaption>
    <div className="ar-referencias">{linhas.map(l=><span key={l.nome} style={{color:l.cor}}><i style={{borderColor:l.cor,borderTopStyle:l.nome==='Média'?'solid':'dashed'}}/>{l.nome}: <strong>{numero(l.valor)}</strong></span>)}</div>
    {!refs&&<p>Sem avaliações completas para calcular as pontuações e linhas de referência.</p>}
    <div className="ar-escolas-scroll" tabIndex={0} role="region" aria-label="Gráfico de pontuação por escola; role horizontalmente para ver todas as escolas">
      <svg viewBox={`0 0 ${largura} ${altura}`} style={{width:largura}} role="group" aria-label="Colunas de pontuação com linhas de média, maior e menor pontuação">
        <title>Consciência Fonológica — pontuação por escola</title>
        <desc>Cada coluna representa a média das pontuações individuais completas do grupo. As referências consideram todas as escolas ou todas as turmas do projeto, independentemente da página e do recorte. A tabela abaixo contém todos os valores.</desc>
        {[0,20,40,60,80,100].map(v=><g key={v}><line x1={esquerda} x2={direita} y1={y(v)} y2={y(v)} stroke="#e1e7ef"/><text x={esquerda-10} y={y(v)+4} textAnchor="end" fill="#526477" fontSize="12">{v}</text></g>)}
        {visiveis.map((e,i)=>{
          const x=esquerda+passo*(i+.5),valor=e.mediaExata ?? e.media
          return <g key={e.escolaId} role={onSelect?'button':undefined} tabIndex={onSelect?0:undefined}
            aria-label={onSelect?`Abrir ${e.escola}`:undefined} className={onSelect?'ar-coluna-link':undefined}
            onClick={()=>onSelect?.(e.escolaId)} onKeyDown={ev=>{if(onSelect && (ev.key==='Enter'||ev.key===' ')){ev.preventDefault();onSelect(e.escolaId)}}}>
            <rect x={x-passo/2} y={topo} width={passo} height={altura-topo} fill="transparent"/>
            <title>{e.escola}{e.subtitulo?` — ${e.subtitulo}`:""}: {valor===null?'sem pontuação':numero(valor)+' pontos'}; avaliações completas: {e.completas} de {e.base}</title>
            {valor===null?<text x={x} y={fundo-12} textAnchor="middle" fontSize="12" fill="#526477">Sem dados</text>:<>
              <rect x={x-23} y={y(valor)} width={46} height={Math.max(0,fundo-y(valor))} rx={4} fill="#397eb4"/>
              {valor===0&&<line x1={x-23} x2={x+23} y1={fundo} y2={fundo} stroke="#397eb4" strokeWidth={4}/>}
              <text x={x} y={y(valor)-10} textAnchor="middle" fill="#183047" fontSize="13" fontWeight="700">{numero(valor)}</text>
            </>}
            {nivel==="turma"?<text x={x} y={fundo+24} textAnchor="middle" fontSize="11" fill="#35485b">
              {quebrar(e.escola).map((linha,j)=><tspan key={`nome-${j}`} x={x} dy={j===0?0:16} fontWeight="700">{linha}</tspan>)}
              {quebrar(e.subtitulo||'').map((linha,j)=><tspan key={j} x={x} dy={16}>{linha}</tspan>)}
            </text>:<text transform={`translate(${x+5},${fundo+22}) rotate(-48)`} textAnchor="end" fontSize="11" fill="#35485b">{e.escola.length>39?e.escola.slice(0,36)+'…':e.escola}</text>}
          </g>
        })}
        {linhas.map(l=><line key={l.nome} x1={esquerda} x2={direita} y1={y(l.valor)} y2={y(l.valor)} stroke={l.cor} strokeWidth={2} strokeDasharray={l.traco} pointerEvents="none"/>)}
      </svg>
    </div>
    <nav className="ar-paginacao" aria-label="Páginas do gráfico">
      <button disabled={atual===0} onClick={()=>setPagina(atual-1)}>Anterior</button>
      {Array.from({length:total},(_,i)=><button key={i} aria-current={i===atual?'page':undefined} onClick={()=>setPagina(i)}>Painel {i+1}</button>)}
      <button disabled={atual===total-1} onClick={()=>setPagina(atual+1)}>Próximo</button>
      <span role="status">{atual*5+1}–{Math.min((atual+1)*5,escolas.length)} de {escolas.length} {nivel==='escola'?'escolas':'turmas'}</span>
    </nav>
    <p className="ar-pontuacao-nota">Referências globais: {refs?.grupos ?? 0} {nivel==='escola'?'escolas':'turmas'} com pontuação em todo o projeto. Média com peso igual por criança completa; maior e menor são os extremos das pontuações de todas essas {nivel==='escola'?'escolas':'turmas'}. As linhas permanecem iguais ao mudar de painel ou abrir uma turma. Ausência não vale zero.</p>
    <details><summary>Ver pontuações e cobertura deste painel</summary>
      <div className="ag-scroll"><table><caption>Pontuação por escola no recorte selecionado</caption><thead><tr><th scope="col">{nivel==="escola"?"Escola":"Turma"}</th><th scope="col">Pontuação / 100</th><th scope="col">Completas</th><th scope="col">Base</th><th scope="col">Incompletas</th></tr></thead>
        <tbody>{visiveis.map(e=><tr key={e.escolaId}><th scope="row">{onSelect?<button className="ar-drill-link" onClick={()=>onSelect(e.escolaId)}>{e.escola}</button>:e.escola}{e.subtitulo&&<small className="ar-professora-rotulo">{e.subtitulo}</small>}</th><td>{e.media===null?'Sem dados':numero(e.media)}</td><td>{e.completas}</td><td>{e.base}</td><td>{e.incompletas}</td></tr>)}</tbody>
      </table></div>
    </details>
  </figure>
}
