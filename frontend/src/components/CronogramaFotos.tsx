import { useEffect, useRef, useState } from 'react'
import api from '../api/client'

type Foto = { id: string; nome: string; criadoEm: string; podeExcluir: boolean }
function ImagemAtividade({ caminho, nome }: { caminho: string; nome: string }) {
 const [url,setUrl] = useState('')
 const [erro,setErro] = useState(false)
 useEffect(()=>{
  const controller=new AbortController()
  let objectUrl=''
  setErro(false)
  api.get(caminho,{responseType:'blob',signal:controller.signal}).then(r=>{
   if(controller.signal.aborted) return
   objectUrl=URL.createObjectURL(r.data)
   setUrl(objectUrl)
  }).catch(()=>{if(!controller.signal.aborted)setErro(true)})
  return ()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl)}
 },[caminho])
 if(erro)return <span className="error-text">Não foi possível abrir esta foto.</span>
 if(!url)return <span>Carregando foto…</span>
 return <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Ampliar foto: ${nome}`}><img src={url} alt={nome} /></a>
}
export default function CronogramaFotos({turmaId,itemId,readOnly}:{turmaId:string;itemId:string;readOnly:boolean}) {
 const [aberto,setAberto]=useState(false)
 const [fotos,setFotos]=useState<Foto[]>([])
 const [carregando,setCarregando]=useState(false)
 const [ocupado,setOcupado]=useState(false)
 const [erro,setErro]=useState('')
 const [mensagem,setMensagem]=useState('')
 const input=useRef<HTMLInputElement>(null)
 const caminho=`/cronogramas/${turmaId}/itens/${itemId}/fotos`
 useEffect(()=>{
  if(!aberto)return
  const controller=new AbortController()
  setCarregando(true);setErro('')
  api.get(caminho,{signal:controller.signal}).then(r=>setFotos(r.data.fotos)).catch(e=>{
   if(!controller.signal.aborted)setErro(e.response?.data?.error||'Não foi possível carregar as fotos.')
  }).finally(()=>{if(!controller.signal.aborted)setCarregando(false)})
  return ()=>controller.abort()
 },[aberto,caminho])
 async function enviar(files:FileList|null){
  if(!files?.length||readOnly||ocupado||carregando)return
  setErro('');setMensagem('')
  if(files.length!==1||fotos.length){setErro('É permitida apenas uma foto por conteúdo. Exclua a foto atual antes de anexar outra.');return}
  const foto=files[0]
  if(foto.size>8*1024*1024||!['image/jpeg','image/png','image/webp'].includes(foto.type)){
   setErro('Use uma foto JPG, PNG ou WebP, até 8 MB.');if(input.current)input.current.value='';return
  }
  setOcupado(true)
  try {
   const form=new FormData();form.append('foto',foto)
   const r=await api.post(caminho,form)
   setFotos([r.data]);setMensagem('Foto anexada com sucesso.')
  }catch(e:any){
   setErro(e.response?.data?.error||'Falha no envio. Tente novamente.')
   if(e.response?.status===409){
    try{const r=await api.get(caminho);setFotos(r.data.fotos)}catch{/* Mantém o erro de envio visível. */}
   }
  }finally{setOcupado(false);if(input.current)input.current.value=''}
 }
 async function excluir(foto:Foto){
  if(readOnly||ocupado||!window.confirm('Excluir esta foto da atividade?'))return
  setOcupado(true);setErro('');setMensagem('')
  try{await api.delete(`${caminho}/${foto.id}`);setFotos(atuais=>atuais.filter(f=>f.id!==foto.id));setMensagem('Foto excluída.')}
  catch(e:any){setErro(e.response?.data?.error||'Não foi possível excluir a foto.')}
  finally{setOcupado(false)}
 }
 return <div className="cronograma-fotos">
  <button type="button" className="secondary-btn" aria-expanded={aberto} aria-controls={`fotos-${itemId}`} disabled={ocupado} onClick={()=>setAberto(!aberto)}>
   {aberto?'Ocultar fotos':'Fotos das atividades'}
  </button>
  {aberto&&<div id={`fotos-${itemId}`} className="cronograma-fotos-painel">
   <p>É permitida uma foto por conteúdo apresentado da turma. JPG, PNG ou WebP, até 8 MB.</p>
   {!readOnly&&<>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={ocupado||carregando||fotos.length>0} onChange={e=>enviar(e.target.files)} />
    <button type="button" className="primary-btn" disabled={ocupado||carregando||fotos.length>0} onClick={()=>input.current?.click()}>{ocupado?'Aguarde…':'Anexar foto'}</button>
   </>}
   {!readOnly&&fotos.length>0&&<p>Para anexar outra foto, exclua a atual primeiro.</p>}
   {carregando&&<p role="status">Carregando fotos…</p>}
   {erro&&<p role="alert" className="error-text">{erro}</p>}
   {mensagem&&<p role="status" className="success-text">{mensagem}</p>}
   {!carregando&&!erro&&!fotos.length&&<p>Nenhuma foto anexada a este conteúdo.</p>}
   <div className="cronograma-fotos-galeria">{fotos.map(foto=><figure key={foto.id}>
    <ImagemAtividade caminho={`${caminho}/${foto.id}/arquivo`} nome={foto.nome}/>
    <figcaption><span>{foto.nome}</span><time dateTime={foto.criadoEm}>{new Date(foto.criadoEm).toLocaleDateString('pt-BR')}</time></figcaption>
    {!readOnly&&foto.podeExcluir&&<button type="button" className="secondary-btn" disabled={ocupado} onClick={()=>excluir(foto)}>Excluir foto</button>}
   </figure>)}</div>
  </div>}
 </div>
}
