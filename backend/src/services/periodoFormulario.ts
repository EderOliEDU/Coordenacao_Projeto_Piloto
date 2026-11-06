import type { PoolClient } from 'pg'
import { getPgPool } from './pgPool'

export async function consultarPeriodoFormulario(db:Pick<PoolClient,'query'>=getPgPool(), bloquearFase=false) {
 const result=await db.query(`SELECT id_fase AS id,nome,data_inicio::text AS "dataInicio",data_fim::text AS "dataFim"
  FROM public.avaliacao_fases
  WHERE ativo AND (statement_timestamp() AT TIME ZONE 'America/Cuiaba')::date BETWEEN data_inicio AND data_fim
  ORDER BY data_inicio DESC,ordem DESC,id_fase DESC LIMIT 1 ${bloquearFase?'FOR SHARE':''}`)
 const fase=result.rows[0]||null
 return {aberto:Boolean(fase),fase,mensagem:fase?`Preenchimento liberado na fase ${fase.nome}.`:'Formulário bloqueado: não há fase ativa dentro do prazo para preenchimento.'}
}
