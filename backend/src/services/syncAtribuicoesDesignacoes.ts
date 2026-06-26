import { Pool, PoolClient } from 'pg'

const PROJETO = 'PJINSTFONI'
const ADMIN_CPFS = new Set([
  '65495934172',
  '05365763190',
])

const SCHOOL_STOP_WORDS = new Set(
  'ESCOLA MUNICIPAL DE DA DO DAS DOS E EMEB EMEF EMEI CMEI CMEITI EMCEB EMREF EMEFI EDUCACAO BASICA ENSINO FUNDAMENTAL INFANTIL PROFESSOR PROFESSORA PROF CENTRO CAMPO MUNICIPAL'.split(' ')
)

type DbRow = Record<string, any>

export interface AtribuicaoSyncItem {
  cpf_professor: string
  professor_nome: string
  id_turma: number
  id_escola: number
  escola_nome: string
  turma_original?: string
  id_etapa?: number | null
  id_multi_etapa?: number | null
  letra_turma?: string | null
  turno?: string | null
}

export interface AtribuicaoSyncReport {
  projeto: string
  designacoes: number
  escolasProjeto: number
  turmasProjeto: number
  atribuicoesProjeto: number
  novasAtribuicoes: number
  atribuicoesExcluidas: number
  jaExistiam: number
  pendencias: number
  pendenciasPorMotivo: Record<string, number>
  novasAtribuicoesPreview: AtribuicaoSyncItem[]
  atribuicoesExcluidasPreview: AtribuicaoSyncItem[]
}

function onlyDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '')
}

