import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { z } from 'zod'
import { getPgPool } from '../services/pgPool'

const router = Router()
router.use(authMiddleware)

const STATUS_RASCUNHO = 'RASCUNHO'
const STATUS_FINALIZADO = 'FINALIZADO'

const salvarRespostaSchema = z.object({
  formularioId: z.string().min(1),
  escolaId: z.string().min(1).optional(), // vindo do frontend, não usamos no PG agora
  turmaId: z.string().min(1),
  alunoId: z.string().min(1),
  observacoes: z.string().optional(),
  status: z.enum([STATUS_RASCUNHO, STATUS_FINALIZADO]).optional(),
  respostas: z.array(z.object({
    perguntaId: z.string().min(1),
    opcaoEscalaId: z.string().min(1),
  })).optional(),
})

function normalizarCpf(value: string) {
  return (value || '').replace(/\D/g, '')
}

async function assertTurmaAssignment(cpf: string, turmaId: number) {
  const pool = getPgPool()
  const r = await pool.query(
    `SELECT 1 FROM public.atribuicao_professor WHERE cpf_professor = $1 AND id_turma = $2 LIMIT 1`,
    [cpf, turmaId]
  )
  return r.rowCount > 0
}

// GET /api/submissoes?turmaId=&alunoId=
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const cpf = normalizarCpf(req.professor?.login || '')
    const { turmaId, alunoId } = req.query as { turmaId?: string; alunoId?: string }

    const where: string[] = [`cpf_professor = $1`]
    const params: any[] = [cpf]
    let idx = 2

    if (turmaId) { where.push(`id_turma = $${idx++}`); params.push(Number(turmaId)) }
    if (alunoId) { where.push(`id_aluno = $${idx++}`); params.push(Number(alunoId)) }

    const pool = getPgPool()
    const { rows } = await pool.query(
      `
      SELECT id::text AS id, status
      FROM public.submissoes_pg
      WHERE ${where.join(' AND ')}
      ORDER BY atualizada_em DESC
      `,
      params
    )

    return res.json(rows.map(r => ({ id: r.id, status: r.status })))
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao buscar submissões' })
  }
})

// GET /api/submissoes/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const cpf = normalizarCpf(req.professor?.login || '')
    const subId = Number(req.params.id)
    const pool = getPgPool()

    const subRes = await pool.query(
      `SELECT id, cpf_professor, id_turma, id_aluno, formulario_id, status, observacoes
       FROM public.submissoes_pg
       WHERE id = $1 AND cpf_professor = $2
       LIMIT 1`,
      [subId, cpf]
    )
    if (subRes.rowCount === 0) return res.status(404).json({ error: 'Submissão não encontrada' })

    const sub = subRes.rows[0]

    // respostas por professor+aluno (escopo simples)
    const respRes = await pool.query(
      `
      SELECT id_pergunta::text AS "perguntaId", id_opcao::text AS "opcaoEscalaId"
      FROM public.avaliacao_respostas
      WHERE cpf_professor = $1 AND id_aluno = $2
      ORDER BY id_pergunta
      `,
      [cpf, Number(sub.id_aluno)]
    )

    return res.json({
      id: String(sub.id),
      status: sub.status,
      observacoes: sub.observacoes || '',
      respostas: respRes.rows,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao buscar submissão' })
  }
})

// POST /api/submissoes/respostas
router.post('/respostas', async (req: AuthRequest, res: Response) => {
  const parsed = salvarRespostaSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido', detalhes: parsed.error.flatten() })
  }

  try {
    const cpf = normalizarCpf(req.professor?.login || '')
    const { formularioId, turmaId, alunoId, respostas, observacoes, status } = parsed.data
    const turmaIdNum = Number(turmaId)
    const alunoIdNum = Number(alunoId)
    const targetStatus = status || STATUS_RASCUNHO

    const ok = await assertTurmaAssignment(cpf, turmaIdNum)
    if (!ok) return res.status(403).json({ error: 'Acesso negado a esta turma' })

    const pool = getPgPool()

    // upsert submissao metadata
    const upsert = await pool.query(
      `
      INSERT INTO public.submissoes_pg (cpf_professor, id_turma, id_aluno, formulario_id, status, observacoes)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (cpf_professor, id_turma, id_aluno, formulario_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        observacoes = EXCLUDED.observacoes,
        atualizada_em = CURRENT_TIMESTAMP
      RETURNING id::text AS id
      `,
      [cpf, turmaIdNum, alunoIdNum, formularioId, targetStatus, observacoes || null]
    )

    const subId = upsert.rows[0].id as string

    if (respostas && Array.isArray(respostas)) {
      // mantém 1 resposta por pergunta por professor+aluno (escopo simples)
      await pool.query('BEGIN')
      try {
        for (const r of respostas) {
          const perguntaId = Number(r.perguntaId)
          const opcaoId = Number(r.opcaoEscalaId)

          // apaga resposta anterior dessa pergunta
          await pool.query(
            `DELETE FROM public.avaliacao_respostas
             WHERE cpf_professor = $1 AND id_aluno = $2 AND id_pergunta = $3`,
            [cpf, alunoIdNum, perguntaId]
          )

          await pool.query(
            `INSERT INTO public.avaliacao_respostas (id_aluno, cpf_professor, id_pergunta, id_opcao, status, observacao)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [alunoIdNum, cpf, perguntaId, opcaoId, targetStatus, observacoes || null]
          )
        }
        await pool.query('COMMIT')
      } catch (e) {
        await pool.query('ROLLBACK')
        throw e
      }
    }

    return res.json({ id: subId, status: targetStatus })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao salvar' })
  }
})

export default router
