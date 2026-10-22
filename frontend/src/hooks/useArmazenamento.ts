import { useCallback, useEffect, useState } from 'react'
import api from '../api/client'
export interface Armazenamento {
 servidor:string; coletadoEm:string; completo:boolean; desatualizado:boolean; nivel:string;
 audios:{quantidade:number;bytes:number}; fotos:{quantidade:number;bytes:number}; outros:{quantidade:number;bytes:number};
 discos:{nome:string;caminho:string;total:number;disponivel:number;ocupado:number;percentual:number;inodesPercentual:number;nivel:string}[];
 alertas:{nivel:string;mensagem:string}[]
}
export default function useArmazenamento() {
 const [dados,setDados]=useState<Armazenamento|null>(null)
 const [erro,setErro]=useState('')
 const [carregando,setCarregando]=useState(true)
 const [revisao,setRevisao]=useState(0)
 const atualizar=useCallback(()=>setRevisao(v=>v+1),[])
 useEffect(()=>{
  let controller:AbortController|undefined
  const carregar=()=>{
   controller?.abort();controller=new AbortController()
   const atual=controller
   setCarregando(true)
   api.get<Armazenamento>('/superadmin/armazenamento',{signal:atual.signal,timeout:10000}).then(r=>{
    if(!atual.signal.aborted){setDados(r.data);setErro('')}
   }).catch(e=>{if(!atual.signal.aborted)setErro(e.response?.data?.error||'Não foi possível conferir o armazenamento de Produção.')})
   .finally(()=>{if(!atual.signal.aborted)setCarregando(false)})
  }
  carregar()
  const timer=window.setInterval(()=>{if(!document.hidden)carregar()},60000)
  return ()=>{controller?.abort();window.clearInterval(timer)}
 },[revisao])
 return {dados,erro,carregando,atualizar}
}
