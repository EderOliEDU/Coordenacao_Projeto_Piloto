import { Router, Response } from 'express'
import { authMiddleware, AuthRequest, blockViewOnlyWrites, getEffectiveProfessorCpf } from '../middleware/auth'
import { z } from 'zod'
import { getPgPool } from '../services/pgPool'
import { getFaseAtual } from '../services/avaliacaoFases'

const router = Router()
router.use(authMiddleware)

const STATUS_RASCUNHO = 'RASCUNHO'
const STATUS_FINALIZADO = 'FINALIZADO'

const salvarRespostaSchema = z.object({
  formularioId: z.string().min(1),
  escolaId: z.string().min(1).optional(), // recebido do frontend; mantido para compatibilidade
  turmaId: z.string().min(1),
  alunoId: z.string().min(1),
  observacoes: z.string().optional(),
  status: z.enum([STATUS_RASCUNHO, STATUS_FINALIZADO]).optional(),
  respostas: z.array(z.object({
    perguntaId: z.string().min(1),
    opcaoEscalaId: z.string().min(1),
  })).optional(),
  necessidadesEspecificas: z.object({
    paee: z.boolean().nullable().optional(),
    estudoCaso: z.boolean().nullable().optional(),
    apoioPedagogico: z.boolean().nullable().optional(),
    tipo: z.enum(['PAEE', 'APOIO']).nullable().optional(),
    selecionadas: z.array(z.string().min(1)).optional(),
    descricaoOutros: z.string().optional(),
  }).optional(),
})

function normalizarCpf(value: string) {
  return (value || '').replace(/\D/g, '')
}

async function assertTurmaAssignment(cpf: string, turmaId: number) {
  const pool = getPgPool()
  const r = await pool.query(
    `
    SELECT 1
    FROM public.atribuicao_professor ap
    JOIN public.turmas t ON t.id_turma = ap.id_turma
    JOIN public.escolas e ON e.id_escola = t.id_escola
    JOIN public.etapas et ON et.id_etapa = t.id_etapa
    WHERE ap.cpf_professor = $1
      AND ap.id_turma = $2
      AND e.projeto = 'PJINSTFONI'
      AND et.projeto = 'PJINSTFONI'
    LIMIT 1
    `,
    [cpf, turmaId]
  )
  return r.rowCount > 0
}

// GET /api/submissoes?turmaId=&alunoId=
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const cpf = getEffectiveProfessorCpf(req)
    const { turmaId, alunoId, faseId } = req.query as { turmaId?: string; alunoId?: string; faseId?: string }
    const faseAtual = faseId ? { id: Number(faseId) } : await getFaseAtual()

    const where: string[] = [
      `s.cpf_professor = $1`,
      `e.projeto = 'PJINSTFONI'`,
      `et.projeto = 'PJINSTFONI'`,
      `s.id_fase = $2`,
    ]
    const params: any[] = [cpf, faseAtual.id]
    let idx = 3

    if (turmaId) { where.push(`s.id_turma = $${idx++}`); params.push(Number(turmaId)) }
    if (alunoId) { where.push(`s.id_aluno = $${idx++}`); params.push(Number(alunoId)) }

    const pool = getPgPool()
    const { rows } = await pool.query(
      `
      SELECT s.id::text AS id, s.id_aluno::text AS "alunoId", s.status, s.id_fase::text AS "faseId"
      FROM public.submissoes_pg s
      JOIN public.turmas t ON t.id_turma = s.id_turma
      JOIN public.escolas e ON e.id_escola = t.id_escola
      JOIN public.etapas et ON et.id_etapa = t.id_etapa
      WHERE ${where.join(' AND ')}
      ORDER BY s.atualizada_em DESC
      `,
      params
    )

    return res.json(rows.map(r => ({ id: r.id, alunoId: r.alunoId, status: r.status, faseId: r.faseId })))
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao buscar submissões' })
  }
})

// GET /api/submissoes/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const cpf = getEffectiveProfessorCpf(req)
    const subId = Number(req.params.id)
    const pool = getPgPool()

    const subRes = await pool.query(
      `SELECT s.id, s.cpf_professor, s.id_turma, s.id_aluno, s.formulario_id, s.status, s.observacoes, s.id_fase
       FROM public.submissoes_pg s
       JOIN public.turmas t ON t.id_turma = s.id_turma
       JOIN public.escolas e ON e.id_escola = t.id_escola
       JOIN public.etapas et ON et.id_etapa = t.id_etapa
       WHERE s.id = $1
         AND s.cpf_professor = $2
         AND e.projeto = 'PJINSTFONI'
         AND et.projeto = 'PJINSTFONI'
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
      WHERE cpf_professor = $1
        AND id_aluno = $2
        AND id_turma = $3
        AND id_fase = $4
      ORDER BY id_pergunta
      `,
      [cpf, Number(sub.id_aluno), Number(sub.id_turma), Number(sub.id_fase)]
    )

    return res.json({
      id: String(sub.id),
      status: sub.status,
      observacoes: sub.observacoes || '',
      faseId: String(sub.id_fase || ''),
      respostas: respRes.rows,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao buscar submissão' })
  }
})