function normText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[º°ª]/g, '')
    .replace(/[^A-Z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function normKey(value: unknown) {
  return normText(value).replace(/[^A-Z0-9]/g, '')
}

function tokens(value: unknown, stopWords = new Set<string>()) {
  return normText(value)
    .split(' ')
    .filter((token) => token && !stopWords.has(token))
}

function similarity(a: unknown, b: unknown, stopWords = new Set<string>()) {
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

function groupBy<T>(rows: T[], keyFn: (row: T) => string) {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyFn(row)
    if (!key) continue
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(row)
  }
  return map
}

function uniqueBy<T>(rows: T[], keyFn: (row: T) => string) {
  const seen = new Set<string>()
  const result: T[] = []
  for (const row of rows) {
    const key = keyFn(row)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(row)
  }
  return result
}

function resolveEscola(escolaNomeBruto: string, escolasByName: Map<string, DbRow[]>, escolas: DbRow[]) {
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

function resolveDePara(turmaOriginal: string, deParaByNorm: Map<string, DbRow[]>) {
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

function resolveTurma(escola: DbRow, mapping: DbRow, turmas: DbRow[]) {
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

function toItem(row: DbRow): AtribuicaoSyncItem {
  return {
    cpf_professor: onlyDigits(row.cpf_professor),
    professor_nome: row.professor_nome || row.profissional_nome || '',
    id_turma: Number(row.id_turma),
    id_escola: Number(row.id_escola),
    escola_nome: row.escola_nome || row.nome_escola || '',
    turma_original: row.turma_original,
    id_etapa: row.id_etapa,
    id_multi_etapa: row.id_multi_etapa,
    letra_turma: row.letra_turma,
    turno: row.turno,
  }
}

async function loadData(client: PoolClient) {
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
    SELECT
      ap.id_atribuicao,
      regexp_replace(ap.cpf_professor::text, '\\D', '', 'g') AS cpf_professor,
      ap.id_turma,
      p.profissional_nome,
      t.id_escola,
      e.nome_escola,
      t.id_etapa,
      t.id_multi_etapa,
      t.letra_turma,
      t.turno
    FROM public.atribuicao_professor ap
    JOIN public.turmas t ON t.id_turma = ap.id_turma
    JOIN public.escolas e ON e.id_escola = t.id_escola
    LEFT JOIN public.professores p
      ON regexp_replace(p.profissional_cpf::text, '\\D', '', 'g') = regexp_replace(ap.cpf_professor::text, '\\D', '', 'g')
    WHERE e.projeto = $1
  `, [PROJETO])

  return { designacoesRes, professoresRes, escolasRes, deParaRes, turmasRes, atribuicoesRes }
}

export async function syncAtribuicoesFromDesignacoes(pool: Pool): Promise<AtribuicaoSyncReport> {
  const client = await pool.connect()
  try {
    const { designacoesRes, professoresRes, escolasRes, deParaRes, turmasRes, atribuicoesRes } = await loadData(client)
    const professoresByName = groupBy(professoresRes.rows, (row) => normText(row.profissional_nome))
    const escolasByName = groupBy(escolasRes.rows, (row) => normText(row.nome_escola))
    const deParaByNorm = groupBy(deParaRes.rows, (row) => normKey(row.turma_original))
    const existing = new Set(atribuicoesRes.rows.map((row) => `${onlyDigits(row.cpf_professor)}|${row.id_turma}`))
    const expected = new Map<string, AtribuicaoSyncItem>()
    const issues: Array<{ motivo: string }> = []

    for (const designacao of designacoesRes.rows) {
      const professorCandidates = professoresByName.get(normText(designacao.nome_do_professor)) || []
      if (professorCandidates.length !== 1) {
        issues.push({ motivo: professorCandidates.length === 0 ? 'professor_nao_encontrado' : 'professor_ambiguo' })
        continue
      }

      const professor = professorCandidates[0]
      const cpf = onlyDigits(professor.profissional_cpf)
      if (!cpf) {
        issues.push({ motivo: 'professor_sem_cpf' })
        continue
      }
      if (ADMIN_CPFS.has(cpf)) {
        issues.push({ motivo: 'professor_administrador_ignorado' })
        continue
      }

      const escolaResolution = resolveEscola(designacao.escola_nome_bruto, escolasByName, escolasRes.rows)
      if (escolaResolution.status !== 'ok') {
        issues.push({ motivo: escolaResolution.status })
        continue
      }

      const dePara = resolveDePara(designacao.turma_original, deParaByNorm)
      if (dePara.status !== 'ok') {
        issues.push({ motivo: dePara.status })
        continue
      }

      const turma = resolveTurma(escolaResolution.escola, dePara.mapping, turmasRes.rows)
      if (turma.status !== 'ok') {
        issues.push({ motivo: turma.status })
        continue
      }

      const key = `${cpf}|${turma.turma.id_turma}`
      expected.set(key, {
        cpf_professor: cpf,
        professor_nome: professor.profissional_nome,
        id_turma: turma.turma.id_turma,
        id_escola: escolaResolution.escola.id_escola,
        escola_nome: escolaResolution.escola.nome_escola,
        turma_original: designacao.turma_original,
        id_etapa: turma.turma.id_etapa,
        id_multi_etapa: turma.turma.id_multi_etapa,
        letra_turma: turma.turma.letra_turma,
        turno: turma.turma.turno,
      })
    }

    const toInsert = [...expected.entries()]
      .filter(([key]) => !existing.has(key))
      .map(([, item]) => item)
    const toDelete = atribuicoesRes.rows
      .filter((row) => {
        const cpf = onlyDigits(row.cpf_professor)
        if (!cpf || ADMIN_CPFS.has(cpf)) return false
        return !expected.has(`${cpf}|${row.id_turma}`)
      })
      .map(toItem)

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

      for (const item of toDelete) {
        await client.query(
          `
          DELETE FROM public.atribuicao_professor
          WHERE regexp_replace(cpf_professor::text, '\\D', '', 'g') = $1
            AND id_turma = $2
          `,
          [item.cpf_professor, item.id_turma]
        )
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }

    return {
      projeto: PROJETO,
      designacoes: designacoesRes.rowCount || 0,
      escolasProjeto: escolasRes.rowCount || 0,
      turmasProjeto: turmasRes.rowCount || 0,
      atribuicoesProjeto: atribuicoesRes.rowCount || 0,
      novasAtribuicoes: toInsert.length,
      atribuicoesExcluidas: toDelete.length,
      jaExistiam: [...expected.keys()].filter((key) => existing.has(key)).length,
      pendencias: issues.length,
      pendenciasPorMotivo: issues.reduce<Record<string, number>>((acc, issue) => {
        acc[issue.motivo] = (acc[issue.motivo] || 0) + 1
        return acc
      }, {}),
      novasAtribuicoesPreview: toInsert.slice(0, 20),
      atribuicoesExcluidasPreview: toDelete.slice(0, 20),
    }
  } finally {
    client.release()
  }
}
