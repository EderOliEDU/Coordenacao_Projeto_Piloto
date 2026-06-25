const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const { Pool } = require(path.join(root, 'backend', 'node_modules', 'pg'))

const APPLY = process.argv.includes('--apply')
const PROJETO = 'PJINSTFONI'
const ADMIN_CPFS = new Set([
  '65495934172', // Eder
  '05365763190', // Ester
])

const SCHOOL_STOP_WORDS = new Set(
  'ESCOLA MUNICIPAL DE DA DO DAS DOS E EMEB EMEF EMEI CMEI CMEITI EMCEB EMREF EMEFI EDUCACAO BASICA ENSINO FUNDAMENTAL INFANTIL PROFESSOR PROFESSORA PROF CENTRO CAMPO MUNICIPAL'.split(' ')
)

function parseEnv(text) {
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx > -1) out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return out
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function normText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[º°ª]/g, '')
    .replace(/[^A-Z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function normKey(value) {
  return normText(value).replace(/[^A-Z0-9]/g, '')
}

function tokens(value, stopWords = new Set()) {
  return normText(value)
    .split(' ')
    .filter((token) => token && !stopWords.has(token))
}

function similarity(a, b, stopWords = new Set()) {
  const aTokens = new Set(tokens(a, stopWords))
  const bTokens = new Set(tokens(b, stopWords))
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length
  const union = new Set([...aTokens, ...bTokens]).size || 1
  let score = intersection / union
  const normalizedA = normText(a)
  const normalizedB = normText(b)
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) score += 0.25
  return score
}

function resolveEscola(escolaNomeBruto, escolasByName, escolas) {
  const exact = escolasByName.get(normText(escolaNomeBruto)) || []
  if (exact.length > 0) {
    return exact.length === 1
      ? { status: 'ok', escola: exact[0], match: 'exato' }
      : { status: 'escola_ambigua', candidates: exact, match: 'exato' }
  }

  const candidates = escolas
    .map((escola) => ({
      escola,
      score: similarity(escolaNomeBruto, escola.nome_escola, SCHOOL_STOP_WORDS),
    }))
    .filter((candidate) => candidate.score >= 0.55)
    .sort((a, b) => b.score - a.score)

  if (candidates.length === 0) return { status: 'escola_projeto_nao_encontrada', candidates: [] }

  const top = candidates[0]
  const tied = candidates.filter((candidate) => Math.abs(candidate.score - top.score) < 0.001)
  if (tied.length > 1) {
    return { status: 'escola_ambigua', candidates: tied.map((candidate) => candidate.escola), match: 'aproximado' }
  }

  return { status: 'ok', escola: top.escola, match: 'aproximado', score: top.score }
}

function groupBy(rows, keyFn) {
  const map = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (!key) continue
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  return map
}

function uniqueBy(rows, keyFn) {
  const seen = new Set()
  const result = []
  for (const row of rows) {
    const key = keyFn(row)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(row)
  }
  return result
}

function resolveDePara(turmaOriginal, deParaByNorm) {
  const candidates = deParaByNorm.get(normKey(turmaOriginal)) || []
  if (candidates.length === 0) return { status: 'sem_de_para', candidates: [] }

  const uniqueMappings = uniqueBy(candidates, (row) => [
    row.id_etapas ?? '',
    row.id_multi_etapas ?? '',
    row.turma_corrigida ?? '',
  ].join('|'))

  if (uniqueMappings.length > 1) {
    const finalLetter = normText(turmaOriginal).match(/([A-Z])$/)?.[1]
    const byFinalLetter = finalLetter
      ? uniqueMappings.filter((row) => normText(row.turma_corrigida) === finalLetter)
      : []
    if (byFinalLetter.length === 1) {
      return { status: 'ok', mapping: byFinalLetter[0], candidates }
    }
    return { status: 'de_para_ambiguo', candidates: uniqueMappings }
  }

  return { status: 'ok', mapping: uniqueMappings[0], candidates }
}

function resolveTurma(escola, mapping, turmas) {
  let candidates = turmas.filter((turma) => turma.id_escola === escola.id_escola)

  if (mapping.id_etapas !== null && mapping.id_etapas !== undefined) {
    candidates = candidates.filter((turma) => turma.id_etapa === mapping.id_etapas)
  } else if (mapping.id_multi_etapas !== null && mapping.id_multi_etapas !== undefined) {
    candidates = candidates.filter((turma) => turma.id_multi_etapa === mapping.id_multi_etapas)
  }

  if (mapping.turma_corrigida) {
    candidates = candidates.filter((turma) => normText(turma.letra_turma) === normText(mapping.turma_corrigida))
  }

  if (candidates.length === 0) return { status: 'turma_nao_encontrada', candidates: [] }
  if (candidates.length > 1) return { status: 'turma_ambigua', candidates }
  return { status: 'ok', turma: candidates[0] }
}

async function main() {
  const env = parseEnv(fs.readFileSync(path.join(root, 'backend', '.env_dev'), 'utf8'))
  const pool = new Pool({
    host: env.PILOTO_PG_HOST,
    port: Number(env.PILOTO_PG_PORT || 5432),
    database: env.PILOTO_PG_DB,
    user: env.PILOTO_PG_USER,
    password: env.PILOTO_PG_PASSWORD,
    ssl: String(env.PILOTO_PG_SSL || '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined,
  })

  const client = await pool.connect()
  try {
    const designacoesRes = await client.query(`
      SELECT id_designacao, escola_nome_bruto, nome_do_professor, turma_original
      FROM public.designacoes
      ORDER BY id_designacao
    `)
    const professoresRes = await client.query(`
      SELECT profissional_cpf, profissional_nome
      FROM public.professores
    `)
    const escolasRes = await client.query(`
      SELECT id_escola, nome_escola, projeto
      FROM public.escolas
      WHERE projeto = $1
    `, [PROJETO])
    const deParaRes = await client.query(`
      SELECT turma_original, id_multi_etapas, id_etapas, turma_corrigida, obs
      FROM public.de_para_turmas
    `)
    const turmasRes = await client.query(`
      SELECT t.id_turma, t.id_escola, t.id_etapa, t.id_multi_etapa, t.letra_turma, t.turno
      FROM public.turmas t
      JOIN public.escolas e ON e.id_escola = t.id_escola
      WHERE e.projeto = $1
    `, [PROJETO])
    const atribuicoesRes = await client.query(`
      SELECT id_atribuicao, cpf_professor, id_turma
      FROM public.atribuicao_professor
    `)

    const professoresByName = groupBy(professoresRes.rows, (row) => normText(row.profissional_nome))
    const escolasByName = groupBy(escolasRes.rows, (row) => normText(row.nome_escola))
    const deParaByNorm = groupBy(deParaRes.rows, (row) => normKey(row.turma_original))
    const existing = new Set(atribuicoesRes.rows.map((row) => `${onlyDigits(row.cpf_professor)}|${row.id_turma}`))

    const toInsert = []
    const skippedExisting = []
    const issues = []

    for (const designacao of designacoesRes.rows) {
      const issueBase = {
        id_designacao: designacao.id_designacao,
        escola_nome_bruto: designacao.escola_nome_bruto,
        nome_do_professor: designacao.nome_do_professor,
        turma_original: designacao.turma_original,
      }

      const professorCandidates = professoresByName.get(normText(designacao.nome_do_professor)) || []
      if (professorCandidates.length === 0) {
        issues.push({ ...issueBase, motivo: 'professor_nao_encontrado' })
        continue
      }
      if (professorCandidates.length > 1) {
        issues.push({
          ...issueBase,
          motivo: 'professor_ambiguo',
          candidatos: professorCandidates.map((row) => ({
            cpf: onlyDigits(row.profissional_cpf),
            nome: row.profissional_nome,
          })),
        })
        continue
      }

      const professor = professorCandidates[0]
      const cpf = onlyDigits(professor.profissional_cpf)
      if (!cpf) {
        issues.push({ ...issueBase, motivo: 'professor_sem_cpf', professor_nome: professor.profissional_nome })
        continue
      }
      if (ADMIN_CPFS.has(cpf)) {
        issues.push({ ...issueBase, motivo: 'professor_administrador_ignorado', cpf })
        continue
      }

      const escolaResolution = resolveEscola(designacao.escola_nome_bruto, escolasByName, escolasRes.rows)
      if (escolaResolution.status !== 'ok') {
        issues.push({
          ...issueBase,
          motivo: escolaResolution.status,
          candidatos: escolaResolution.candidates.map((row) => ({ id_escola: row.id_escola, nome_escola: row.nome_escola })),
        })
        continue
      }

      const dePara = resolveDePara(designacao.turma_original, deParaByNorm)
      if (dePara.status !== 'ok') {
        issues.push({
          ...issueBase,
          motivo: dePara.status,
          candidatos: dePara.candidates.map((row) => ({
            turma_original: row.turma_original,
            id_etapas: row.id_etapas,
            id_multi_etapas: row.id_multi_etapas,
            turma_corrigida: row.turma_corrigida,
          })),
        })
        continue
      }

      const turma = resolveTurma(escolaResolution.escola, dePara.mapping, turmasRes.rows)
      if (turma.status !== 'ok') {
        issues.push({
          ...issueBase,
          motivo: turma.status,
          id_escola: escolaResolution.escola.id_escola,
          nome_escola: escolaResolution.escola.nome_escola,
          de_para: {
            id_etapas: dePara.mapping.id_etapas,
            id_multi_etapas: dePara.mapping.id_multi_etapas,
            turma_corrigida: dePara.mapping.turma_corrigida,
          },
          candidatos: turma.candidates.map((row) => ({
            id_turma: row.id_turma,
            id_etapa: row.id_etapa,
            id_multi_etapa: row.id_multi_etapa,
            letra_turma: row.letra_turma,
            turno: row.turno,
          })),
        })
        continue
      }

      const key = `${cpf}|${turma.turma.id_turma}`
      const item = {
        id_designacao: designacao.id_designacao,
        cpf_professor: cpf,
        professor_nome: professor.profissional_nome,
        id_turma: turma.turma.id_turma,
        id_escola: escolaResolution.escola.id_escola,
        escola_nome: escolaResolution.escola.nome_escola,
        escola_match: escolaResolution.match,
        escola_match_score: escolaResolution.score ? Number(escolaResolution.score.toFixed(3)) : undefined,
        turma_original: designacao.turma_original,
        id_etapa: turma.turma.id_etapa,
        id_multi_etapa: turma.turma.id_multi_etapa,
        letra_turma: turma.turma.letra_turma,
        turno: turma.turma.turno,
      }

      if (existing.has(key)) {
        skippedExisting.push(item)
      } else {
        existing.add(key)
        toInsert.push(item)
      }
    }

    const report = {
      mode: APPLY ? 'apply' : 'dry-run',
      projeto: PROJETO,
      designacoes: designacoesRes.rowCount,
      escolasProjeto: escolasRes.rowCount,
      turmasProjeto: turmasRes.rowCount,
      atribuicoesExistentes: atribuicoesRes.rowCount,
      novasAtribuicoes: toInsert.length,
      jaExistiam: skippedExisting.length,
      pendencias: issues.length,
      novasAtribuicoesPreview: toInsert.slice(0, 80),
      pendenciasPorMotivo: issues.reduce((acc, issue) => {
        acc[issue.motivo] = (acc[issue.motivo] || 0) + 1
        return acc
      }, {}),
      pendenciasPreview: issues.slice(0, 120),
    }

    console.log(JSON.stringify(report, null, 2))

    if (!APPLY) return

    await client.query('BEGIN')
    try {
      for (const item of toInsert) {
        await client.query(
          `
          INSERT INTO public.atribuicao_professor (cpf_professor, id_turma)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
          `,
          [item.cpf_professor, item.id_turma]
        )
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }

    const after = await client.query(`
      SELECT COUNT(*)::int AS total
      FROM public.atribuicao_professor
    `)

    console.log(JSON.stringify({ applied: true, inserted: toInsert.length, after: after.rows[0] }, null, 2))
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
