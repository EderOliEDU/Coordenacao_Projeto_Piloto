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
