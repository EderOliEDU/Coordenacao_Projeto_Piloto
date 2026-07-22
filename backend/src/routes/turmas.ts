import { Router, Response } from 'express'
import { authMiddleware, AuthRequest, getAuthenticatedCpf, getEffectiveProfessorCpf, isViewOnlyMode } from '../middleware/auth'
import { isAdministrador, usuarioTemPerfil } from '../services/permissions'
import { getPgPool } from '../services/pgPool'
import { getFaseAtual } from '../services/avaliacaoFases'

const router = Router()
router.use(authMiddleware)

/**
 * Retorno compatível com o frontend:
 * {
 *   id, nome, anoLetivo, turno,
 *   escola: { id, nome },
 *   _count: { alunos }
 * }
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const authenticatedCpf = getAuthenticatedCpf(req)
    const cpf = getEffectiveProfessorCpf(req)
    if (!cpf) return res.status(400).json({ error: 'CPF do professor ausente no token' })
    const canViewAll = (Boolean(req.professor?.permissoes?.administrador) || isAdministrador(authenticatedCpf) || await usuarioTemPerfil(authenticatedCpf, ['SUPERADMIN', 'ADMINISTRADOR'])) && !isViewOnlyMode(req)

    const pool = getPgPool()
    const faseAtual = await getFaseAtual()

    const { rows } = await pool.query<{
      id: string
      nome: string
      turno: string | null
      escola_id: string
      escola_nome: string
      etapa_descricao: string | null
      alunos_count: string
      finalizados_count: string
    }>(
      `
      SELECT
        t.id_turma::text                                   AS id,
        ('Turma ' || COALESCE(NULLIF(et.descricao, ''), 'Etapa não informada') || ' ' || COALESCE(NULLIF(t.letra_turma, ''), t.id_turma::text))::text AS nome,
        t.turno::text                                      AS turno,
        e.id_escola::text                                  AS escola_id,
        e.nome_escola::text                                AS escola_nome,
        et.descricao::text                                 AS etapa_descricao,
        COUNT(DISTINCT ea.id_aluno)::text                  AS alunos_count,
        COUNT(DISTINCT ea.id_aluno) FILTER (WHERE s.status = 'FINALIZADO')::text AS finalizados_count
      FROM public.turmas t
      JOIN public.escolas e ON e.id_escola = t.id_escola
      JOIN public.etapas et ON et.id_etapa = t.id_etapa
      LEFT JOIN public.atribuicao_professor ap ON ap.id_turma = t.id_turma
      LEFT JOIN public.enturmacao_aluno ea ON ea.id_turma = t.id_turma
      LEFT JOIN public.submissoes_pg s
        ON regexp_replace(s.cpf_professor::text, '\\D', '', 'g') = regexp_replace(ap.cpf_professor::text, '\\D', '', 'g')
       AND s.id_turma = t.id_turma
       AND s.id_aluno = ea.id_aluno
       AND s.id_fase = $3
      WHERE ($2::boolean = true OR regexp_replace(ap.cpf_professor, '\\D', '', 'g') = $1)
        AND e.projeto = 'PJINSTFONI'
        AND et.projeto = 'PJINSTFONI'
      GROUP BY t.id_turma, t.letra_turma, t.turno, e.id_escola, e.nome_escola, et.descricao
      ORDER BY e.nome_escola NULLS LAST, et.descricao NULLS LAST, t.letra_turma NULLS LAST, t.id_turma;
      `,
      [cpf, canViewAll, faseAtual.id]
    )

    const turmas = rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      // seu schema não tem anoLetivo; devolvemos o ano atual para não quebrar o frontend
      anoLetivo: new Date().getFullYear(),
      turno: (r.turno || 'MANHA'),
      etapaDescricao: r.etapa_descricao || '',
      escola: { id: r.escola_id || '', nome: r.escola_nome || '' },
      _count: {
        alunos: Number(r.alunos_count || 0),
        finalizados: Number(r.finalizados_count || 0),
      },
      percentualConcluido: Number(r.alunos_count || 0)
        ? Math.round((Number(r.finalizados_count || 0) / Number(r.alunos_count || 0)) * 100)
        : 0,
    }))

    res.json(turmas)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar turmas' })
  }
})

router.get('/:id/alunos', async (req: AuthRequest, res: Response) => {
  try {
    const turmaId = req.params.id
    const authenticatedCpf = getAuthenticatedCpf(req)
    const cpf = getEffectiveProfessorCpf(req)
    if (!cpf) return res.status(400).json({ error: 'CPF do professor ausente no token' })
    const canViewAll = (Boolean(req.professor?.permissoes?.administrador) || isAdministrador(authenticatedCpf) || await usuarioTemPerfil(authenticatedCpf, ['SUPERADMIN', 'ADMINISTRADOR'])) && !isViewOnlyMode(req)

    const pool = getPgPool()

    // checa se o professor tem essa turma atribuída
    const check = await pool.query(
      `
      SELECT 1
      FROM public.atribuicao_professor ap
      JOIN public.turmas t ON t.id_turma = ap.id_turma
      JOIN public.escolas e ON e.id_escola = t.id_escola
      JOIN public.etapas et ON et.id_etapa = t.id_etapa
      WHERE ($3::boolean = true OR regexp_replace(ap.cpf_professor, '\\D', '', 'g') = $1)
        AND ap.id_turma::text = $2
        AND e.projeto = 'PJINSTFONI'
        AND et.projeto = 'PJINSTFONI'
      LIMIT 1
      `,
      [cpf, turmaId, canViewAll]
    )
    if (check.rowCount === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta turma' })
    }

    const { rows } = await pool.query<{
      id: string
      nome: string | null
      cpf: string | null
      inep: string | null
      situacao: string | null
    }>(
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

    // frontend espera pelo menos {id, nome}. Campos extras não atrapalham.
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar alunos' })
  }
})

export default router
