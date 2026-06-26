import { Router, Response } from 'express'
import { z } from 'zod'
import { authMiddleware, AuthRequest, blockViewOnlyWrites, getAuthenticatedCpf, getEffectiveProfessorCpf, isViewOnlyMode } from '../middleware/auth'
import { getPgPool } from '../services/pgPool'
import { isAdministrador } from '../services/permissions'

const router = Router()
router.use(authMiddleware)

const salvarCronogramaSchema = z.object({
  itensMarcados: z.array(z.coerce.number().int().positive()).min(1),
})

async function garantirTabelaTurmaCronograma() {
  const pool = getPgPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.turma_cronograma_aplicacao (
      id_turma integer NOT NULL,
      id_cronograma_aplicacao integer NOT NULL,
      cpf_professor text NOT NULL,
      atualizado_em timestamp with time zone NOT NULL DEFAULT NOW(),
      CONSTRAINT turma_cronograma_aplicacao_pkey
        PRIMARY KEY (id_turma, id_cronograma_aplicacao),
      CONSTRAINT turma_cronograma_aplicacao_turma_fkey
        FOREIGN KEY (id_turma)
        REFERENCES public.turmas (id_turma)
        ON DELETE CASCADE
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS turma_cronograma_aplicacao_item_idx
      ON public.turma_cronograma_aplicacao (id_cronograma_aplicacao)
  `)
}

async function buscarTurmaAtribuida(cpf: string, turmaId: number, canViewAll = false) {
  const pool = getPgPool()
  const { rows } = await pool.query<{
    id: string
    nome: string
    escola_nome: string
    etapa_id: number
    etapa_descricao: string
  }>(
    `
    SELECT
      t.id_turma::text AS id,
      ('Turma ' || COALESCE(NULLIF(et.descricao, ''), 'Etapa não informada') || ' ' ||
        COALESCE(NULLIF(t.letra_turma, ''), t.id_turma::text))::text AS nome,
      e.nome_escola::text AS escola_nome,
      t.id_etapa AS etapa_id,
      et.descricao::text AS etapa_descricao
    FROM public.turmas t
    JOIN public.escolas e ON e.id_escola = t.id_escola
    JOIN public.etapas et ON et.id_etapa = t.id_etapa
    LEFT JOIN public.atribuicao_professor ap ON ap.id_turma = t.id_turma
    WHERE ($3::boolean = true OR regexp_replace(ap.cpf_professor, '\\D', '', 'g') = $1)
      AND t.id_turma = $2
      AND e.projeto = 'PJINSTFONI'
      AND et.projeto = 'PJINSTFONI'
    LIMIT 1
    `,
    [cpf, turmaId, canViewAll]
  )

  return rows[0] || null
}

router.get('/:turmaId', async (req: AuthRequest, res: Response) => {
  try {
    const authenticatedCpf = getAuthenticatedCpf(req)
    const cpf = getEffectiveProfessorCpf(req)
    const turmaId = Number(req.params.turmaId)
    if (!cpf || !turmaId) return res.status(400).json({ error: 'Turma ou professor inválido' })
    const canViewAll = isAdministrador(authenticatedCpf) && !isViewOnlyMode(req)

    const turma = await buscarTurmaAtribuida(cpf, turmaId, canViewAll)
    if (!turma) return res.status(403).json({ error: 'Acesso negado a esta turma' })

    const pool = getPgPool()
    await garantirTabelaTurmaCronograma()
    const { rows } = await pool.query<{
      id: string
      tema: string
      ordem: number
      marcado: boolean
    }>(
      `
      SELECT
        ca.id_cronograma_aplicacao::text AS id,
        ca.tema::text AS tema,
        ca.ordem,
        (tca.id_cronograma_aplicacao IS NOT NULL) AS marcado
      FROM public.cronograma_aplicacao ca
      LEFT JOIN public.turma_cronograma_aplicacao tca
        ON tca.id_cronograma_aplicacao = ca.id_cronograma_aplicacao
       AND tca.id_turma = $1
      WHERE ca.id_etapa = $2
        AND ca.id_etapa IS NOT NULL
        AND ca.ordem IS NOT NULL
      ORDER BY ca.ordem ASC, ca.id_cronograma_aplicacao ASC
      `,
      [turmaId, turma.etapa_id]
    )

    res.json({
      turma: {
        id: turma.id,
        nome: turma.nome,
        escolaNome: turma.escola_nome,
        etapaId: turma.etapa_id,
        etapaDescricao: turma.etapa_descricao,
      },
      itens: rows,
      preenchido: rows.some((item) => item.marcado),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar cronograma da turma' })
  }
})

router.put('/:turmaId', blockViewOnlyWrites, async (req: AuthRequest, res: Response) => {
  const parsed = salvarCronogramaSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Marque ao menos um item do cronograma antes de salvar' })
  }

  const authenticatedCpf = getAuthenticatedCpf(req)
  const cpf = getEffectiveProfessorCpf(req)
  const turmaId = Number(req.params.turmaId)
  if (!cpf || !turmaId) return res.status(400).json({ error: 'Turma ou professor inválido' })
  const canViewAll = isAdministrador(authenticatedCpf) && !isViewOnlyMode(req)

  try {
    const turma = await buscarTurmaAtribuida(cpf, turmaId, canViewAll)
    if (!turma) return res.status(403).json({ error: 'Acesso negado a esta turma' })

    const itensMarcados = [...new Set(parsed.data.itensMarcados)]
    const pool = getPgPool()
    await garantirTabelaTurmaCronograma()
    const validos = await pool.query<{ id: number }>(
      `
      SELECT id_cronograma_aplicacao AS id
      FROM public.cronograma_aplicacao
      WHERE id_cronograma_aplicacao = ANY($1::int[])
        AND id_etapa = $2
        AND id_etapa IS NOT NULL
        AND ordem IS NOT NULL
      `,
      [itensMarcados, turma.etapa_id]
    )

    if (validos.rowCount !== itensMarcados.length) {
      return res.status(400).json({ error: 'O cronograma contém itens inválidos para esta etapa' })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        'DELETE FROM public.turma_cronograma_aplicacao WHERE id_turma = $1',
        [turmaId]
      )
      await client.query(
        `
        INSERT INTO public.turma_cronograma_aplicacao (
          id_turma,
          id_cronograma_aplicacao,
          cpf_professor,
          atualizado_em
        )
        SELECT $1, unnest($2::int[]), $3, NOW()
        `,
        [turmaId, itensMarcados, cpf]
      )
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    res.json({ ok: true, itensMarcados: itensMarcados.map(String) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao salvar cronograma da turma' })
  }
})

export default router
