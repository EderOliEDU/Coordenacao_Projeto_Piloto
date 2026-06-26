import { Router, Response } from 'express'
import { authMiddleware, AuthRequest, getEffectiveProfessorCpf } from '../middleware/auth'
import { getPgPool } from '../services/pgPool'

const router = Router()
router.use(authMiddleware)

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
    WHERE regexp_replace(ap.cpf_professor, '\\D', '', 'g') = $1
      AND ap.id_turma = $2
      AND e.projeto = 'PJINSTFONI'
      AND et.projeto = 'PJINSTFONI'
    LIMIT 1
    `,
    [cpf, turmaId]
  )
  return r.rowCount > 0
}

router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const pool = getPgPool()
    const { rows } = await pool.query(
      `
      SELECT
        id_necespecifica::text AS id,
        "descrição"::text AS descricao,
        COALESCE(paee, '')::text AS tipo
      FROM public."necessidades_específicas"
      ORDER BY
        CASE WHEN paee = 'PAEE' THEN 0 ELSE 1 END,
        "descrição"
      `
    )

    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar necessidades específicas' })
  }
})

router.get('/aluno/:alunoId', async (req: AuthRequest, res: Response) => {
  try {
    const cpf = getEffectiveProfessorCpf(req)
    const turmaId = Number(req.query.turmaId)
    const alunoId = Number(req.params.alunoId)
    if (!turmaId || !alunoId) return res.status(400).json({ error: 'Turma ou aluno inválido' })

    const ok = await assertTurmaAssignment(cpf, turmaId)
    if (!ok) return res.status(403).json({ error: 'Acesso negado a esta turma' })

    const pool = getPgPool()
    const [necessidadesRes, contextoRes] = await Promise.all([
      pool.query(
        `
        SELECT
          id_necespecifica::text AS "necessidadeId",
          tipo,
          descricao_outros AS "descricaoOutros"
        FROM public.aluno_necessidades_especificas
        WHERE id_aluno = $1
          AND id_turma = $2
          AND regexp_replace(cpf_professor, '\\D', '', 'g') = $3
        ORDER BY id_aluno_necespecifica
        `,
        [alunoId, turmaId, cpf]
      ),
      pool.query(
        `
        SELECT
          paee,
          estudo_caso AS "estudoCaso",
          apoio_pedagogico AS "apoioPedagogico"
        FROM public.aluno_necessidades_contexto
        WHERE id_aluno = $1
          AND id_turma = $2
          AND regexp_replace(cpf_professor, '\\D', '', 'g') = $3
        LIMIT 1
        `,
        [alunoId, turmaId, cpf]
      ),
    ])

    res.json({
      contexto: contextoRes.rows[0] || null,
      necessidades: necessidadesRes.rows,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar necessidades do aluno' })
  }
})

export default router
