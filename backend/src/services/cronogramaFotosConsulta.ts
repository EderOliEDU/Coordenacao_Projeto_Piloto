import { getPgPool } from './pgPool'
import { garantirTabelaFotos } from './cronogramaFotos'
import { FOTO_AUTOR_JOIN,FOTO_AUTOR_NOME,FOTO_AUTOR_ID } from './cronogramaFotoAutor'
import { consultarCatalogoFotosProducao } from './cronogramaFotosProducao'

export interface FiltrosFotos { escolaId?:number; turmaId?:number; conteudoId?:number; professorId?:string; origem?:'local'|'producao'; pagina:number }
export async function consultarFotosAtividades(filtros:FiltrosFotos) {
 if(filtros.origem==='producao')return consultarCatalogoFotosProducao(filtros)
 await garantirTabelaFotos()
 const pool=getPgPool()
 const {escolaId=null,turmaId=null,conteudoId=null,professorId=null,pagina}=filtros
 const valores=[escolaId,turmaId,conteudoId,professorId]
 const contexto=`FROM public.cronograma_fotos f
  JOIN public.turmas t ON t.id_turma=f.id_turma
  JOIN public.escolas e ON e.id_escola=t.id_escola
  JOIN public.etapas et ON et.id_etapa=t.id_etapa
  JOIN LATERAL (SELECT tema,ordem FROM public.cronograma_aplicacao
   WHERE id_cronograma_aplicacao=f.id_cronograma_aplicacao AND id_etapa=t.id_etapa AND ordem IS NOT NULL
   ORDER BY ordem,tema LIMIT 1) ca ON true
  ${FOTO_AUTOR_JOIN}
  WHERE e.projeto='PJINSTFONI' AND et.projeto='PJINSTFONI'
  AND ($1::int IS NULL OR e.id_escola=$1) AND ($2::int IS NULL OR t.id_turma=$2)
  AND ($3::int IS NULL OR f.id_cronograma_aplicacao=$3)
  AND ($4::text IS NULL OR ${FOTO_AUTOR_ID}=$4)`
 const escolas=await pool.query(`SELECT id_escola::text AS id,nome_escola AS nome FROM public.escolas
  WHERE projeto='PJINSTFONI' ORDER BY nome_escola,id_escola`)
 const turmas=await pool.query(`SELECT t.id_turma::text AS id,
  concat(et.descricao,' ',COALESCE(NULLIF(t.letra_turma,''),t.id_turma::text)) AS nome,e.nome_escola AS "escolaNome"
  FROM public.turmas t JOIN public.escolas e USING(id_escola) JOIN public.etapas et ON et.id_etapa=t.id_etapa
  WHERE e.projeto='PJINSTFONI' AND et.projeto='PJINSTFONI' AND ($1::int IS NULL OR e.id_escola=$1)
  ORDER BY e.nome_escola,et.descricao,t.letra_turma,t.id_turma`,[escolaId])
 const conteudos=await pool.query(`SELECT DISTINCT ca.id_cronograma_aplicacao::text AS id,ca.tema,ca.ordem,et.descricao AS etapa
  FROM public.cronograma_aplicacao ca JOIN public.etapas et ON et.id_etapa=ca.id_etapa
  JOIN public.turmas t ON t.id_etapa=et.id_etapa JOIN public.escolas e USING(id_escola)
  WHERE e.projeto='PJINSTFONI' AND et.projeto='PJINSTFONI' AND ca.ordem IS NOT NULL
  AND ($1::int IS NULL OR e.id_escola=$1) AND ($2::int IS NULL OR t.id_turma=$2)
  ORDER BY etapa,ordem,tema,id`,[escolaId,turmaId])
 const professores=await pool.query(`SELECT DISTINCT ${FOTO_AUTOR_ID} AS id,${FOTO_AUTOR_NOME} AS nome ${contexto} ORDER BY nome,id`,[escolaId,turmaId,conteudoId,null])
 const total=Number((await pool.query(`SELECT count(*) AS total ${contexto}`,valores)).rows[0].total)
 const porPagina=12
 const fotos=await pool.query(`SELECT ${FOTO_AUTOR_ID} AS "professorId",${FOTO_AUTOR_NOME} AS "professorNome",e.id_escola::text AS "escolaId",f.id_foto AS id,f.nome_original AS nome,f.criado_em AS "criadoEm",
  f.id_turma::text AS "turmaId",f.id_cronograma_aplicacao::text AS "conteudoId",e.nome_escola AS "escolaNome",
  concat(et.descricao,' ',COALESCE(NULLIF(t.letra_turma,''),t.id_turma::text)) AS "turmaNome",ca.tema,ca.ordem
  ${contexto} ORDER BY f.criado_em DESC,f.id_foto LIMIT $5 OFFSET $6`,[...valores,porPagina,(pagina-1)*porPagina])
 return {filtros:{escolas:escolas.rows,turmas:turmas.rows,conteudos:conteudos.rows,professores:professores.rows},fotos:fotos.rows.map(f=>({...f,arquivoUrl:`/cronogramas/${f.turmaId}/itens/${f.conteudoId}/fotos/${f.id}/arquivo`})),origem:'local' as const,producaoDisponivel:Boolean(process.env.AUDIO_READONLY_STORAGE_PATH),
  total,pagina,porPagina,totalPaginas:Math.ceil(total/porPagina)}
}
