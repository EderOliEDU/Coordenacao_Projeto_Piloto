import { Router, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { getPgPool } from '../services/pgPool'
import { isSuperadmin, normalizarCpf } from '../services/permissions'

const router = Router()
const pool = getPgPool()

interface ProfessorAdmin {
  cpf: string
  nome: string
  nomeSocial: string | null
  email: string | null
  corporativoEmail: string | null
  senhaConfigurada: boolean
}

function requireSuperadmin(req: AuthRequest, res: Response, next: NextFunction) {
  const cpf = req.professor?.cpf || req.professor?.login || ''
  if (!isSuperadmin(cpf)) {
    return res.status(403).json({ error: 'Acesso restrito ao superadministrador' })
  }
  next()
}

function normalizeSearchTerm(value: unknown) {
  return String(value || '').trim()
}

async function getProfessorEmailColumns() {
  const result = await pool.query<{ column_name: string }>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'professores'
        AND column_name = ANY($1::text[])`,
    [['profissional_e_mail', 'Corporativo_e_mail']]
  )

  const columns = new Set(result.rows.map((row) => row.column_name))
  return {
    profissionalEmail: columns.has('profissional_e_mail') ? 'profissional_e_mail' : null,
    corporativoEmail: columns.has('Corporativo_e_mail') ? '"Corporativo_e_mail"' : null,
  }
}

router.use(authMiddleware, requireSuperadmin)

router.get('/professores', async (req: AuthRequest, res: Response) => {
  const termo = normalizeSearchTerm(req.query.q)
  if (termo.length < 2) {
    return res.json([])
  }

  const cpfTermo = normalizarCpf(termo)
  const emails = await getProfessorEmailColumns()
  const emailSelect = emails.profissionalEmail ? 'profissional_e_mail::text' : 'NULL::text'
  const corporativoSelect = emails.corporativoEmail ? `${emails.corporativoEmail}::text` : 'NULL::text'
  const emailFilters = [
    emails.profissionalEmail ? 'lower(COALESCE(profissional_e_mail::text, \'\')) LIKE lower($1)' : null,
    emails.corporativoEmail ? `lower(COALESCE(${emails.corporativoEmail}::text, '')) LIKE lower($1)` : null,
  ].filter(Boolean)
  const cpfFilter = cpfTermo ? 'OR regexp_replace(profissional_cpf::text, \'\\D\', \'\', \'g\') LIKE $2' : ''

  const query = `
    SELECT
      regexp_replace(profissional_cpf::text, '\\D', '', 'g') AS cpf,
      COALESCE(NULLIF(trim(profissional_nome::text), ''), '') AS nome,
      NULLIF(trim(COALESCE(profissional_nome_social::text, '')), '') AS "nomeSocial",
      ${emailSelect} AS email,
      ${corporativoSelect} AS "corporativoEmail",
      senha IS NOT NULL AND trim(senha::text) <> '' AS "senhaConfigurada"
    FROM public.professores
    WHERE
      lower(COALESCE(profissional_nome::text, '')) LIKE lower($1)
      OR lower(COALESCE(profissional_nome_social::text, '')) LIKE lower($1)
      ${cpfFilter}
      ${emailFilters.length ? `OR ${emailFilters.join(' OR ')}` : ''}
    ORDER BY profissional_nome
    LIMIT 50
  `

  const params = cpfTermo ? [`%${termo}%`, `%${cpfTermo}%`] : [`%${termo}%`]
  const result = await pool.query<ProfessorAdmin>(query, params)
  res.json(result.rows)
})

router.post('/professores/resetar-senha', async (req: AuthRequest, res: Response) => {
  const cpf = normalizarCpf(req.body?.cpf)
  if (cpf.length !== 11) {
    return res.status(400).json({ error: 'Informe um CPF válido' })
  }

  const result = await pool.query(
    `UPDATE public.professores
        SET senha = NULL
      WHERE regexp_replace(profissional_cpf::text, '\\D', '', 'g') = $1
      RETURNING regexp_replace(profissional_cpf::text, '\\D', '', 'g') AS cpf`,
    [cpf]
  )

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Professor não encontrado' })
  }

  res.json({ ok: true, cpf })
})

router.post('/professores/alterar-senha', async (req: AuthRequest, res: Response) => {
  const cpf = normalizarCpf(req.body?.cpf)
  const senha = String(req.body?.senha || '')
  if (cpf.length !== 11) {
    return res.status(400).json({ error: 'Informe um CPF válido' })
  }
  if (senha.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' })
  }

  const senhaHash = await bcrypt.hash(senha, 10)
  const result = await pool.query(
    `UPDATE public.professores
        SET senha = $2
      WHERE regexp_replace(profissional_cpf::text, '\\D', '', 'g') = $1
      RETURNING regexp_replace(profissional_cpf::text, '\\D', '', 'g') AS cpf`,
    [cpf, senhaHash]
  )

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Professor não encontrado' })
  }

  res.json({ ok: true, cpf })
})

export default router
