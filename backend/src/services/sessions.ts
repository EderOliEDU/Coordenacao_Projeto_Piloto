import { getPgPool } from './pgPool'

function seconds(value: string | undefined, fallback: number) {
  const n = Number(value)
  return Number.isSafeInteger(n) && n > 0 ? n : fallback
}

export const sessionPolicy = {
  idleTimeoutSeconds: seconds(process.env.SESSION_IDLE_TIMEOUT_SECONDS, 30 * 60),
  presenceTimeoutSeconds: seconds(process.env.SESSION_PRESENCE_TIMEOUT_SECONDS, 120)
}

let structure: Promise<unknown> | undefined
export async function ensureSessionStructure() {
  if (!structure) {
    structure = getPgPool().query(`
      CREATE TABLE IF NOT EXISTS public.auth_sessoes (
        id uuid PRIMARY KEY,
        cpf_usuario text NOT NULL,
        criado_em timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ultima_atividade_em timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ultimo_sinal_em timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expira_em timestamptz NOT NULL,
        encerrada_em timestamptz
      );
      CREATE INDEX IF NOT EXISTS auth_sessoes_expira_idx ON public.auth_sessoes (expira_em);
    `).catch(error => { structure = undefined; throw error })
  }
  await structure
}

export async function registerSession(id: string, cpf: string, expiresAt: Date) {
  await ensureSessionStructure()
  await getPgPool().query(`INSERT INTO public.auth_sessoes (id, cpf_usuario, expira_em)
    VALUES ($1, $2, $3)`, [id, cpf, expiresAt])
}

export async function sessionIsActive(id: unknown, cpf: string) {
  if (typeof id !== 'string' || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) return false
  await ensureSessionStructure()
  const result = await getPgPool().query(`SELECT 1 FROM public.auth_sessoes
    WHERE id=$1 AND cpf_usuario=$2 AND encerrada_em IS NULL AND expira_em>CURRENT_TIMESTAMP
      AND ultima_atividade_em>CURRENT_TIMESTAMP-($3::int * INTERVAL '1 second')
      AND ultimo_sinal_em>CURRENT_TIMESTAMP-($4::int * INTERVAL '1 second')`,
  [id, cpf, sessionPolicy.idleTimeoutSeconds, sessionPolicy.presenceTimeoutSeconds])
  return Boolean(result.rowCount)
}

export async function heartbeatSession(id: string, cpf: string, activity: boolean) {
  const result = await getPgPool().query(`UPDATE public.auth_sessoes
    SET ultimo_sinal_em=CURRENT_TIMESTAMP,
      ultima_atividade_em=CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE ultima_atividade_em END
    WHERE id=$1 AND cpf_usuario=$2 AND encerrada_em IS NULL AND expira_em>CURRENT_TIMESTAMP
      AND ultima_atividade_em>CURRENT_TIMESTAMP-($4::int * INTERVAL '1 second')
      AND ultimo_sinal_em>CURRENT_TIMESTAMP-($5::int * INTERVAL '1 second')
    RETURNING id`, [id, cpf, activity, sessionPolicy.idleTimeoutSeconds, sessionPolicy.presenceTimeoutSeconds])
  return Boolean(result.rowCount)
}

export async function revokeSession(id: string, cpf: string) {
  await getPgPool().query(`UPDATE public.auth_sessoes SET encerrada_em=CURRENT_TIMESTAMP
    WHERE id=$1 AND cpf_usuario=$2 AND encerrada_em IS NULL`, [id, cpf])
}
