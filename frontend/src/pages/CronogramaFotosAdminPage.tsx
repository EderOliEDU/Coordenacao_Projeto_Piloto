import { useEffect,useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api/client'
import { ImagemAtividade } from '../components/CronogramaFotos'
import './CronogramaFotosAdminPage.css'

type Opcao={id:string;nome:string}
interface DadosFotos {
 filtros:{escolas:Opcao[];professores:Opcao[];turmas:(Opcao&{escolaNome:string})[];conteudos:{id:string;tema:string;ordem:number;etapa:string}[]}
 fotos:{id:string;nome:string;criadoEm:string;turmaId:string;conteudoId:string;escolaNome:string;turmaNome:string;tema:string;ordem:number;professorNome:string;arquivoUrl:string}[]
 origem:'local'|'producao';producaoDisponivel:boolean;coletadoEm?:string;desatualizado?:boolean
 total:number;pagina:number;porPagina:number;totalPaginas:number
}
export default function CronogramaFotosAdminPage(){
 const [params,setParams]=useSearchParams()
 const [dados,setDados]=useState<DadosFotos|null>(null)
 const [carregando,setCarregando]=useState(true)
 const [erro,setErro]=useState('')
 const [revisao,setRevisao]=useState(0)
 const query=params.toString()
 const professorId=params.get('professorId')||''
 const escolaId=params.get('escolaId')||'',turmaId=params.get('turmaId')||'',conteudoId=params.get('conteudoId')||''
 useEffect(()=>{
  const controller=new AbortController();setCarregando(true);setErro('')
  api.get<DadosFotos>(`/cronogramas/administracao/fotos?${query}`,{signal:controller.signal,timeout:15000}).then(r=>{
   if(!controller.signal.aborted){setDados(r.data);if(r.data.producaoDisponivel&&!params.has('origem')){const next=new URLSearchParams(params);next.set('origem','producao');setParams(next,{replace:true})}}
  }).catch(e=>{if(!controller.signal.aborted)setErro(e.response?.data?.error||'Não foi possível carregar as fotos.')})
  .finally(()=>{if(!controller.signal.aborted)setCarregando(false)})
  return ()=>controller.abort()
 },[query,revisao])
 function filtrar(campo:string,valor:string){
  const next=new URLSearchParams(params)
  if(valor)next.set(campo,valor);else next.delete(campo)
  next.delete('pagina')
  if(['escolaId','turmaId','conteudoId','origem'].includes(campo))next.delete('professorId')
  if(campo==='origem'){next.delete('escolaId');next.delete('turmaId');next.delete('conteudoId')}
  if(campo==='escolaId'){next.delete('turmaId');next.delete('conteudoId')}
  if(campo==='turmaId')next.delete('conteudoId')
  setParams(next)
 }
 function pagina(n:number){const next=new URLSearchParams(params);next.set('pagina',String(n));setParams(next)}
 function sairConferencia(){sessionStorage.removeItem('viewAsProfessor');setRevisao(v=>v+1)}
 let conferindo=false
 try{conferindo=Boolean(JSON.parse(sessionStorage.getItem('viewAsProfessor')||'null')?.cpf)}catch{/* Sessão de conferência inválida. */}
 return <div className="page fotos-admin-page">
  <div className="page-header"><div className="page-title"><p className="eyebrow">Administração e parâmetros</p><h1>Fotos das atividades</h1><p>Consulte os registros anexados pelos professores. Clique na imagem para ampliar.</p></div>
   <button className="secondary-btn" disabled={carregando} onClick={()=>setRevisao(v=>v+1)}>Atualizar consulta</button>
  </div>
  {conferindo&&<div className="auth-alert">Você está no modo conferência do professor. <button className="secondary-btn" onClick={sairConferencia}>Sair da conferência e consultar todas as fotos</button></div>}
  {dados?.origem==='producao'&&<p role="status">Fotos de Produção em consulta somente leitura. Última atualização: {dados.coletadoEm?new Date(dados.coletadoEm).toLocaleString('pt-BR',{timeZone:'America/Cuiaba'}):'—'}{dados.desatualizado?' · Catálogo desatualizado; novas fotos podem ainda não aparecer.':''}</p>}
  <div className="section-card fotos-admin-filtros">
   {dados?.producaoDisponivel&&<label>Origem das fotos<select value={params.get('origem')||'local'} onChange={e=>filtrar('origem',e.target.value)}><option value="local">DEV — registros locais</option><option value="producao">Produção — somente leitura</option></select></label>}
   <label>Escola<select value={escolaId} onChange={e=>filtrar('escolaId',e.target.value)}><option value="">Todas as escolas</option>{dados?.filtros.escolas.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
   <label>Turma<select value={turmaId} onChange={e=>filtrar('turmaId',e.target.value)}><option value="">Todas as turmas</option>{dados?.filtros.turmas.map(t=><option key={t.id} value={t.id}>{t.nome}{!escolaId?` · ${t.escolaNome}`:''}</option>)}</select></label>
   <label>Conteúdo<select value={conteudoId} onChange={e=>filtrar('conteudoId',e.target.value)}><option value="">Todos os conteúdos</option>{dados?.filtros.conteudos.map(c=><option key={`${c.id}-${c.etapa}`} value={c.id}>{c.ordem}. {c.tema}{!turmaId?` · ${c.etapa}`:''}</option>)}</select></label>
   <label>Professor(a)<select value={professorId} onChange={e=>filtrar('professorId',e.target.value)}><option value="">Todos os professores</option>{dados?.filtros.professores.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
   <button className="secondary-btn" onClick={()=>setParams(params.has('origem')?{origem:params.get('origem')!}:{})}>Limpar filtros</button>
  </div>
  {carregando&&<p role="status">Carregando fotos…</p>}
  {erro&&<p role="alert" className="error-text">{erro}</p>}
  {!carregando&&!erro&&dados&&<>
   <p role="status"><strong>{dados.total.toLocaleString('pt-BR')}</strong> foto(s) encontrada(s).</p>
   {!dados.fotos.length&&<p className="empty-state">Nenhuma foto encontrada para os filtros selecionados.</p>}
   <div className="cronograma-fotos-galeria fotos-admin-galeria">{dados.fotos.map(f=><figure key={f.id}>
    <ImagemAtividade caminho={f.arquivoUrl} nome={f.nome}/>
    <figcaption><strong>{f.escolaNome}</strong><span>Turma {f.turmaNome}</span><strong>Professor(a): {f.professorNome}</strong><span>{f.ordem}. {f.tema}</span><time dateTime={f.criadoEm}>Anexada em {new Date(f.criadoEm).toLocaleString('pt-BR',{timeZone:'America/Cuiaba'})}</time></figcaption>
   </figure>)}</div>
   {dados.totalPaginas>0&&<nav className="fotos-admin-paginacao" aria-label="Páginas de fotos">
    <button className="secondary-btn" disabled={dados.pagina<=1} onClick={()=>pagina(dados.pagina-1)}>Anterior</button>
    <span>Página {dados.pagina} de {dados.totalPaginas}</span>
    <button className="secondary-btn" disabled={dados.pagina>=dados.totalPaginas} onClick={()=>pagina(dados.pagina+1)}>Próxima</button>
   </nav>}
  </>}
 </div>
}
