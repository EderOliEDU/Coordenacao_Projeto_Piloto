import { Router, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { getPgPool } from '../services/pgPool'
import { ensureUsuariosAcessosTable, isAdministrador, isSuperadmin, normalizarCpf, PerfilAcesso, usuarioTemPerfil } from '../services/permissions'
import { syncAtribuicoesFromDesignacoes } from '../services/syncAtribuicoesDesignacoes'
import { ensureAvaliacaoFasesStructure } from '../services/avaliacaoFases'

const router = Router()
const pool = getPgPool()
const EMAIL_CORPORATIVO_DOMINIO = '@edu.rondonopolis.mt.gov.br'

interface ProfessorAdmin {
  cpf: string
  nome: string
  nomeSocial: string | null
  email: string | null
  corporativoEmail: string | null
  senhaConfigurada: boolean
}

interface TurmaAdmin {
  id: string
  nome: string
  escolaId: string
  escolaNome: string
  etapaDescricao: string | null
  turno: string | null
}

interface AtribuicaoProfessorAdmin {
  cpf: string
  nome: string | null
  turmaId: string
  turmaNome: string
  escolaId: string
  escolaNome: string
  etapaDescricao: string | null
  turno: string | null
}

interface AlunoAdmin {
  id: string
  nome: string
  cpf: string | null
  inep: string | null
  situacao: string | null
}

interface EnturmacaoAlunoAdmin {
  alunoId: string
  alunoNome: string | null
  turmaId: string
  turmaNome: string
  escolaId: string
  escolaNome: string
  etapaDescricao: string | null
  turno: string | null
}

interface UsuarioAcessoAdmin {
  id: string
  cpf: string
  nome: string | null
  perfil: PerfilAcesso
  escolaId: string | null
  escolaNome: string | null
  ativo: boolean
}

interface AvaliacaoFaseAdmin {
  id: string
  nome: string
  dataInicio: string
  dataFim: string
  ativa: boolean
  ordem: number
  descricao: string | null
}

const PERFIS_ACESSO = new Set(['SUPERADMIN', 'ADMINISTRADOR', 'COORDENADOR', 'DIRETOR', 'APLICADOR'])

async function requireSuperadmin(req: AuthRequest, res: Response, next: NextFunction) {
  const cpf = req.professor?.cpf || req.professor?.login || ''
  const allowed = Boolean(req.professor?.permissoes?.superadmin) || isSuperadmin(cpf) || await usuarioTemPerfil(cpf, ['SUPERADMIN'])
  if (!allowed) {
    return res.status(403).json({ error: 'Acesso restrito ao superadministrador' })
  }
  next()
}

async function requireAdministrador(req: AuthRequest, res: Response, next: NextFunction) {
  const cpf = req.professor?.cpf || req.professor?.login || ''
  const allowed = Boolean(req.professor?.permissoes?.administrador)
    || isAdministrador(cpf)
    || await usuarioTemPerfil(cpf, ['SUPERADMIN', 'ADMINISTRADOR'])
  if (!allowed) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador' })
  }
  next()
}

function normalizeSearchTerm(value: unknown) {
  return String(value || '').trim()
}

