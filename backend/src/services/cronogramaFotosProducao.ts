import { promises as fs } from 'fs'
import path from 'path'
import { z } from 'zod'
import type { FiltrosFotos } from './cronogramaFotosConsulta'
import { resolveAudioPath } from './audioStorage'
const fotoSchema=z.object({id:z.string().uuid(),nome:z.string(),criadoEm:z.string(),arquivo:z.string().regex(/^[0-9a-f-]{36}\.(jpg|png|webp)$/),mimeType:z.enum(['image/jpeg','image/png','image/webp']),turmaId:z.string(),escolaId:z.string(),conteudoId:z.string(),escolaNome:z.string(),turmaNome:z.string(),tema:z.string(),ordem:z.number(),professorId:z.string().regex(/^[a-f0-9]{32}$/),professorNome:z.string()})
const catalogoSchema=z.object({versao:z.literal(1),servidor:z.literal('192.168.0.121'),coletadoEm:z.string().datetime({offset:true}),fotos:z.array(fotoSchema)})
export async function lerCatalogoFotosProducao(){
 const root=process.env.AUDIO_READONLY_STORAGE_PATH
 if(!root)throw Error('Consulta de Produção indisponível neste ambiente')
 const arquivo=path.join(root,'.monitoramento/cronograma-fotos.json')
 if((await fs.stat(arquivo)).size>64*1024*1024)throw Error('Catálogo de fotos inválido')
 const catalogo=catalogoSchema.parse(JSON.parse(await fs.readFile(arquivo,'utf8')))
 if(Date.parse(catalogo.coletadoEm)>Date.now()+300000)throw Error('Data do catálogo inválida')
 return catalogo
}
export async function consultarCatalogoFotosProducao(filtros:FiltrosFotos){
 const catalogo=await lerCatalogoFotosProducao()
 const contexto=catalogo.fotos.filter(f=>(!filtros.escolaId||f.escolaId===String(filtros.escolaId))&&(!filtros.turmaId||f.turmaId===String(filtros.turmaId))&&(!filtros.conteudoId||f.conteudoId===String(filtros.conteudoId)))
 const fotos=contexto.filter(f=>!filtros.professorId||f.professorId===filtros.professorId).sort((a,b)=>b.criadoEm.localeCompare(a.criadoEm)||a.id.localeCompare(b.id))
 const unicos=<T extends {id:string}>(itens:T[])=>Array.from(new Map(itens.map(i=>[i.id,i])).values())
 const escolas=unicos(catalogo.fotos.map(f=>({id:f.escolaId,nome:f.escolaNome}))).sort((a,b)=>a.nome.localeCompare(b.nome))
 const turmas=unicos(catalogo.fotos.filter(f=>!filtros.escolaId||f.escolaId===String(filtros.escolaId)).map(f=>({id:f.turmaId,nome:f.turmaNome,escolaNome:f.escolaNome}))).sort((a,b)=>a.nome.localeCompare(b.nome))
 const conteudos=unicos(catalogo.fotos.filter(f=>(!filtros.escolaId||f.escolaId===String(filtros.escolaId))&&(!filtros.turmaId||f.turmaId===String(filtros.turmaId))).map(f=>({id:f.conteudoId,tema:f.tema,ordem:f.ordem,etapa:''}))).sort((a,b)=>a.ordem-b.ordem)
 const professores=unicos(contexto.map(f=>({id:f.professorId,nome:f.professorNome}))).sort((a,b)=>a.nome.localeCompare(b.nome))
 const porPagina=12,total=fotos.length
 return {filtros:{escolas,turmas,conteudos,professores},fotos:fotos.slice((filtros.pagina-1)*porPagina,filtros.pagina*porPagina).map(({arquivo,mimeType,...f})=>({...f,arquivoUrl:`/cronogramas/administracao/fotos-producao/${f.id}/arquivo`})),total,pagina:filtros.pagina,porPagina,totalPaginas:Math.ceil(total/porPagina),origem:'producao' as const,producaoDisponivel:true,coletadoEm:catalogo.coletadoEm,desatualizado:Date.now()-Date.parse(catalogo.coletadoEm)>15*60000}
}
export async function arquivoFotoProducao(id:string){
 const catalogo=await lerCatalogoFotosProducao()
 const foto=catalogo.fotos.find(f=>f.id===id)
 if(!foto)return null
 return {caminho:resolveAudioPath(path.join(process.env.AUDIO_READONLY_STORAGE_PATH!,'cronograma-fotos'),foto.arquivo),mime:foto.mimeType}
}
