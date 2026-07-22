import { Router, Response } from 'express'
import { authMiddleware, AuthRequest, getAuthenticatedCpf } from '../middleware/auth'
import { getPgPool } from '../services/pgPool'
import { canViewResultados, ensureUsuariosAcessosTable, getCoordenadorEscolaIds, getResultadosAllowedCpfs, normalizarCpf, usuarioTemPerfil } from '../services/permissions'
import { getFaseAtual, listarFases } from '../services/avaliacaoFases'

const router = Router()
router.use(authMiddleware)

const STATUS_VALIDOS = new Set(['FINALIZADO', 'RASCUNHO', 'TODOS'])
const VISOES_VALIDAS = new Set(['GERAL', 'ESCOLA', 'PROFESSOR'])

function opcaoIndicaDificuldade(sigla: string) {
  const chave = (sigla || '').toUpperCase()
  return ['PEA-NDA', 'PEA-TD', 'PEA-PD', 'NDA', 'ND', 'MD/ME', 'TD', 'PD', 'NSF', 'SFP'].includes(chave)
}

function opcaoIndicaDominio(sigla: string) {
  const chave = (sigla || '').toUpperCase()
  return ['PEA-D', 'D', 'SF', 'SIM'].includes(chave)
}

function pct(parte: number, total: number) {
  return total ? Math.round((parte / total) * 100) : 0
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      turmaId,
      escolaId,
      professorCpf,
      faseId,
      status,
      visao,
    } = req.query as {
      turmaId?: string
      escolaId?: string
      professorCpf?: string
      faseId?: string
      status?: string
      visao?: string
    }

    const statusNormalizado = String(status || 'TODOS').toUpperCase()
    const statusFiltro = STATUS_VALIDOS.has(statusNormalizado) ? statusNormalizado : 'TODOS'
    const visaoNormalizada = String(visao || 'GERAL').toUpperCase()
    const visaoAtual = VISOES_VALIDAS.has(visaoNormalizada) ? visaoNormalizada : 'GERAL'
    const professorFiltro = normalizarCpf(professorCpf || '')
    const fases = await listarFases()
    const faseAtual = faseId ? fases.find((fase) => String(fase.id) === String(faseId)) || await getFaseAtual() : await getFaseAtual()
    const administradoresResultados = getResultadosAllowedCpfs()
    const authenticatedCpf = getAuthenticatedCpf(req)
    await ensureUsuariosAcessosTable()
    const isAdministradorResultados = canViewResultados(authenticatedCpf) || await usuarioTemPerfil(authenticatedCpf, ['SUPERADMIN', 'ADMINISTRADOR'])
    const coordenadorEscolaIds = isAdministradorResultados ? [] : await getCoordenadorEscolaIds(authenticatedCpf)
    const professorEscopoCpf = !isAdministradorResultados && coordenadorEscolaIds.length === 0 ? authenticatedCpf : ''

    const scopeWhere: string[] = [
      `e.projeto = 'PJINSTFONI'`,
      `et.projeto = 'PJINSTFONI'`,
    ]
    const scopeParams: any[] = []

    function addParam(value: any) {
      scopeParams.push(value)
      return `$${scopeParams.length}`
    }

    if (turmaId) {
      scopeWhere.push(`t.id_turma::text = ${addParam(turmaId)}`)
    }

    if (!isAdministradorResultados) {
      if (coordenadorEscolaIds.length > 0) {
        scopeWhere.push(`e.id_escola::text = ANY(${addParam(coordenadorEscolaIds)}::text[])`)
      } else {
        scopeWhere.push(`regexp_replace(ap.cpf_professor::text, '\\D', '', 'g') = ${addParam(professorEscopoCpf)}`)
      }
    }

    if (escolaId || visaoAtual === 'ESCOLA') {
      if (escolaId) scopeWhere.push(`e.id_escola::text = ${addParam(escolaId)}`)
    }

    if (!professorEscopoCpf && (professorFiltro || visaoAtual === 'PROFESSOR')) {
      if (professorFiltro) scopeWhere.push(`regexp_replace(ap.cpf_professor::text, '\\D', '', 'g') = ${addParam(professorFiltro)}`)
    }

    if (administradoresResultados.length > 0) {
      scopeWhere.push(`regexp_replace(ap.cpf_professor::text, '\\D', '', 'g') <> ALL(${addParam(administradoresResultados)}::text[])`)
    }

    scopeWhere.push(`
      NOT EXISTS (
        SELECT 1
        FROM public.usuarios_acessos ua_admin
        WHERE ua_admin.cpf_usuario = regexp_replace(ap.cpf_professor::text, '\\D', '', 'g')
          AND ua_admin.ativo = true
          AND ua_admin.perfil IN ('SUPERADMIN', 'ADMINISTRADOR')
      )
    `)

    const distribuicaoParams = [...scopeParams]
    const statusWhere = statusFiltro === 'TODOS' ? '' : `AND s.status = $${distribuicaoParams.push(statusFiltro)}`

    const scopeCte = `
      WITH scope AS (
        SELECT DISTINCT
          regexp_replace(ap.cpf_professor::text, '\\D', '', 'g') AS cpf_professor,
          COALESCE(NULLIF(trim(p.profissional_nome_social::text), ''), NULLIF(trim(p.profissional_nome::text), ''), ap.cpf_professor::text) AS professor_nome,
          e.id_escola::text AS escola_id,
          e.nome_escola::text AS escola_nome,
          t.id_turma::text AS turma_id,
          ('Turma ' || COALESCE(NULLIF(et.descricao::text, ''), 'Etapa nao informada') || ' ' || COALESCE(NULLIF(t.letra_turma::text, ''), t.id_turma::text))::text AS turma_nome,
          t.turno::text AS turno,
          et.descricao::text AS etapa_descricao
        FROM public.atribuicao_professor ap
        JOIN public.turmas t ON t.id_turma = ap.id_turma
        JOIN public.escolas e ON e.id_escola = t.id_escola
        JOIN public.etapas et ON et.id_etapa = t.id_etapa
        LEFT JOIN public.professores p
          ON regexp_replace(p.profissional_cpf::text, '\\D', '', 'g') = regexp_replace(ap.cpf_professor::text, '\\D', '', 'g')
        WHERE ${scopeWhere.join(' AND ')}
      )
    `

    const pool = getPgPool()

    const [
      filtrosRes,
      resumoRes,
      statusRes,
      distribuicaoRes,
      escolasResumoRes,
      professoresResumoRes,
      pendenciasResumoRes,
    ] = await Promise.all([
      pool.query(
        `
        ${scopeCte}
        SELECT DISTINCT
          escola_id AS "escolaId",
          escola_nome AS "escolaNome",
          turma_id AS "turmaId",
          turma_nome AS "turmaNome",
          turno,
          etapa_descricao AS "etapaDescricao",
          cpf_professor AS "professorCpf",
          professor_nome AS "professorNome"
        FROM scope
        ORDER BY escola_nome NULLS LAST, turma_nome NULLS LAST, professor_nome NULLS LAST
        `,
        scopeParams
      ),
      pool.query(
        `
        ${scopeCte}
        SELECT
          COUNT(DISTINCT ea.id_aluno)::int AS "totalAlunos",
          COUNT(DISTINCT sc.turma_id)::int AS "totalTurmas",
          COUNT(DISTINCT sc.escola_id)::int AS "totalEscolas",
          COUNT(DISTINCT sc.cpf_professor)::int AS "totalProfessores",
          COUNT(DISTINCT ea.id_aluno)::int AS "avaliacoesEsperadas",
          COUNT(DISTINCT ea.id_aluno) FILTER (WHERE s.status = 'FINALIZADO')::int AS "finalizados",
          COUNT(DISTINCT ea.id_aluno) FILTER (WHERE s.status = 'RASCUNHO')::int AS "rascunhos",
          COUNT(DISTINCT ea.id_aluno) FILTER (WHERE s.id IS NOT NULL)::int AS "submissoes",
          COUNT(ar.id_pergunta)::int AS "respostas"
        FROM scope sc
        LEFT JOIN public.enturmacao_aluno ea ON ea.id_turma::text = sc.turma_id
        LEFT JOIN public.submissoes_pg s
          ON regexp_replace(s.cpf_professor::text, '\\D', '', 'g') = sc.cpf_professor
         AND s.id_turma::text = sc.turma_id
         AND s.id_aluno = ea.id_aluno
         AND s.id_fase = $${scopeParams.length + 1}
        LEFT JOIN public.avaliacao_respostas ar
          ON regexp_replace(ar.cpf_professor::text, '\\D', '', 'g') = regexp_replace(s.cpf_professor::text, '\\D', '', 'g')
         AND ar.id_aluno = s.id_aluno
         AND ar.id_turma::text = sc.turma_id
         AND ar.id_fase = s.id_fase
        `,
        [...scopeParams, faseAtual.id]
      ),
      pool.query(
        `
        ${scopeCte}
        SELECT
          status,
          COUNT(*)::int AS total
        FROM (
          SELECT
            ea.id_aluno,
            CASE
              WHEN BOOL_OR(s.status = 'FINALIZADO') THEN 'FINALIZADO'
              WHEN BOOL_OR(s.status = 'RASCUNHO') THEN 'RASCUNHO'
              ELSE 'PENDENTE'
            END AS status
          FROM scope sc
          LEFT JOIN public.enturmacao_aluno ea ON ea.id_turma::text = sc.turma_id
          LEFT JOIN public.submissoes_pg s
            ON regexp_replace(s.cpf_professor::text, '\\D', '', 'g') = sc.cpf_professor
           AND s.id_turma::text = sc.turma_id
           AND s.id_aluno = ea.id_aluno
           AND s.id_fase = $${scopeParams.length + 1}
          WHERE ea.id_aluno IS NOT NULL
          GROUP BY ea.id_aluno
        ) alunos_status
        GROUP BY status
        `,
        [...scopeParams, faseAtual.id]
      ),
      pool.query(
        `
        ${scopeCte}
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
        FROM scope sc
        JOIN public.submissoes_pg s
          ON regexp_replace(s.cpf_professor::text, '\\D', '', 'g') = sc.cpf_professor
         AND s.id_turma::text = sc.turma_id
         AND s.id_fase = $${distribuicaoParams.length + 1}
        JOIN public.avaliacao_respostas ar
          ON regexp_replace(ar.cpf_professor::text, '\\D', '', 'g') = regexp_replace(s.cpf_professor::text, '\\D', '', 'g')
         AND ar.id_aluno = s.id_aluno
         AND ar.id_turma::text = sc.turma_id
         AND ar.id_fase = s.id_fase
        JOIN public.avaliacao_perguntas p ON p.id_pergunta = ar.id_pergunta
        JOIN public.avaliacao_grupos g ON g.id_grupo = p.id_grupo
        JOIN public.avaliacao_opcoes o ON o.id_opcao = ar.id_opcao
        WHERE 1 = 1
          ${statusWhere}
        GROUP BY g.id_grupo, g.nome_grupo, p.id_pergunta, p.texto_pergunta, p.tipo_escala,
                 o.id_opcao, o.sigla, o.descricao, o.cor_hex, o.simbolo
        ORDER BY g.id_grupo, p.id_pergunta, o.id_opcao
        `,
        [...distribuicaoParams, faseAtual.id]
      ),
      pool.query(
        `
        ${scopeCte}
        SELECT
          sc.escola_id AS id,
          sc.escola_nome AS nome,
          COUNT(DISTINCT ea.id_aluno)::int AS "totalAlunos",
          COUNT(DISTINCT sc.turma_id)::int AS "totalTurmas",
          COUNT(DISTINCT ea.id_aluno)::int AS "avaliacoesEsperadas",
          COUNT(DISTINCT ea.id_aluno) FILTER (WHERE s.status = 'FINALIZADO')::int AS finalizados
        FROM scope sc
        LEFT JOIN public.enturmacao_aluno ea ON ea.id_turma::text = sc.turma_id
        LEFT JOIN public.submissoes_pg s
          ON regexp_replace(s.cpf_professor::text, '\\D', '', 'g') = sc.cpf_professor
         AND s.id_turma::text = sc.turma_id
         AND s.id_aluno = ea.id_aluno
         AND s.id_fase = $${scopeParams.length + 1}
        GROUP BY sc.escola_id, sc.escola_nome
        ORDER BY sc.escola_nome NULLS LAST
        LIMIT 100
        `,
        [...scopeParams, faseAtual.id]
      ),
      pool.query(
        `
        ${scopeCte}
        SELECT
          sc.cpf_professor AS cpf,
          sc.professor_nome AS nome,
          COUNT(DISTINCT sc.escola_id)::int AS "totalEscolas",
          COUNT(DISTINCT sc.turma_id)::int AS "totalTurmas",
          COUNT(DISTINCT ea.id_aluno)::int AS "totalAlunos",
          COUNT(DISTINCT ea.id_aluno)::int AS "avaliacoesEsperadas",
          COUNT(DISTINCT ea.id_aluno) FILTER (WHERE s.status = 'FINALIZADO')::int AS finalizados
        FROM scope sc
        LEFT JOIN public.enturmacao_aluno ea ON ea.id_turma::text = sc.turma_id
        LEFT JOIN public.submissoes_pg s
          ON regexp_replace(s.cpf_professor::text, '\\D', '', 'g') = sc.cpf_professor
         AND s.id_turma::text = sc.turma_id
         AND s.id_aluno = ea.id_aluno
         AND s.id_fase = $${scopeParams.length + 1}
        GROUP BY sc.cpf_professor, sc.professor_nome
        ORDER BY sc.professor_nome NULLS LAST
        LIMIT 200
        `,
        [...scopeParams, faseAtual.id]
      ),
      pool.query(
        `
        ${scopeCte}
        SELECT
          sc.escola_id AS "escolaId",
          sc.escola_nome AS "escolaNome",
          sc.turma_id AS "turmaId",
          sc.turma_nome AS "turmaNome",
          sc.turno,
          COUNT(DISTINCT ea.id_aluno)::int AS "avaliacoesEsperadas",
          COUNT(DISTINCT ea.id_aluno) FILTER (WHERE s.id IS NOT NULL)::int AS "submissoes",
          COUNT(DISTINCT ea.id_aluno)::int - COUNT(DISTINCT ea.id_aluno) FILTER (WHERE s.id IS NOT NULL)::int AS pendentes
        FROM scope sc
        LEFT JOIN public.enturmacao_aluno ea ON ea.id_turma::text = sc.turma_id
        LEFT JOIN public.submissoes_pg s
          ON regexp_replace(s.cpf_professor::text, '\\D', '', 'g') = sc.cpf_professor
         AND s.id_turma::text = sc.turma_id
         AND s.id_aluno = ea.id_aluno
         AND s.id_fase = $${scopeParams.length + 1}
        GROUP BY sc.escola_id, sc.escola_nome, sc.turma_id, sc.turma_nome, sc.turno
        HAVING COUNT(DISTINCT ea.id_aluno)::int - COUNT(DISTINCT ea.id_aluno) FILTER (WHERE s.id IS NOT NULL)::int > 0
        ORDER BY pendentes DESC, sc.escola_nome NULLS LAST, sc.turma_nome NULLS LAST
        LIMIT 200
        `,
        [...scopeParams, faseAtual.id]
      ),
    ])

    const perguntas = new Map<string, any>()
    const grupos = new Map<string, any>()
    const opcoesResumo = new Map<string, any>()

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

      const total = Number(row.total || 0)
      const pergunta = perguntas.get(perguntaKey)
      pergunta.total += total
      if (opcaoIndicaDominio(row.sigla)) pergunta.dominio += total
      if (opcaoIndicaDificuldade(row.sigla)) pergunta.dificuldade += total

      const opcao = {
        id: String(row.opcaoId),
        sigla: row.sigla || '',
        descricao: row.descricao || '',
        corHex: row.corHex || null,
        simbolo: row.simbolo || row.sigla || '',
        total,
      }
      pergunta.opcoes.push(opcao)

      const opcaoKey = String(row.opcaoId)
      if (!opcoesResumo.has(opcaoKey)) {
        opcoesResumo.set(opcaoKey, { ...opcao, total: 0 })
      }
      opcoesResumo.get(opcaoKey).total += total
    }

    for (const pergunta of perguntas.values()) {
      pergunta.percentualDominio = pct(pergunta.dominio, pergunta.total)
      pergunta.percentualDificuldade = pct(pergunta.dificuldade, pergunta.total)

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
      percentualDominio: pct(grupo.dominio, grupo.total),
      percentualDificuldade: pct(grupo.dificuldade, grupo.total),
    }))

    const habilidadesCriticas = Array.from(perguntas.values())
      .filter((pergunta) => pergunta.total > 0)
      .sort((a, b) => b.percentualDificuldade - a.percentualDificuldade || b.dificuldade - a.dificuldade)
      .slice(0, 12)

    const resumo = resumoRes.rows[0] || {}
    const avaliacoesEsperadas = Number(resumo.avaliacoesEsperadas || 0)
    const finalizados = Number(resumo.finalizados || 0)
    const rascunhos = Number(resumo.rascunhos || 0)
    const submissoes = Number(resumo.submissoes || 0)
    const pendentes = Math.max(avaliacoesEsperadas - submissoes, 0)

    const escolasMap = new Map<string, { id: string; nome: string }>()
    const turmasMap = new Map<string, any>()
    const professoresMap = new Map<string, { cpf: string; nome: string }>()
    for (const row of filtrosRes.rows) {
      if (row.escolaId && !escolasMap.has(row.escolaId)) {
        escolasMap.set(row.escolaId, { id: row.escolaId, nome: row.escolaNome || 'Escola sem nome' })
      }
      if (row.turmaId && !turmasMap.has(row.turmaId)) {
        turmasMap.set(row.turmaId, {
          id: row.turmaId,
          nome: row.turmaNome,
          escolaId: row.escolaId,
          escolaNome: row.escolaNome,
          etapaDescricao: row.etapaDescricao,
          turno: row.turno,
        })
      }
      if (row.professorCpf && !professoresMap.has(row.professorCpf)) {
        professoresMap.set(row.professorCpf, { cpf: row.professorCpf, nome: row.professorNome || row.professorCpf })
      }
    }

    return res.json({
      filtros: {
        visao: visaoAtual,
        status: statusFiltro,
        escolas: Array.from(escolasMap.values()),
        turmas: Array.from(turmasMap.values()),
        professores: Array.from(professoresMap.values()),
        fases,
        faseAtual,
      },
      resumo: {
        totalAlunos: Number(resumo.totalAlunos || 0),
        totalTurmas: Number(resumo.totalTurmas || 0),
        totalEscolas: Number(resumo.totalEscolas || 0),
        totalProfessores: Number(resumo.totalProfessores || 0),
        avaliacoesEsperadas,
        finalizados,
        rascunhos,
        submissoes,
        pendentes,
        respostas: Number(resumo.respostas || 0),
        percentualFinalizacao: pct(finalizados, avaliacoesEsperadas),
      },
      statusResumo: statusRes.rows.map((row) => ({
        status: row.status,
        total: Number(row.total || 0),
        percentual: pct(Number(row.total || 0), avaliacoesEsperadas),
      })),
      opcoesResumo: Array.from(opcoesResumo.values())
        .sort((a, b) => b.total - a.total || String(a.sigla).localeCompare(String(b.sigla))),
      eixos,
      habilidadesCriticas,
      escolasResumo: escolasResumoRes.rows.map((row) => ({
        id: row.id,
        nome: row.nome || 'Escola sem nome',
        totalAlunos: Number(row.totalAlunos || 0),
        totalTurmas: Number(row.totalTurmas || 0),
        avaliacoesEsperadas: Number(row.avaliacoesEsperadas || 0),
        finalizados: Number(row.finalizados || 0),
        percentualFinalizacao: pct(Number(row.finalizados || 0), Number(row.avaliacoesEsperadas || 0)),
      })),
      professoresResumo: professoresResumoRes.rows.map((row) => ({
        cpf: row.cpf,
        nome: row.nome || row.cpf,
        totalEscolas: Number(row.totalEscolas || 0),
        totalTurmas: Number(row.totalTurmas || 0),
        totalAlunos: Number(row.totalAlunos || 0),
        avaliacoesEsperadas: Number(row.avaliacoesEsperadas || 0),
        finalizados: Number(row.finalizados || 0),
        percentualFinalizacao: pct(Number(row.finalizados || 0), Number(row.avaliacoesEsperadas || 0)),
      })),
      pendenciasResumo: pendenciasResumoRes.rows.map((row) => ({
        escolaId: row.escolaId,
        escolaNome: row.escolaNome || 'Escola sem nome',
        turmaId: row.turmaId,
        turmaNome: row.turmaNome || 'Turma sem nome',
        turno: row.turno || '',
        avaliacoesEsperadas: Number(row.avaliacoesEsperadas || 0),
        submissoes: Number(row.submissoes || 0),
        pendentes: Number(row.pendentes || 0),
        percentualPendente: pct(Number(row.pendentes || 0), Number(row.avaliacoesEsperadas || 0)),
      })),
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao calcular resultados' })
  }
})

export default router
