import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { getPgPool } from '../services/pgPool'

const router = Router()
router.use(authMiddleware)
const PROJECT_CODE = 'PJINSTFONI'

/**
 * Retorno compatível com o frontend:
 * {
 *   id, nome, anoLetivo, turno,
 *   escola: { id, nome },
 *   _count: { alunos }
 *   finalizados: number
 *   faltando: number
 * }
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const cpf = (req.professor?.login ?? '').replace(/\D/g, '')
    if (!cpf) return res.status(400).json({ error: 'CPF do professor ausente no token' })

    const pool = getPgPool()

    // Busca turmas e quantidade total de alunos (igual original) + subquery para finalizados
    const { rows } = await pool.query<{
      id: string
      nome: string
      turno: string | null
      escola_id: string
      escola_nome: string
      alunos_count: number
      finalizados_count: number
    }>(
      `
        SELECT
          t.id_turma::text AS id,
          ('Turma ' || COALESCE(t.letra_turma, t.id_turma::text))::text AS nome,
          t.turno::text AS turno,
          e.id_escola::text AS escola_id,
          e.nome_escola::text AS escola_nome,
          COUNT(DISTINCT ea.id_aluno)::int AS alunos_count,
          COUNT(DISTINCT CASE
              WHEN ar.status != 'RASCUNHO' AND ar.id_aluno IS NOT NULL THEN ea.id_aluno
          END)::int AS finalizados_count
          FROM public.atribuicao_professor ap
          JOIN public.turmas t ON t.id_turma = ap.id_turma
          LEFT JOIN public.escolas e ON e.id_escola = t.id_escola
          LEFT JOIN public.enturmacao_aluno ea ON ea.id_turma = t.id_turma
          LEFT JOIN public.avaliacao_respostas ar ON ar.id_aluno = ea.id_aluno
          WHERE ap.cpf_professor = $1
            AND e.projeto = $2
          GROUP BY t.id_turma, t.letra_turma, t.turno, e.id_escola, e.nome_escola
          ORDER BY e.nome_escola NULLS LAST, t.letra_turma NULLS LAST, t.id_turma;
          `,
          [cpf, PROJECT_CODE]
    )

    const turmas = rows.map((r) => {
      const totalAlunos = Number(r.alunos_count || 0)
      const totalFinalizados = Number(r.finalizados_count || 0)
      return {
        id: r.id,
        nome: r.nome,
        anoLetivo: new Date().getFullYear(),
        turno: (r.turno || 'MANHA'),
        escola: { id: r.escola_id || '', nome: r.escola_nome || '' },
        _count: { alunos: totalAlunos },
        finalizados: totalFinalizados,
        faltando: totalAlunos - totalFinalizados
      };
    });

    res.json(turmas)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar turmas' })
  }
})

// ...o restante do arquivo permanece igual!
router.get('/:id/alunos', async (req: AuthRequest, res: Response) => {
  try {
    const turmaId = req.params.id
    const cpf = (req.professor?.login ?? '').replace(/\D/g, '')
    if (!cpf) return res.status(400).json({ error: 'CPF do professor ausente no token' })

    const pool = getPgPool()

    const check = await pool.query(
      `
      SELECT 1
      FROM public.atribuicao_professor ap
      JOIN public.turmas t ON t.id_turma = ap.id_turma
      JOIN public.escolas e ON e.id_escola = t.id_escola
      WHERE ap.cpf_professor = $1
        AND ap.id_turma::text = $2
        AND e.projeto = $3
      LIMIT 1
      `,
      [cpf, turmaId, PROJECT_CODE]
    )

    if (check.rowCount === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta turma' })
    }

    const { rows } = await pool.query(
      `
      SELECT
        a.id_aluno::text AS id,
        a.nome::text     AS nome,
        a.cpf::text      AS cpf,
        a.inep::text     AS inep,
        a.situacao::text AS situacao
      FROM public.enturmacao_aluno ea
      JOIN public.alunos a ON a.id_aluno = ea.id_aluno
      WHERE ea.id_turma::text = $1
      ORDER BY a.nome;
      `,
      [turmaId]
    )

    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar alunos' })
  }
})

export default router