// POST /api/submissoes/respostas
router.post('/respostas', blockViewOnlyWrites, async (req: AuthRequest, res: Response) => {
  const parsed = salvarRespostaSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido', detalhes: parsed.error.flatten() })
  }

  try {
    const cpf = getEffectiveProfessorCpf(req)
    const { formularioId, turmaId, alunoId, respostas, observacoes, status, necessidadesEspecificas } = parsed.data
    const turmaIdNum = Number(turmaId)
    const alunoIdNum = Number(alunoId)
    const targetStatus = status || STATUS_RASCUNHO
    const faseAtual = await getFaseAtual()

    const ok = await assertTurmaAssignment(cpf, turmaIdNum)
    if (!ok) return res.status(403).json({ error: 'Acesso negado a esta turma' })

    const pool = getPgPool()

    // upsert submissao metadata
    const upsert = await pool.query(
      `
      INSERT INTO public.submissoes_pg (cpf_professor, id_turma, id_aluno, formulario_id, status, observacoes, id_fase)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (cpf_professor, id_turma, id_aluno, formulario_id, id_fase)
      DO UPDATE SET
        status = EXCLUDED.status,
        observacoes = EXCLUDED.observacoes,
        atualizada_em = CURRENT_TIMESTAMP
      RETURNING id::text AS id
      `,
      [cpf, turmaIdNum, alunoIdNum, formularioId, targetStatus, observacoes || null, faseAtual.id]
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
             WHERE cpf_professor = $1
               AND id_aluno = $2
               AND id_turma = $3
               AND id_pergunta = $4
               AND id_fase = $5`,
            [cpf, alunoIdNum, turmaIdNum, perguntaId, faseAtual.id]
          )

          await pool.query(
            `INSERT INTO public.avaliacao_respostas (id_aluno, id_turma, cpf_professor, id_pergunta, id_opcao, status, observacao, id_fase)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [alunoIdNum, turmaIdNum, cpf, perguntaId, opcaoId, targetStatus, observacoes || null, faseAtual.id]
          )
        }
        await pool.query('COMMIT')
      } catch (e) {
        await pool.query('ROLLBACK')
        throw e
      }
    }

    if (necessidadesEspecificas) {
      const tipo = necessidadesEspecificas.tipo || null
      const selecionadas = necessidadesEspecificas.selecionadas || []
      const descricaoOutros = (necessidadesEspecificas.descricaoOutros || '').trim()

      await pool.query('BEGIN')
      try {
        await pool.query(
          `
          INSERT INTO public.aluno_necessidades_contexto (
            id_aluno,
            id_turma,
            cpf_professor,
            paee,
            estudo_caso,
            apoio_pedagogico
            , id_fase
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id_aluno, id_turma, cpf_professor, id_fase)
          DO UPDATE SET
            paee = EXCLUDED.paee,
            estudo_caso = EXCLUDED.estudo_caso,
            apoio_pedagogico = EXCLUDED.apoio_pedagogico,
            atualizada_em = CURRENT_TIMESTAMP
          `,
          [
            alunoIdNum,
            turmaIdNum,
            cpf,
            necessidadesEspecificas.paee ?? null,
            necessidadesEspecificas.estudoCaso ?? null,
            necessidadesEspecificas.apoioPedagogico ?? null,
            faseAtual.id,
          ]
        )

        await pool.query(
          `
          DELETE FROM public.aluno_necessidades_especificas
          WHERE id_aluno = $1
            AND id_turma = $2
            AND regexp_replace(cpf_professor, '\\D', '', 'g') = $3
            AND id_fase = $4
          `,
          [alunoIdNum, turmaIdNum, cpf, faseAtual.id]
        )

        for (const necessidadeId of selecionadas) {
          await pool.query(
            `
            INSERT INTO public.aluno_necessidades_especificas (
              id_aluno,
              id_turma,
              cpf_professor,
              id_necespecifica,
              tipo,
              id_fase
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [alunoIdNum, turmaIdNum, cpf, Number(necessidadeId), tipo, faseAtual.id]
          )
        }

        if (descricaoOutros && tipo === 'APOIO') {
          await pool.query(
            `
            INSERT INTO public.aluno_necessidades_especificas (
              id_aluno,
              id_turma,
              cpf_professor,
              id_necespecifica,
              tipo,
              descricao_outros,
              id_fase
            )
            VALUES ($1, $2, $3, NULL, $4, $5, $6)
            `,
            [alunoIdNum, turmaIdNum, cpf, tipo, descricaoOutros, faseAtual.id]
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
