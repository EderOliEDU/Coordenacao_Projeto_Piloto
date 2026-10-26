import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { getPgPool } from './pgPool'

export const MAX_FOTO_BYTES = 8 * 1024 * 1024
export const CRONOGRAMA_FOTOS_SQL = `
CREATE TABLE IF NOT EXISTS public.cronograma_fotos (
 id_foto uuid PRIMARY KEY,
 id_turma integer NOT NULL REFERENCES public.turmas(id_turma) ON DELETE CASCADE,
 id_cronograma_aplicacao integer NOT NULL,
 cpf_professor text NOT NULL,
 arquivo text NOT NULL UNIQUE,
 nome_original text NOT NULL,
 mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
 tamanho integer NOT NULL CHECK (tamanho > 0 AND tamanho <= 8388608),
 criado_em timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cronograma_fotos_turma_item_idx
 ON public.cronograma_fotos(id_turma,id_cronograma_aplicacao,criado_em);
`

export function identificarFoto(data: Buffer) {
 if (data.length > MAX_FOTO_BYTES || data.length < 12) return null
 if (data.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]))) return { mime: 'image/jpeg', extensao: 'jpg' }
 if (data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { mime: 'image/png', extensao: 'png' }
 if (data.toString('ascii',0,4)==='RIFF' && data.toString('ascii',8,12)==='WEBP') return { mime: 'image/webp', extensao: 'webp' }
 return null
}

export function raizFotos() {
 return process.env.CRONOGRAMA_FOTOS_STORAGE_PATH || path.join(
  process.env.AUDIO_STORAGE_PATH || '/opt/projeto_piloto_app/data/audios', 'cronograma-fotos')
}
export function caminhoFoto(arquivo: string) {
 if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(arquivo)) throw new Error('Arquivo de foto inválido')
 return path.join(raizFotos(), arquivo)
}
export async function gravarFoto(data: Buffer, extensao: string) {
 const arquivo = `${randomUUID()}.${extensao}`
 await fs.mkdir(raizFotos(), { recursive: true })
 await fs.writeFile(caminhoFoto(arquivo), data, { flag: 'wx', mode: 0o640 })
 return arquivo
}

let inicializacao: Promise<unknown> | undefined
export async function garantirTabelaFotos() {
 if (!inicializacao) inicializacao = getPgPool().query(CRONOGRAMA_FOTOS_SQL).catch(error=>{
  inicializacao=undefined
  throw error
 })
 await inicializacao
}

export class FotoJaAnexadaError extends Error {}

export async function salvarFotoUnica(dados: { turmaId:number; itemId:number; cpf:string; buffer:Buffer; extensao:string; mime:string; nome:string }) {
 await garantirTabelaFotos()
 const client=await getPgPool().connect()
 let arquivo:string|undefined
 try {
  await client.query('BEGIN')
  // Serializa envios para o mesmo conteúdo, inclusive entre processos/instâncias.
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`cronograma-foto:${dados.turmaId}:${dados.itemId}`])
  const existente=await client.query('SELECT 1 FROM public.cronograma_fotos WHERE id_turma=$1 AND id_cronograma_aplicacao=$2 LIMIT 1',[dados.turmaId,dados.itemId])
  if(existente.rowCount)throw new FotoJaAnexadaError('Este conteúdo já possui foto. Exclua a foto atual antes de anexar outra.')
  arquivo=await gravarFoto(dados.buffer,dados.extensao)
  const {rows}=await client.query(`INSERT INTO public.cronograma_fotos
   (id_foto,id_turma,id_cronograma_aplicacao,cpf_professor,arquivo,nome_original,mime_type,tamanho)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
   RETURNING id_foto AS id,nome_original AS nome,tamanho,criado_em AS "criadoEm"`,
   [randomUUID(),dados.turmaId,dados.itemId,dados.cpf,arquivo,dados.nome.slice(0,255),dados.mime,dados.buffer.length])
  await client.query('COMMIT')
  return {...rows[0],podeExcluir:true}
 }catch(error){
  await client.query('ROLLBACK')
  if(arquivo)await fs.unlink(caminhoFoto(arquivo)).catch(()=>{})
  throw error
 }finally{client.release()}
}