function normalizeEmailAccount(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

async function getProfessorEmailColumns() {
  const result = await pool.query<{ column_name: string }>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'professores'
        AND column_name = ANY($1::text[])`,
    [['profissional_e_mail', 'corporativo_e_mail', 'Corporativo_e_mail']]
  )

  const columns = new Set(result.rows.map((row) => row.column_name))
  const corporativoEmail = columns.has('corporativo_e_mail')
    ? 'corporativo_e_mail'
    : columns.has('Corporativo_e_mail')
      ? '"Corporativo_e_mail"'
      : null

  return {
    profissionalEmail: columns.has('profissional_e_mail') ? 'profissional_e_mail' : null,
    corporativoEmail,
  }
}

router.use(authMiddleware)

router.get('/escolas', requireAdministrador, async (_req: AuthRequest, res: Response) => {
  const result = await pool.query(
    `
    SELECT id_escola::text AS id, nome_escola::text AS nome
    FROM public.escolas
    WHERE projeto = 'PJINSTFONI'
    ORDER BY nome_escola NULLS LAST
    `
  )

  res.json(result.rows)
})

router.get('/turmas', requireAdministrador, async (_req: AuthRequest, res: Response) => {
  const result = await pool.query<TurmaAdmin>(
    `
    SELECT
      t.id_turma::text AS id,
      ('Turma ' || COALESCE(NULLIF(et.descricao::text, ''), 'Etapa nao informada') || ' ' || COALESCE(NULLIF(t.letra_turma::text, ''), t.id_turma::text))::text AS nome,
      e.id_escola::text AS "escolaId",
      e.nome_escola::text AS "escolaNome",
      et.descricao::text AS "etapaDescricao",
      t.turno::text AS turno
    FROM public.turmas t
    JOIN public.escolas e ON e.id_escola = t.id_escola
    JOIN public.etapas et ON et.id_etapa = t.id_etapa
    WHERE e.projeto = 'PJINSTFONI'
      AND et.projeto = 'PJINSTFONI'
    ORDER BY e.nome_escola NULLS LAST, et.descricao NULLS LAST, t.letra_turma NULLS LAST, t.id_turma
    `
  )

  res.json(result.rows)
})

router.get('/avaliacao-fases', requireAdministrador, async (_req: AuthRequest, res: Response) => {
  await ensureAvaliacaoFasesStructure()
  const result = await pool.query<AvaliacaoFaseAdmin>(
    `
    SELECT
      id_fase::text AS id,
      nome,
      data_inicio::text AS "dataInicio",
      data_fim::text AS "dataFim",
      ativo AS ativa,
      ordem,
      descricao
    FROM public.avaliacao_fases
    ORDER BY ordem, data_inicio, id_fase
    `
  )

  res.json(result.rows)
})

router.post('/avaliacao-fases', requireSuperadmin, async (req: AuthRequest, res: Response) => {
  await ensureAvaliacaoFasesStructure()
  const nome = normalizeSearchTerm(req.body?.nome)
  const dataInicio = normalizeSearchTerm(req.body?.dataInicio)
  const dataFim = normalizeSearchTerm(req.body?.dataFim)
  const ordem = Number(req.body?.ordem) || 1
  const descricao = normalizeSearchTerm(req.body?.descricao) || null
  const ativa = req.body?.ativa !== false

  if (!nome) return res.status(400).json({ error: 'Informe o nome da fase' })
  if (!dataInicio || !dataFim) return res.status(400).json({ error: 'Informe o periodo da fase' })

  const result = await pool.query<{ id: string }>(
    `
    INSERT INTO public.avaliacao_fases (nome, data_inicio, data_fim, ativo, ordem, descricao)
    VALUES ($1, $2::date, $3::date, $4, $5, $6)
    RETURNING id_fase::text AS id
    `,
    [nome, dataInicio, dataFim, ativa, ordem, descricao]
  )

  res.json({ ok: true, id: result.rows[0].id })
})

router.patch('/avaliacao-fases/:id', requireSuperadmin, async (req: AuthRequest, res: Response) => {
  await ensureAvaliacaoFasesStructure()
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'Fase invalida' })

  const fields: string[] = []
  const values: any[] = []

  function add(field: string, value: any, cast = '') {
    values.push(value)
    fields.push(`${field} = $${values.length}${cast}`)
  }

  if (req.body?.nome !== undefined) add('nome', normalizeSearchTerm(req.body.nome))
  if (req.body?.dataInicio !== undefined) add('data_inicio', normalizeSearchTerm(req.body.dataInicio), '::date')
  if (req.body?.dataFim !== undefined) add('data_fim', normalizeSearchTerm(req.body.dataFim), '::date')
  if (req.body?.ativa !== undefined) add('ativo', Boolean(req.body.ativa))
  if (req.body?.ordem !== undefined) add('ordem', Number(req.body.ordem) || 1)
  if (req.body?.descricao !== undefined) add('descricao', normalizeSearchTerm(req.body.descricao) || null)

  if (fields.length === 0) return res.status(400).json({ error: 'Nada para atualizar' })

  values.push(id)
  const result = await pool.query(
    `
    UPDATE public.avaliacao_fases
    SET ${fields.join(', ')}, atualizada_em = CURRENT_TIMESTAMP
    WHERE id_fase = $${values.length}
    `,
    values
  )

  if (result.rowCount === 0) return res.status(404).json({ error: 'Fase nao encontrada' })
  res.json({ ok: true })
})

router.delete('/avaliacao-fases/:id', requireSuperadmin, async (req: AuthRequest, res: Response) => {
  await ensureAvaliacaoFasesStructure()
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'Fase invalida' })

  const uso = await pool.query<{ total: string }>(
    `
    SELECT (
      (SELECT COUNT(*) FROM public.submissoes_pg WHERE id_fase = $1) +
      (SELECT COUNT(*) FROM public.avaliacao_respostas WHERE id_fase = $1) +
      (SELECT COUNT(*) FROM public.aluno_necessidades_contexto WHERE id_fase = $1) +
      (SELECT COUNT(*) FROM public.aluno_necessidades_especificas WHERE id_fase = $1)
    )::text AS total
    `,
    [id]
  )

  if (Number(uso.rows[0]?.total || 0) > 0) {
    return res.status(409).json({ error: 'Esta fase ja possui registros vinculados. Desative a fase em vez de excluir.' })
  }

  const result = await pool.query(
    `DELETE FROM public.avaliacao_fases WHERE id_fase = $1`,
    [id]
  )

  if (result.rowCount === 0) return res.status(404).json({ error: 'Fase nao encontrada' })
  res.json({ ok: true })
})

router.get('/professores/:cpf/atribuicoes', requireAdministrador, async (req: AuthRequest, res: Response) => {
  const cpf = normalizarCpf(req.params.cpf)
  if (cpf.length !== 11) {
    return res.status(400).json({ error: 'CPF invalido' })
  }

  const result = await pool.query<AtribuicaoProfessorAdmin>(
    `
    SELECT DISTINCT
      regexp_replace(ap.cpf_professor::text, '\\D', '', 'g') AS cpf,
      COALESCE(NULLIF(trim(p.profissional_nome_social::text), ''), NULLIF(trim(p.profissional_nome::text), '')) AS nome,
      t.id_turma::text AS "turmaId",
      ('Turma ' || COALESCE(NULLIF(et.descricao::text, ''), 'Etapa nao informada') || ' ' || COALESCE(NULLIF(t.letra_turma::text, ''), t.id_turma::text))::text AS "turmaNome",
      e.id_escola::text AS "escolaId",
      e.nome_escola::text AS "escolaNome",
      et.descricao::text AS "etapaDescricao",
      t.turno::text AS turno
    FROM public.atribuicao_professor ap
    JOIN public.turmas t ON t.id_turma = ap.id_turma
    JOIN public.escolas e ON e.id_escola = t.id_escola
    JOIN public.etapas et ON et.id_etapa = t.id_etapa
    LEFT JOIN public.professores p
      ON regexp_replace(p.profissional_cpf::text, '\\D', '', 'g') = regexp_replace(ap.cpf_professor::text, '\\D', '', 'g')
    WHERE regexp_replace(ap.cpf_professor::text, '\\D', '', 'g') = $1
      AND e.projeto = 'PJINSTFONI'
      AND et.projeto = 'PJINSTFONI'
    ORDER BY e.nome_escola NULLS LAST, et.descricao NULLS LAST, "turmaNome"
    `,
    [cpf]
  )

  res.json(result.rows)
})

router.post('/professores/:cpf/atribuicoes', requireSuperadmin, async (req: AuthRequest, res: Response) => {
  const cpf = normalizarCpf(req.params.cpf)
  const turmaId = Number(req.body?.turmaId)

  if (cpf.length !== 11) {
    return res.status(400).json({ error: 'CPF invalido' })
  }
  if (!turmaId) {
    return res.status(400).json({ error: 'Informe a turma' })
  }

  const professorRes = await pool.query(
    `SELECT 1 FROM public.professores WHERE regexp_replace(profissional_cpf::text, '\\D', '', 'g') = $1 LIMIT 1`,
    [cpf]
  )
  if (professorRes.rowCount === 0) {
    return res.status(404).json({ error: 'Professor nao encontrado' })
  }

  const turmaRes = await pool.query(
    `
    SELECT 1
    FROM public.turmas t
    JOIN public.escolas e ON e.id_escola = t.id_escola
    JOIN public.etapas et ON et.id_etapa = t.id_etapa
    WHERE t.id_turma = $1
      AND e.projeto = 'PJINSTFONI'
      AND et.projeto = 'PJINSTFONI'
    LIMIT 1
    `,
    [turmaId]
  )
  if (turmaRes.rowCount === 0) {
    return res.status(404).json({ error: 'Turma nao encontrada' })
  }

  await pool.query(
    `
    INSERT INTO public.atribuicao_professor (cpf_professor, id_turma)
    SELECT $1::varchar, $2::integer
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.atribuicao_professor
      WHERE regexp_replace(cpf_professor::text, '\\D', '', 'g') = $1::text
        AND id_turma = $2::integer
    )
    `,
    [cpf, turmaId]
  )

  res.json({ ok: true })
})

router.delete('/professores/:cpf/atribuicoes/:turmaId', requireSuperadmin, async (req: AuthRequest, res: Response) => {
  const cpf = normalizarCpf(req.params.cpf)
  const turmaId = Number(req.params.turmaId)

  if (cpf.length !== 11 || !turmaId) {
    return res.status(400).json({ error: 'Atribuicao invalida' })
  }

  await pool.query(
    `
    DELETE FROM public.atribuicao_professor
    WHERE regexp_replace(cpf_professor::text, '\\D', '', 'g') = $1
      AND id_turma = $2
    `,
    [cpf, turmaId]
  )

  res.json({ ok: true })
})

router.get('/professores', requireAdministrador, async (req: AuthRequest, res: Response) => {
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

router.post('/professores', requireSuperadmin, async (req: AuthRequest, res: Response) => {
  const cpf = normalizarCpf(req.body?.cpf)
  const nome = normalizeSearchTerm(req.body?.nome)
  const nomeSocial = normalizeSearchTerm(req.body?.nomeSocial) || null
  const email = normalizeSearchTerm(req.body?.email) || null
  const corporativoEmail = normalizeSearchTerm(req.body?.corporativoEmail) || null

  if (cpf.length !== 11) {
    return res.status(400).json({ error: 'Informe um CPF valido' })
  }
  if (!nome) {
    return res.status(400).json({ error: 'Informe o nome do professor' })
  }

  const emails = await getProfessorEmailColumns()
  const columns = ['profissional_cpf', 'profissional_nome', 'profissional_nome_social']
  const values: any[] = [cpf, nome, nomeSocial]
  const placeholders = ['$1', '$2', '$3']
  const updates = [
    'profissional_nome = EXCLUDED.profissional_nome',
    'profissional_nome_social = EXCLUDED.profissional_nome_social',
  ]

  if (emails.profissionalEmail) {
    columns.push('profissional_e_mail')
    values.push(email)
    placeholders.push(`$${values.length}`)
    updates.push('profissional_e_mail = EXCLUDED.profissional_e_mail')
  }

  if (emails.corporativoEmail) {
    columns.push(emails.corporativoEmail)
    values.push(corporativoEmail)
    placeholders.push(`$${values.length}`)
    updates.push(`${emails.corporativoEmail} = EXCLUDED.${emails.corporativoEmail}`)
  }

  await pool.query(
    `
    INSERT INTO public.professores (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (profissional_cpf)
    DO UPDATE SET ${updates.join(', ')}
    `,
    values
  )

  res.json({ ok: true, cpf })
})

router.post('/alunos', requireSuperadmin, async (req: AuthRequest, res: Response) => {
  const nome = normalizeSearchTerm(req.body?.nome)
  const cpf = normalizarCpf(req.body?.cpf) || null
  const inep = normalizeSearchTerm(req.body?.inep) || null
  const situacao = normalizeSearchTerm(req.body?.situacao) || 'ATIVO'
  const turmaId = Number(req.body?.turmaId)

  if (!nome) {
    return res.status(400).json({ error: 'Informe o nome do aluno' })
  }
  if (cpf && cpf.length !== 11) {
    return res.status(400).json({ error: 'CPF do aluno invalido' })
  }
  if (!turmaId) {
    return res.status(400).json({ error: 'Informe a turma do aluno' })
  }

  const turmaRes = await pool.query<{
    escola_nome: string | null
    etapa_descricao: string | null
    turma_nome: string | null
    turno: string | null
  }>(
    `
    SELECT
      e.nome_escola::text AS escola_nome,
      et.descricao::text AS etapa_descricao,
      COALESCE(NULLIF(t.letra_turma::text, ''), t.id_turma::text) AS turma_nome,
      t.turno::text AS turno
    FROM public.turmas t
    JOIN public.escolas e ON e.id_escola = t.id_escola
    JOIN public.etapas et ON et.id_etapa = t.id_etapa
    WHERE t.id_turma = $1
      AND e.projeto = 'PJINSTFONI'
      AND et.projeto = 'PJINSTFONI'
    LIMIT 1
    `,
    [turmaId]
  )

  if (turmaRes.rowCount === 0) {
    return res.status(404).json({ error: 'Turma nao encontrada' })
  }

  const turma = turmaRes.rows[0]
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    let alunoId: number
    if (cpf) {
      const existente = await client.query<{ id_aluno: number }>(
        `SELECT id_aluno FROM public.alunos WHERE regexp_replace(COALESCE(cpf::text, ''), '\\D', '', 'g') = $1 LIMIT 1`,
        [cpf]
      )

      if (existente.rowCount > 0) {
        alunoId = existente.rows[0].id_aluno
        await client.query(
          `
          UPDATE public.alunos
          SET nome = $2, cpf = $3, inep = $4, situacao = $5,
              escola = $6, serie = $7, turma = $8, turno = $9
          WHERE id_aluno = $1
          `,
          [alunoId, nome, cpf, inep, situacao, turma.escola_nome, turma.etapa_descricao, turma.turma_nome, turma.turno]
        )
      } else {
        const inserted = await client.query<{ id_aluno: number }>(
          `
          INSERT INTO public.alunos (escola, serie, turma, turno, inep, nome, cpf, situacao)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id_aluno
          `,
          [turma.escola_nome, turma.etapa_descricao, turma.turma_nome, turma.turno, inep, nome, cpf, situacao]
        )
        alunoId = inserted.rows[0].id_aluno
      }
    } else {
      const inserted = await client.query<{ id_aluno: number }>(
        `
        INSERT INTO public.alunos (escola, serie, turma, turno, inep, nome, cpf, situacao)
        VALUES ($1, $2, $3, $4, $5, $6, NULL, $7)
        RETURNING id_aluno
        `,
        [turma.escola_nome, turma.etapa_descricao, turma.turma_nome, turma.turno, inep, nome, situacao]
      )
      alunoId = inserted.rows[0].id_aluno
    }

    await client.query(
      `
      INSERT INTO public.enturmacao_aluno (id_turma, id_aluno)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      `,
      [turmaId, alunoId]
    )

    await client.query('COMMIT')
    res.json({ ok: true, alunoId: String(alunoId) })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})

router.get('/alunos', requireAdministrador, async (req: AuthRequest, res: Response) => {
  const termo = normalizeSearchTerm(req.query.q)
  if (termo.length < 2) {
    return res.json([])
  }

  const cpfTermo = normalizarCpf(termo)
  const result = await pool.query<AlunoAdmin>(
    `
    SELECT
      a.id_aluno::text AS id,
      COALESCE(NULLIF(trim(a.nome::text), ''), '') AS nome,
      a.cpf::text AS cpf,
      a.inep::text AS inep,
      a.situacao::text AS situacao
    FROM public.alunos a
    WHERE lower(COALESCE(a.nome::text, '')) LIKE lower($1)
      OR COALESCE(a.inep::text, '') LIKE $1
      ${cpfTermo ? `OR regexp_replace(COALESCE(a.cpf::text, ''), '\\D', '', 'g') LIKE $2` : ''}
    ORDER BY a.nome
    LIMIT 50
    `,
    cpfTermo ? [`%${termo}%`, `%${cpfTermo}%`] : [`%${termo}%`]
  )

  res.json(result.rows)
})

router.get('/alunos/:alunoId/turmas', requireAdministrador, async (req: AuthRequest, res: Response) => {
  const alunoId = Number(req.params.alunoId)
  if (!alunoId) {
    return res.status(400).json({ error: 'Aluno invalido' })
  }

  const result = await pool.query<EnturmacaoAlunoAdmin>(
    `
    SELECT DISTINCT
      a.id_aluno::text AS "alunoId",
      a.nome::text AS "alunoNome",
      t.id_turma::text AS "turmaId",
      ('Turma ' || COALESCE(NULLIF(et.descricao::text, ''), 'Etapa nao informada') || ' ' || COALESCE(NULLIF(t.letra_turma::text, ''), t.id_turma::text))::text AS "turmaNome",
      e.id_escola::text AS "escolaId",
      e.nome_escola::text AS "escolaNome",
      et.descricao::text AS "etapaDescricao",
      t.turno::text AS turno
    FROM public.enturmacao_aluno ea
    JOIN public.alunos a ON a.id_aluno = ea.id_aluno
    JOIN public.turmas t ON t.id_turma = ea.id_turma
    JOIN public.escolas e ON e.id_escola = t.id_escola
    JOIN public.etapas et ON et.id_etapa = t.id_etapa
    WHERE ea.id_aluno = $1
      AND e.projeto = 'PJINSTFONI'
      AND et.projeto = 'PJINSTFONI'
    ORDER BY e.nome_escola NULLS LAST, et.descricao NULLS LAST, "turmaNome"
    `,
    [alunoId]
  )

  res.json(result.rows)
})

router.post('/alunos/:alunoId/turmas', requireSuperadmin, async (req: AuthRequest, res: Response) => {
  const alunoId = Number(req.params.alunoId)
  const turmaId = Number(req.body?.turmaId)

  if (!alunoId) {
    return res.status(400).json({ error: 'Aluno invalido' })
  }
  if (!turmaId) {
    return res.status(400).json({ error: 'Informe a turma' })
  }

  const alunoRes = await pool.query(
    `SELECT 1 FROM public.alunos WHERE id_aluno = $1 LIMIT 1`,
    [alunoId]
  )
  if (alunoRes.rowCount === 0) {
    return res.status(404).json({ error: 'Aluno nao encontrado' })
  }

  const turmaRes = await pool.query<{
    escola_nome: string | null
    etapa_descricao: string | null
    turma_nome: string | null
    turno: string | null
  }>(
    `
    SELECT
      e.nome_escola::text AS escola_nome,
      et.descricao::text AS etapa_descricao,
      COALESCE(NULLIF(t.letra_turma::text, ''), t.id_turma::text) AS turma_nome,
      t.turno::text AS turno
    FROM public.turmas t
    JOIN public.escolas e ON e.id_escola = t.id_escola
    JOIN public.etapas et ON et.id_etapa = t.id_etapa
    WHERE t.id_turma = $1
      AND e.projeto = 'PJINSTFONI'
      AND et.projeto = 'PJINSTFONI'
    LIMIT 1
    `,
    [turmaId]
  )
  if (turmaRes.rowCount === 0) {
    return res.status(404).json({ error: 'Turma nao encontrada' })
  }

  const turma = turmaRes.rows[0]
  await pool.query(
    `
    INSERT INTO public.enturmacao_aluno (id_turma, id_aluno)
    SELECT $1, $2
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.enturmacao_aluno
      WHERE id_turma = $1
        AND id_aluno = $2
    )
    `,
    [turmaId, alunoId]
  )

  await pool.query(
    `
    UPDATE public.alunos
    SET escola = $2, serie = $3, turma = $4, turno = $5
    WHERE id_aluno = $1
    `,
    [alunoId, turma.escola_nome, turma.etapa_descricao, turma.turma_nome, turma.turno]
  )

  res.json({ ok: true })
})

router.delete('/alunos/:alunoId/turmas/:turmaId', requireSuperadmin, async (req: AuthRequest, res: Response) => {
  const alunoId = Number(req.params.alunoId)
  const turmaId = Number(req.params.turmaId)

  if (!alunoId || !turmaId) {
    return res.status(400).json({ error: 'Enturmacao invalida' })
  }

  await pool.query(
    `
    DELETE FROM public.enturmacao_aluno
    WHERE id_aluno = $1
      AND id_turma = $2
    `,
    [alunoId, turmaId]
  )

  res.json({ ok: true })
})

router.get('/acessos', requireSuperadmin, async (req: AuthRequest, res: Response) => {
  await ensureUsuariosAcessosTable()
  const termo = normalizeSearchTerm(req.query.q)
  const cpfTermo = normalizarCpf(termo)
  const params: any[] = []
  const where: string[] = []

  if (termo.length >= 2) {
    params.push(`%${termo}%`)
    const textParam = `$${params.length}`
    where.push(`(
      lower(COALESCE(p.profissional_nome::text, '')) LIKE lower(${textParam})
      OR lower(COALESCE(p.profissional_nome_social::text, '')) LIKE lower(${textParam})
      OR lower(COALESCE(p.profissional_e_mail::text, '')) LIKE lower(${textParam})
    )`)
  }

  if (cpfTermo) {
    params.push(`%${cpfTermo}%`)
    where.push(`ua.cpf_usuario LIKE $${params.length}`)
  }

  const result = await pool.query<UsuarioAcessoAdmin>(
    `
    SELECT
      ua.id_usuario_acesso::text AS id,
      ua.cpf_usuario AS cpf,
      COALESCE(NULLIF(trim(p.profissional_nome_social::text), ''), NULLIF(trim(p.profissional_nome::text), '')) AS nome,
      ua.perfil AS perfil,
      ua.id_escola::text AS "escolaId",
      e.nome_escola::text AS "escolaNome",
      ua.ativo
    FROM public.usuarios_acessos ua
    LEFT JOIN public.professores p
      ON regexp_replace(p.profissional_cpf::text, '\\D', '', 'g') = ua.cpf_usuario
    LEFT JOIN public.escolas e ON e.id_escola = ua.id_escola
    ${where.length ? `WHERE ${where.join(' OR ')}` : ''}
    ORDER BY ua.ativo DESC, ua.perfil, nome NULLS LAST, e.nome_escola NULLS LAST
    LIMIT 100
    `,
    params
  )

  res.json(result.rows)
})

router.post('/acessos', requireSuperadmin, async (req: AuthRequest, res: Response) => {
  await ensureUsuariosAcessosTable()
  const cpf = normalizarCpf(req.body?.cpf)
  const perfil = String(req.body?.perfil || '').toUpperCase() as PerfilAcesso
  const escolaId = req.body?.escolaId ? Number(req.body.escolaId) : null

  if (cpf.length !== 11) {
    return res.status(400).json({ error: 'Informe um CPF valido' })
  }
  if (!PERFIS_ACESSO.has(perfil)) {
    return res.status(400).json({ error: 'Perfil invalido' })
  }
  if ((perfil === 'COORDENADOR' || perfil === 'DIRETOR') && !escolaId) {
    return res.status(400).json({ error: 'Informe a escola para coordenador ou diretor' })
  }
  if (( perfil === 'SUPERADMIN' || perfil === 'ADMINISTRADOR' || perfil === 'APLICADOR')
  && escolaId
) {
  return res.status(400).json({
    error: 'Superadmin, administrador e aplicador nao devem ter escola vinculada'
  })
}

  const result = await pool.query(
    `
    INSERT INTO public.usuarios_acessos (cpf_usuario, perfil, id_escola, ativo)
    VALUES ($1, $2, $3, true)
    ON CONFLICT DO NOTHING
    RETURNING id_usuario_acesso::text AS id
    `,
    [cpf, perfil, escolaId]
  )

  if (result.rowCount === 0) {
    await pool.query(
      `
      UPDATE public.usuarios_acessos
      SET ativo = true, atualizado_em = CURRENT_TIMESTAMP
      WHERE cpf_usuario = $1
        AND perfil = $2
        AND COALESCE(id_escola, -1) = COALESCE($3::integer, -1)
      `,
      [cpf, perfil, escolaId]
    )
  }

  res.json({ ok: true })
})

router.patch('/acessos/:id', requireSuperadmin, async (req: AuthRequest, res: Response) => {
  await ensureUsuariosAcessosTable()
  const id = Number(req.params.id)
  const ativo = Boolean(req.body?.ativo)
  if (!id) return res.status(400).json({ error: 'Acesso invalido' })

  const result = await pool.query(
    `
    UPDATE public.usuarios_acessos
    SET ativo = $2, atualizado_em = CURRENT_TIMESTAMP
    WHERE id_usuario_acesso = $1
    RETURNING id_usuario_acesso::text AS id
    `,
    [id, ativo]
  )

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Acesso nao encontrado' })
  }

  res.json({ ok: true })
})

router.post('/professores/resetar-senha', requireSuperadmin, async (req: AuthRequest, res: Response) => {
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

router.post('/professores/alterar-senha', requireSuperadmin, async (req: AuthRequest, res: Response) => {
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

router.post('/professores/alterar-email-corporativo', requireSuperadmin, async (req: AuthRequest, res: Response) => {
  const cpf = normalizarCpf(req.body?.cpf)
  const conta = normalizeEmailAccount(req.body?.conta)

  if (cpf.length !== 11) {
    return res.status(400).json({ error: 'Informe um CPF valido' })
  }
  if (!conta || conta.includes('@') || !/^[a-z0-9._-]+$/.test(conta)) {
    return res.status(400).json({ error: 'Informe apenas a conta corporativa, sem dominio' })
  }

  const emails = await getProfessorEmailColumns()
  if (!emails.corporativoEmail) {
    return res.status(500).json({ error: 'Coluna de e-mail corporativo nao encontrada' })
  }

  const email = `${conta}${EMAIL_CORPORATIVO_DOMINIO}`
  const result = await pool.query(
    `UPDATE public.professores
        SET ${emails.corporativoEmail} = $2
      WHERE regexp_replace(profissional_cpf::text, '\\D', '', 'g') = $1
      RETURNING regexp_replace(profissional_cpf::text, '\\D', '', 'g') AS cpf`,
    [cpf, email]
  )

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Professor nao encontrado' })
  }

  res.json({ ok: true, cpf, corporativoEmail: email })
})

router.post('/atribuicoes/sincronizar', requireSuperadmin, async (_req: AuthRequest, res: Response) => {
  const report = await syncAtribuicoesFromDesignacoes(pool)
  res.json(report)
})

router.get('/aplicador/fases', requireAdministrador, async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const pool = getPgPool()

    const result = await pool.query(
      `
        SELECT
          id_fase::text AS "idFase",
          nome,
          data_inicio AS "dataInicio",
          data_fim AS "dataFim",
          ativo,
          ordem,
          descricao

        FROM public.avaliacao_fases

        WHERE ativo = true

        ORDER BY
          ordem,
          data_inicio
      `
    )

    return res.json(result.rows)

  } catch (error) {
    console.error(
      'Erro ao carregar fases do Aplicador:',
      error
    )

    return res.status(500).json({
      error: 'Erro ao carregar fases'
    })
  }
})

router.get('/aplicador/aplicadores', requireAdministrador, async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const pool = getPgPool()

    const result = await pool.query(
      `
        SELECT DISTINCT
          ua.cpf_usuario AS cpf,
          p.profissional_nome AS nome

        FROM public.usuarios_acessos ua

        INNER JOIN public.professores p
          ON p.profissional_cpf = ua.cpf_usuario

        WHERE ua.perfil = 'APLICADOR'
          AND ua.ativo = true

        ORDER BY
          p.profissional_nome
      `
    )

    return res.json(result.rows)

  } catch (error) {
    console.error(
      'Erro ao carregar Aplicadores:',
      error
    )

    return res.status(500).json({
      error: 'Erro ao carregar Aplicadores'
    })
  }
})

router.get('/aplicador/escolas', requireAdministrador, async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const pool = getPgPool()

    const result = await pool.query(
      `
        SELECT
          e.id_escola::text AS "idEscola",
          e.nome_escola AS "nomeEscola",

          COUNT(
            DISTINCT ea.id_aluno
          )::integer AS "quantidadeAlunos"

        FROM public.escolas e

        INNER JOIN public.turmas t
          ON t.id_escola = e.id_escola

        INNER JOIN public.enturmacao_aluno ea
          ON ea.id_turma = t.id_turma

        WHERE e.projeto = 'PJINSTFONI'

        GROUP BY
          e.id_escola,
          e.nome_escola

        ORDER BY
          e.nome_escola
      `
    )

    return res.json(result.rows)

  } catch (error) {
    console.error(
      'Erro ao carregar escolas para atribuição:',
      error
    )

    return res.status(500).json({
      error: 'Erro ao carregar escolas'
    })
  }
})

router.get(
  '/aplicador/escolas/:idEscola/etapas',
  requireAdministrador,
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const idEscola =
        Number(req.params.idEscola)

      if (
        !Number.isInteger(idEscola)
        || idEscola <= 0
      ) {
        return res.status(400).json({
          error: 'Escola inválida'
        })
      }

      const pool = getPgPool()

      const result = await pool.query(
        `
          SELECT
            et.id_etapa::text AS "idEtapa",
            et.descricao,

            COUNT(
              DISTINCT ea.id_aluno
            )::integer AS "quantidadeAlunos"

          FROM public.turmas t

          INNER JOIN public.etapas et
            ON et.id_etapa = t.id_etapa

          INNER JOIN public.enturmacao_aluno ea
            ON ea.id_turma = t.id_turma

          INNER JOIN public.escolas e
            ON e.id_escola = t.id_escola

          WHERE t.id_escola = $1
            AND e.projeto = 'PJINSTFONI'

          GROUP BY
            et.id_etapa,
            et.descricao

          ORDER BY
            et.descricao
        `,
        [idEscola]
      )

      return res.json(result.rows)

    } catch (error) {
      console.error(
        'Erro ao carregar etapas:',
        error
      )

      return res.status(500).json({
        error: 'Erro ao carregar etapas'
      })
    }
  }
)

router.get(
  '/aplicador/escolas/:idEscola/etapas/:idEtapa/turmas',
  requireAdministrador,
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const idEscola =
        Number(req.params.idEscola)

      const idEtapa =
        Number(req.params.idEtapa)

      if (
        !Number.isInteger(idEscola)
        || idEscola <= 0
        || !Number.isInteger(idEtapa)
        || idEtapa <= 0
      ) {
        return res.status(400).json({
          error: 'Escola ou etapa inválida'
        })
      }

      const pool = getPgPool()

      const result = await pool.query(
        `
          SELECT
            t.id_turma::text AS "idTurma",
            t.letra_turma AS "letraTurma",
            t.turno,

            COUNT(
              DISTINCT ea.id_aluno
            )::integer AS "quantidadeAlunos"

          FROM public.turmas t

          INNER JOIN public.enturmacao_aluno ea
            ON ea.id_turma = t.id_turma

          INNER JOIN public.escolas e
            ON e.id_escola = t.id_escola

          WHERE t.id_escola = $1
            AND t.id_etapa = $2
            AND e.projeto = 'PJINSTFONI'

          GROUP BY
            t.id_turma,
            t.letra_turma,
            t.turno

          ORDER BY
            t.letra_turma,
            t.turno
        `,
        [
          idEscola,
          idEtapa
        ]
      )

      return res.json(result.rows)

    } catch (error) {
      console.error(
        'Erro ao carregar turmas:',
        error
      )

      return res.status(500).json({
        error: 'Erro ao carregar turmas'
      })
    }
  }
)

router.get(
  '/aplicador/turmas/:idTurma/alunos',
  requireAdministrador,
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const idTurma =
        Number(req.params.idTurma)

      const idFase =
        Number(req.query.idFase)

      if (
        !Number.isInteger(idTurma) ||
        idTurma <= 0
      ) {
        return res.status(400).json({
          error: 'Turma inválida'
        })
      }

      if (
        !Number.isInteger(idFase) ||
        idFase <= 0
      ) {
        return res.status(400).json({
          error: 'Fase inválida'
        })
      }

      const result = await pool.query(
        `
          SELECT DISTINCT
            a.id_aluno::text
              AS "idAluno",

            a.nome
              AS "nomeAluno",

            a.inep,
            a.situacao,

            ap.id_aplicacao::text
              AS "idAplicacao",

            ap.cpf_aplicador
              AS "cpfAplicador",

            COALESCE(
              NULLIF(
                TRIM(
                  p.profissional_nome_social::text
                ),
                ''
              ),
              NULLIF(
                TRIM(
                  p.profissional_nome::text
                ),
                ''
              )
            ) AS "nomeAplicador",

            ap.status
              AS "statusAtribuicao",

            CASE
              WHEN ap.id_aplicacao IS NULL
                THEN false
              ELSE true
            END AS "jaAtribuido"

          FROM public.enturmacao_aluno ea

          INNER JOIN public.alunos a
            ON a.id_aluno =
               ea.id_aluno

          INNER JOIN public.turmas t
            ON t.id_turma =
               ea.id_turma

          INNER JOIN public.escolas e
            ON e.id_escola =
               t.id_escola

          LEFT JOIN public.avaliacao_aplicador_aplicacoes ap
            ON ap.id_aluno =
               a.id_aluno

           AND ap.id_turma =
               t.id_turma

           AND ap.id_fase =
               $2

           AND ap.status <>
               'CANCELADA'

          LEFT JOIN public.professores p
            ON p.profissional_cpf =
               ap.cpf_aplicador

          WHERE ea.id_turma = $1

            AND e.projeto =
                'PJINSTFONI'

          ORDER BY
            a.nome
        `,
        [
          idTurma,
          idFase
        ]
      )

      return res.json(
        result.rows
      )

    } catch (error) {
      console.error(
        'Erro ao carregar alunos da turma:',
        error
      )

      return res.status(500).json({
        error:
          'Erro ao carregar alunos'
      })
    }
  }
)

router.post(
  '/aplicador/atribuicoes',
  requireAdministrador,
  async (
    req: AuthRequest,
    res: Response 
  ) => {

    const cpfAdministrador = normalizarCpf(
      req.professor?.cpf ||
      req.professor?.login ||
      ''
    )


    const client =
      await getPgPool().connect()

    try {
      const idFase =
        Number(req.body?.idFase)

      const idTurma =
        Number(req.body?.idTurma)

      const cpfAplicador =
        String(
          req.body?.cpfAplicador || ''
        ).replace(/\D/g, '')

      const alunos =
        Array.isArray(req.body?.alunos)
          ? [
              ...new Set(
                req.body.alunos
                  .map((id: any) =>
                    Number(id)
                  )
                  .filter(
                    (id: number) =>
                      Number.isInteger(id)
                      && id > 0
                  )
              )
            ]
          : []

      if (
        !Number.isInteger(idFase)
        || idFase <= 0
      ) {
        return res.status(400).json({
          error: 'Fase inválida'
        })
      }

      if (
        !Number.isInteger(idTurma)
        || idTurma <= 0
      ) {
        return res.status(400).json({
          error: 'Turma inválida'
        })
      }

      if (
        !/^[0-9]{11}$/.test(
          cpfAplicador
        )
      ) {
        return res.status(400).json({
          error: 'Aplicador inválido'
        })
      }

      if (alunos.length === 0) {
        return res.status(400).json({
          error:
            'Selecione pelo menos um aluno'
        })
      }

      await client.query('BEGIN')

      // ----------------------------------
      // VALIDA FASE
      // ----------------------------------

      const fase =
        await client.query(
          `
            SELECT id_fase
            FROM public.avaliacao_fases
            WHERE id_fase = $1
              AND ativo = true
            LIMIT 1
          `,
          [idFase]
        )

      if (fase.rowCount === 0) {
        await client.query('ROLLBACK')

        return res.status(400).json({
          error:
            'Fase inexistente ou inativa'
        })
      }

      // ----------------------------------
      // VALIDA APLICADOR
      // ----------------------------------

      const aplicador =
        await client.query(
          `
            SELECT 1

            FROM public.usuarios_acessos

            WHERE cpf_usuario = $1
              AND perfil = 'APLICADOR'
              AND ativo = true

            LIMIT 1
          `,
          [cpfAplicador]
        )

      if (
        aplicador.rowCount === 0
      ) {
        await client.query('ROLLBACK')

        return res.status(400).json({
          error:
            'Usuário não possui perfil APLICADOR ativo'
        })
      }

      // ----------------------------------
      // VALIDA TURMA
      // ----------------------------------

      const turma =
        await client.query(
          `
            SELECT t.id_turma

            FROM public.turmas t

            INNER JOIN public.escolas e
              ON e.id_escola =
                 t.id_escola

            WHERE t.id_turma = $1
              AND e.projeto =
                  'PJINSTFONI'

            LIMIT 1
          `,
          [idTurma]
        )

      if (turma.rowCount === 0) {
        await client.query('ROLLBACK')

        return res.status(400).json({
          error:
            'Turma inválida para o projeto'
        })
      }

      // ----------------------------------
      // VALIDA ALUNOS DA TURMA
      // ----------------------------------

      const alunosValidos =
        await client.query(
          `
            SELECT DISTINCT
              ea.id_aluno

            FROM public.enturmacao_aluno ea

            WHERE ea.id_turma = $1
              AND ea.id_aluno =
                  ANY($2::int[])
          `,
          [
            idTurma,
            alunos
          ]
        )

      const idsValidos =
        new Set<number>(
          alunosValidos.rows.map(
            linha =>
              Number(linha.id_aluno)
          )
        )

      const alunosInvalidos =
        alunos.filter(
          id =>
            !idsValidos.has(
              Number(id)
            )
        )

      if (
        alunosInvalidos.length > 0
      ) {
        await client.query('ROLLBACK')

        return res.status(400).json({
          error:
            'Existem alunos que não pertencem à turma informada',
          alunosInvalidos
        })
      }

      // ----------------------------------
      // INSERE ATRIBUIÇÕES
      // ----------------------------------

      let criadas = 0
      let jaExistentes = 0

      for (
        const idAluno of alunos
      ) {
        const result =
          await client.query(
            `
              INSERT INTO public.avaliacao_aplicador_aplicacoes
              (
                id_fase,
                id_aluno,
                id_turma,
                cpf_aplicador,
                criado_por,
                status,
                criado_em,
                atualizado_em
              )

              VALUES
              (
                $1,
                $2,
                $3,
                $4,
                $5,
                'PENDENTE',
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              )

              ON CONFLICT
              (
                id_fase,
                id_aluno,
                id_turma
              )
              WHERE
                status <> 'CANCELADA'
                AND id_fase IS NOT NULL

              DO NOTHING

              RETURNING id_aplicacao
            `,
            [
              idFase,
              idAluno,
              idTurma,
              cpfAplicador,
              cpfAdministrador
            ]
          )

        if (
          result.rowCount &&
          result.rowCount > 0
        ) {
          criadas++
        } else {
          jaExistentes++
        }
      }

      await client.query('COMMIT')

      return res.status(201).json({
        ok: true,
        solicitadas:
          alunos.length,
        criadas,
        jaExistentes
      })

    } catch (error) {
      await client.query(
        'ROLLBACK'
      )

      console.error(
        'Erro ao criar atribuições:',
        error
      )

      return res.status(500).json({
        error:
          'Erro ao criar atribuições'
      })

    } finally {
      client.release()
    }
  }
)

/**
 * =========================================================
 * GET /api/superadmin/aplicador/acompanhamento
 * =========================================================
 *
 * Resumo por Aplicador dentro de uma fase.
 *
 * Query:
 *   ?idFase=2
 */
router.get(
  '/aplicador/acompanhamento',
  requireAdministrador,
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const idFase =
        Number(req.query.idFase)

      if (
        !Number.isInteger(idFase) ||
        idFase <= 0
      ) {
        return res.status(400).json({
          error: 'Fase inválida'
        })
      }

      const fase = await pool.query(
        `
          SELECT
            id_fase::text AS "idFase",
            nome,
            data_inicio AS "dataInicio",
            data_fim AS "dataFim",
            ativo,
            ordem

          FROM public.avaliacao_fases

          WHERE id_fase = $1

          LIMIT 1
        `,
        [idFase]
      )

      if (fase.rowCount === 0) {
        return res.status(404).json({
          error: 'Fase não encontrada'
        })
      }

      const result = await pool.query(
        `
          SELECT
            aa.cpf_aplicador
              AS "cpfAplicador",

            COALESCE(
              NULLIF(
                TRIM(
                  p.profissional_nome_social::text
                ),
                ''
              ),
              NULLIF(
                TRIM(
                  p.profissional_nome::text
                ),
                ''
              ),
              aa.cpf_aplicador
            ) AS "nomeAplicador",

            COUNT(*)::integer
              AS total,

            COUNT(*) FILTER (
              WHERE aa.status = 'PENDENTE'
            )::integer
              AS pendentes,

            COUNT(*) FILTER (
              WHERE aa.status = 'EM_ANDAMENTO'
            )::integer
              AS "emAndamento",

            COUNT(*) FILTER (
              WHERE aa.status = 'CONCLUIDA'
            )::integer
              AS concluidas,

            COUNT(*) FILTER (
              WHERE aa.status = 'CANCELADA'
            )::integer
              AS canceladas

          FROM public.avaliacao_aplicador_aplicacoes aa

          LEFT JOIN public.professores p
            ON regexp_replace(
                 p.profissional_cpf::text,
                 '\\D',
                 '',
                 'g'
               )
               =
               regexp_replace(
                 aa.cpf_aplicador::text,
                 '\\D',
                 '',
                 'g'
               )

          WHERE aa.id_fase = $1

          GROUP BY
            aa.cpf_aplicador,
            p.profissional_nome_social,
            p.profissional_nome

          ORDER BY
            "nomeAplicador"
        `,
        [idFase]
      )

      return res.json({
        fase: fase.rows[0],
        aplicadores: result.rows
      })

    } catch (error) {
      console.error(
        'Erro ao carregar acompanhamento dos Aplicadores:',
        error
      )

      return res.status(500).json({
        error:
          'Erro ao carregar acompanhamento das avaliações'
      })
    }
  }
)


/**
 * =========================================================
 * GET /api/superadmin/aplicador/acompanhamento/:cpf
 * =========================================================
 *
 * Detalhamento das aplicações de um Aplicador
 * dentro de uma fase.
 *
 * Query:
 *   ?idFase=2
 */
router.get(
  '/aplicador/acompanhamento/:cpf',
  requireAdministrador,
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const cpfAplicador =
        normalizarCpf(req.params.cpf)

      const idFase =
        Number(req.query.idFase)

      if (cpfAplicador.length !== 11) {
        return res.status(400).json({
          error: 'Aplicador inválido'
        })
      }

      if (
        !Number.isInteger(idFase) ||
        idFase <= 0
      ) {
        return res.status(400).json({
          error: 'Fase inválida'
        })
      }

      const aplicador = await pool.query(
        `
          SELECT
            regexp_replace(
              p.profissional_cpf::text,
              '\\D',
              '',
              'g'
            ) AS cpf,

            COALESCE(
              NULLIF(
                TRIM(
                  p.profissional_nome_social::text
                ),
                ''
              ),
              NULLIF(
                TRIM(
                  p.profissional_nome::text
                ),
                ''
              )
            ) AS nome

          FROM public.professores p

          WHERE regexp_replace(
                  p.profissional_cpf::text,
                  '\\D',
                  '',
                  'g'
                ) = $1

          LIMIT 1
        `,
        [cpfAplicador]
      )

      if (aplicador.rowCount === 0) {
        return res.status(404).json({
          error: 'Aplicador não encontrado'
        })
      }

      const result = await pool.query(
        `
          SELECT
            aa.id_aplicacao::text
              AS "idAplicacao",

            aa.status,

            aa.criado_em
              AS "criadoEm",

            aa.iniciado_em
              AS "iniciadoEm",

            aa.concluido_em
              AS "concluidoEm",

            aa.atualizado_em
              AS "atualizadoEm",

            a.id_aluno::text
              AS "idAluno",

            a.nome
              AS "nomeAluno",

            a.inep,

            a.situacao,

            t.id_turma::text
              AS "idTurma",

            t.letra_turma
              AS "letraTurma",

            t.turno,

            et.id_etapa::text
              AS "idEtapa",

            et.descricao
              AS etapa,

            e.id_escola::text
              AS "idEscola",

            e.nome_escola
              AS "nomeEscola"

          FROM public.avaliacao_aplicador_aplicacoes aa

          INNER JOIN public.alunos a
            ON a.id_aluno =
               aa.id_aluno

          INNER JOIN public.turmas t
            ON t.id_turma =
               aa.id_turma

          INNER JOIN public.escolas e
            ON e.id_escola =
               t.id_escola

          LEFT JOIN public.etapas et
            ON et.id_etapa =
               t.id_etapa

          WHERE regexp_replace(
                  aa.cpf_aplicador::text,
                  '\\D',
                  '',
                  'g'
                ) = $1

            AND aa.id_fase = $2

          ORDER BY
            CASE aa.status
              WHEN 'EM_ANDAMENTO' THEN 1
              WHEN 'PENDENTE' THEN 2
              WHEN 'CONCLUIDA' THEN 3
              WHEN 'CANCELADA' THEN 4
              ELSE 5
            END,

            e.nome_escola,
            et.descricao,
            t.letra_turma,
            a.nome
        `,
        [
          cpfAplicador,
          idFase
        ]
      )

      const resumo = {
        total:
          result.rows.length,

        pendentes:
          result.rows.filter(
            row =>
              row.status === 'PENDENTE'
          ).length,

        emAndamento:
          result.rows.filter(
            row =>
              row.status === 'EM_ANDAMENTO'
          ).length,

        concluidas:
          result.rows.filter(
            row =>
              row.status === 'CONCLUIDA'
          ).length,

        canceladas:
          result.rows.filter(
            row =>
              row.status === 'CANCELADA'
          ).length
      }

      return res.json({
        aplicador:
          aplicador.rows[0],

        resumo,

        aplicacoes:
          result.rows
      })

    } catch (error) {
      console.error(
        'Erro ao carregar detalhamento do Aplicador:',
        error
      )

      return res.status(500).json({
        error:
          'Erro ao carregar avaliações do Aplicador'
      })
    }
  }
)

export default router
