import { Router, Response } from 'express'
import { authMiddleware, resultadosAccessMiddleware, AuthRequest } from '../middleware/auth'
import { getPgPool } from '../services/pgPool'

const router = Router()
router.use(authMiddleware)
router.use(resultadosAccessMiddleware)

function normalizarCpf(value: string) {
  return (value || '').replace(/\D/g, '')
}

function opcaoIndicaDificuldade(sigla: string) {
  const chave = (sigla || '').toUpperCase()
  return ['PEA-NDA', 'PEA-TD', 'PEA-PD', 'NDA', 'ND', 'MD/ME', 'TD', 'PD', 'NSF', 'SFP'].includes(chave)
}

function opcaoIndicaDominio(sigla: string) {
  const chave = (sigla || '').toUpperCase()
  return ['PEA-D', 'D', 'SF', 'SIM'].includes(chave)
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const cpf = normalizarCpf(req.professor?.login || '')
    if (!cpf) return res.status(400).json({ error: 'CPF do professor ausente no token' })

    const { turmaId, escolaId, status } = req.query as {
      turmaId?: string
      escolaId?: string
      status?: string
    }

    const pool = getPgPool()

    const scopeWhere: string[] = [
      'ap.cpf_professor = $1',
      `e.projeto = 'PJINSTFONI'`,
      `et.projeto = 'PJINSTFONI'`,
    ]
    const scopeParams: any[] = [cpf]
    let idx = 2

    if (turmaId) {
      scopeWhere.push(`t.id_turma::text = $${idx++}`)
      scopeParams.push(turmaId)
    }

    if (escolaId) {
      scopeWhere.push(`e.id_escola::text = $${idx++}`)
      scopeParams.push(escolaId)
    }

    const statusNormalizado = (status || 'FINALIZADO').toUpperCase()
    const filtrarStatus = statusNormalizado !== 'TODOS'

    const statusWhere = filtrarStatus ? `AND s.status = $${idx}` : ''
    const queryParams = filtrarStatus ? [...scopeParams, statusNormalizado] : scopeParams

    const [filtrosRes, resumoRes, distribuicaoRes] = await Promise.all([
      pool.query(
        `
        SELECT DISTINCT
          e.id_escola::text AS "escolaId",
          e.nome_escola::text AS "escolaNome",
          t.id_turma::text AS "turmaId",
          ('Turma ' || COALESCE(NULLIF(et.descricao, ''), 'Etapa não informada') || ' ' || COALESCE(NULLIF(t.letra_turma, ''), t.id_turma::text))::text AS "turmaNome",
          t.letra_turma::text AS "turmaLetra",
          et.descricao::text AS "etapaDescricao",
          t.turno::text AS "turno"
        FROM public.atribuicao_professor ap
        JOIN public.turmas t ON t.id_turma = ap.id_turma
        JOIN public.escolas e ON e.id_escola = t.id_escola
        JOIN public.etapas et ON et.id_etapa = t.id_etapa
        WHERE ${scopeWhere.join(' AND ')}
        ORDER BY e.nome_escola NULLS LAST, et.descricao::text NULLS LAST, t.letra_turma::text NULLS LAST, t.id_turma::text
        `,
        scopeParams
      ),
      pool.query(
        `
        SELECT
          COUNT(DISTINCT ea.id_aluno)::int AS "totalAlunos",
          COUNT(DISTINCT t.id_turma)::int AS "totalTurmas",
          COUNT(DISTINCT e.id_escola)::int AS "totalEscolas",
          COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'FINALIZADO')::int AS "finalizados",
          COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'RASCUNHO')::int AS "rascunhos",
          COUNT(DISTINCT s.id)::int AS "submissoes",
          COUNT(ar.id_pergunta)::int AS "respostas"
        FROM public.atribuicao_professor ap
        JOIN public.turmas t ON t.id_turma = ap.id_turma
        JOIN public.escolas e ON e.id_escola = t.id_escola
        JOIN public.etapas et ON et.id_etapa = t.id_etapa
        LEFT JOIN public.enturmacao_aluno ea ON ea.id_turma = t.id_turma
        LEFT JOIN public.submissoes_pg s
          ON s.cpf_professor = ap.cpf_professor
         AND s.id_turma = t.id_turma
         AND s.id_aluno = ea.id_aluno
        LEFT JOIN public.avaliacao_respostas ar
          ON ar.cpf_professor = s.cpf_professor
         AND ar.id_aluno = s.id_aluno
        WHERE ${scopeWhere.join(' AND ')}
        `,
        scopeParams
      ),
      pool.query(
        `
        SELECT
          g.id_grupo::int AS "grupoId",
          g.nome_grupo::text AS "grupoNome",
          p.id_pergunta::int AS "perguntaId",
          p.texto_pergunta::text AS "perguntaTexto",
          p.tipo_escala::text AS "tipoEscala",
          o.id_opcao::int AS "opcaoId",
          o.sigla::text AS "sigla",
          o.descricao::text AS "descricao",
          o.cor_hex::text AS "corHex",
          o.simbolo::text AS "simbolo",
          COUNT(*)::int AS "total"
        FROM public.atribuicao_professor ap
        JOIN public.turmas t ON t.id_turma = ap.id_turma
        JOIN public.escolas e ON e.id_escola = t.id_escola
        JOIN public.etapas et ON et.id_etapa = t.id_etapa
        JOIN public.submissoes_pg s
          ON s.cpf_professor = ap.cpf_professor
         AND s.id_turma = t.id_turma
        JOIN public.avaliacao_respostas ar
          ON ar.cpf_professor = s.cpf_professor
         AND ar.id_aluno = s.id_aluno
        JOIN public.avaliacao_perguntas p ON p.id_pergunta = ar.id_pergunta
        JOIN public.avaliacao_grupos g ON g.id_grupo = p.id_grupo
        JOIN public.avaliacao_opcoes o ON o.id_opcao = ar.id_opcao
        WHERE ${scopeWhere.join(' AND ')}
          ${statusWhere}
        GROUP BY g.id_grupo, g.nome_grupo, p.id_pergunta, p.texto_pergunta, p.tipo_escala,
                 o.id_opcao, o.sigla, o.descricao, o.cor_hex, o.simbolo
        ORDER BY g.id_grupo, p.id_pergunta, o.id_opcao
        `,
        queryParams
      ),
    ])

    const resumo = resumoRes.rows[0] || {}
    const totalAlunos = Number(resumo.totalAlunos || 0)
    const finalizados = Number(resumo.finalizados || 0)

    const perguntas = new Map<string, any>()
    const grupos = new Map<string, any>()

    for (const row of distribuicaoRes.rows) {
      const perguntaKey = String(row.perguntaId)
      if (!perguntas.has(perguntaKey)) {
        perguntas.set(perguntaKey, {
          grupoId: String(row.grupoId),
          grupoNome: row.grupoNome,
          perguntaId: String(row.perguntaId),
          perguntaTexto: row.perguntaTexto,
          tipoEscala: row.tipoEscala,
          total: 0,
          dominio: 0,
          dificuldade: 0,
          opcoes: [],
        })
      }

      const pergunta = perguntas.get(perguntaKey)
      const total = Number(row.total || 0)
      pergunta.total += total
      if (opcaoIndicaDominio(row.sigla)) pergunta.dominio += total
      if (opcaoIndicaDificuldade(row.sigla)) pergunta.dificuldade += total

      pergunta.opcoes.push({
        id: String(row.opcaoId),
        sigla: row.sigla || '',
        descricao: row.descricao || '',
        corHex: row.corHex || null,
        simbolo: row.simbolo || row.sigla || '',
        total,
      })
    }

    for (const pergunta of perguntas.values()) {
      pergunta.percentualDominio = pergunta.total ? Math.round((pergunta.dominio / pergunta.total) * 100) : 0
      pergunta.percentualDificuldade = pergunta.total ? Math.round((pergunta.dificuldade / pergunta.total) * 100) : 0

      const grupoKey = pergunta.grupoId
      if (!grupos.has(grupoKey)) {
        grupos.set(grupoKey, {
          id: grupoKey,
          nome: pergunta.grupoNome,
          total: 0,
          dominio: 0,
          dificuldade: 0,
          perguntas: [],
        })
      }

      const grupo = grupos.get(grupoKey)
      grupo.total += pergunta.total
      grupo.dominio += pergunta.dominio
      grupo.dificuldade += pergunta.dificuldade
      grupo.perguntas.push(pergunta)
    }

    const eixos = Array.from(grupos.values()).map((grupo) => ({
      ...grupo,
      percentualDominio: grupo.total ? Math.round((grupo.dominio / grupo.total) * 100) : 0,
      percentualDificuldade: grupo.total ? Math.round((grupo.dificuldade / grupo.total) * 100) : 0,
    }))

    const habilidadesCriticas = Array.from(perguntas.values())
      .filter((pergunta) => pergunta.total > 0)
      .sort((a, b) => b.percentualDificuldade - a.percentualDificuldade || b.dificuldade - a.dificuldade)
      .slice(0, 10)

    const escolasMap = new Map<string, { id: string; nome: string }>()
    for (const row of filtrosRes.rows) {
      if (row.escolaId && !escolasMap.has(row.escolaId)) {
        escolasMap.set(row.escolaId, { id: row.escolaId, nome: row.escolaNome || 'Escola sem nome' })
      }
    }

    return res.json({
      filtros: {
        escolas: Array.from(escolasMap.values()),
        turmas: filtrosRes.rows.map((row) => ({
          id: row.turmaId,
          nome: row.turmaNome,
          escolaId: row.escolaId,
          escolaNome: row.escolaNome,
          etapaDescricao: row.etapaDescricao,
          turno: row.turno,
        })),
        status: statusNormalizado,
      },
      resumo: {
        totalAlunos,
        totalTurmas: Number(resumo.totalTurmas || 0),
        totalEscolas: Number(resumo.totalEscolas || 0),
        finalizados,
        rascunhos: Number(resumo.rascunhos || 0),
        submissoes: Number(resumo.submissoes || 0),
        respostas: Number(resumo.respostas || 0),
        percentualFinalizacao: totalAlunos ? Math.round((finalizados / totalAlunos) * 100) : 0,
      },
      eixos,
      habilidadesCriticas,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao calcular resultados' })
  }
})

export default router
