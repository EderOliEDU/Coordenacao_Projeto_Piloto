const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const { parse } = require(path.join(root, 'backend', 'node_modules', 'csv-parse', 'dist', 'cjs', 'sync.cjs'))
const { Pool } = require(path.join(root, 'backend', 'node_modules', 'pg'))

const APPLY = process.argv.includes('--apply')
const PROJECT_DEFAULT_FOR_NEW_ROWS = null

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

function norm(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function getColumn(columns, target) {
  const wanted = norm(target)
  return columns.find((column) => norm(column) === wanted)
    || columns.find((column) => norm(column).includes(wanted))
}

function getValue(row, column) {
  return String(row[column] || '').trim()
}

function maybeNumber(value) {
  const clean = String(value || '').trim()
  if (!clean) return null
  const n = Number(clean.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const stopWords = new Set(
  'ESCOLA MUNICIPAL DE DA DO DAS DOS E EMEB EMEF EMEI CMEI CMEITI EMCEB EMREF EMEFI EDUCACAO BASICA ENSINO FUNDAMENTAL INFANTIL PROFESSOR PROFESSORA PROF CENTRO CAMPO'.split(' ')
)

function tokens(value) {
  return norm(value)
    .split(' ')
    .filter((token) => token && !stopWords.has(token))
}

function similarity(a, b) {
  const aTokens = new Set(tokens(a))
  const bTokens = new Set(tokens(b))
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length
  const union = new Set([...aTokens, ...bTokens]).size || 1
  let score = intersection / union
  const normalizedA = norm(a)
  const normalizedB = norm(b)
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) score += 0.25
  return score
}

function findCsvPath() {
  const downloads = path.join(process.env.USERPROFILE || 'C:\\Users\\eder.oliveira', 'Downloads')
  const fileName = fs.readdirSync(downloads)
    .find((name) => name.includes('Tabela da lista das escolas') && name.toLowerCase().endsWith('.csv'))
  if (!fileName) throw new Error(`CSV nao encontrado em ${downloads}`)
  return path.join(downloads, fileName)
}

function readCsvRows(csvPath) {
  const csvText = fs.readFileSync(csvPath, 'utf8')
  const rows = parse(csvText, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  })

  const columns = Object.keys(rows[0] || {})
  const c = {
    restricao: getColumn(columns, 'Restricao de Atendimento'),
    escola: getColumn(columns, 'Escola'),
    inep: getColumn(columns, 'Codigo INEP'),
    uf: getColumn(columns, 'UF'),
    municipio: getColumn(columns, 'Municipio'),
    localizacao: getColumn(columns, 'Localizacao'),
    localidadeDiferenciada: getColumn(columns, 'Localidade Diferenciada'),
    categoriaAdministrativa: getColumn(columns, 'Categoria Administrativa'),
    endereco: getColumn(columns, 'Endereco'),
    telefone: getColumn(columns, 'Telefone'),
    dependenciaAdministrativa: getColumn(columns, 'Dependencia Administrativa'),
    categoriaEscolaPrivada: getColumn(columns, 'Categoria Escola Privada'),
    conveniadaPoderPublico: getColumn(columns, 'Conveniada Poder Publico'),
    regulamentacaoConselho: getColumn(columns, 'Regulamentacao pelo Conselho de Educacao'),
    porteEscola: getColumn(columns, 'Porte da Escola'),
    etapasModalidades: getColumn(columns, 'Etapas e Modalidade de Ensino Oferecidas'),
    outrasOfertas: getColumn(columns, 'Outras Ofertas Educacionais'),
    latitude: getColumn(columns, 'Latitude'),
    longitude: getColumn(columns, 'Longitude'),
  }

  for (const [key, column] of Object.entries(c)) {
    if (!column) throw new Error(`Coluna obrigatoria nao encontrada no CSV: ${key}`)
  }

  return rows.map((row) => ({
    nome_escola: getValue(row, c.escola),
    codigo_inep: getValue(row, c.inep),
    uf: getValue(row, c.uf),
    municipio: getValue(row, c.municipio),
    restricao_atendimento: getValue(row, c.restricao),
    localizacao: getValue(row, c.localizacao),
    localidade_diferenciada: getValue(row, c.localidadeDiferenciada),
    categoria_administrativa: getValue(row, c.categoriaAdministrativa),
    endereco: getValue(row, c.endereco),
    telefone: getValue(row, c.telefone),
    dependencia_administrativa: getValue(row, c.dependenciaAdministrativa),
    categoria_escola_privada: getValue(row, c.categoriaEscolaPrivada),
    conveniada_poder_publico: getValue(row, c.conveniadaPoderPublico),
    regulamentacao_conselho_educacao: getValue(row, c.regulamentacaoConselho),
    porte_escola: getValue(row, c.porteEscola),
    etapas_modalidades: getValue(row, c.etapasModalidades),
    outras_ofertas_educacionais: getValue(row, c.outrasOfertas),
    latitude: maybeNumber(getValue(row, c.latitude)),
    longitude: maybeNumber(getValue(row, c.longitude)),
  }))
}

function buildMapping(csvRows, dbRows) {
  const dbByNormName = new Map(dbRows.map((row) => [norm(row.nome_escola), row]))
  const usedDbIds = new Set()
  const updates = []
  const inserts = []

  for (const csvRow of csvRows) {
    const exact = dbByNormName.get(norm(csvRow.nome_escola))
    if (exact) {
      usedDbIds.add(exact.id_escola)
      updates.push({ kind: 'nome_exato', id_escola: exact.id_escola, db_nome_escola: exact.nome_escola, score: 1, csv: csvRow })
      continue
    }

    const candidates = dbRows
      .filter((row) => !usedDbIds.has(row.id_escola))
      .map((row) => ({
        row,
        score: similarity(csvRow.nome_escola, row.nome_escola),
      }))
      .sort((a, b) => b.score - a.score)

    const best = candidates[0]
    if (best && best.score >= 0.45) {
      usedDbIds.add(best.row.id_escola)
      updates.push({
        kind: 'nome_variante',
        id_escola: best.row.id_escola,
        db_nome_escola: best.row.nome_escola,
        score: best.score,
        csv: csvRow,
      })
    } else {
      inserts.push(csvRow)
    }
  }

  const untouched = dbRows.filter((row) => !usedDbIds.has(row.id_escola))
  return { updates, inserts, untouched }
}

async function ensureSchema(client) {
  await client.query(`
    ALTER TABLE public.escolas
      ADD COLUMN IF NOT EXISTS codigo_inep text,
      ADD COLUMN IF NOT EXISTS uf varchar(2),
      ADD COLUMN IF NOT EXISTS municipio text,
      ADD COLUMN IF NOT EXISTS restricao_atendimento text,
      ADD COLUMN IF NOT EXISTS localizacao text,
      ADD COLUMN IF NOT EXISTS localidade_diferenciada text,
      ADD COLUMN IF NOT EXISTS categoria_administrativa text,
      ADD COLUMN IF NOT EXISTS endereco text,
      ADD COLUMN IF NOT EXISTS telefone text,
      ADD COLUMN IF NOT EXISTS dependencia_administrativa text,
      ADD COLUMN IF NOT EXISTS categoria_escola_privada text,
      ADD COLUMN IF NOT EXISTS conveniada_poder_publico text,
      ADD COLUMN IF NOT EXISTS regulamentacao_conselho_educacao text,
      ADD COLUMN IF NOT EXISTS porte_escola text,
      ADD COLUMN IF NOT EXISTS etapas_modalidades text,
      ADD COLUMN IF NOT EXISTS outras_ofertas_educacionais text,
      ADD COLUMN IF NOT EXISTS latitude numeric(11,8),
      ADD COLUMN IF NOT EXISTS longitude numeric(11,8),
      ADD COLUMN IF NOT EXISTS escolas_csv_atualizado_em timestamp with time zone
  `)

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_escolas_codigo_inep
      ON public.escolas (codigo_inep)
      WHERE codigo_inep IS NOT NULL
  `)
}

function valuesFor(row) {
  return [
    row.nome_escola,
    row.codigo_inep || null,
    row.uf || null,
    row.municipio || null,
    row.restricao_atendimento || null,
    row.localizacao || null,
    row.localidade_diferenciada || null,
    row.categoria_administrativa || null,
    row.endereco || null,
    row.telefone || null,
    row.dependencia_administrativa || null,
    row.categoria_escola_privada || null,
    row.conveniada_poder_publico || null,
    row.regulamentacao_conselho_educacao || null,
    row.porte_escola || null,
    row.etapas_modalidades || null,
    row.outras_ofertas_educacionais || null,
    row.latitude,
    row.longitude,
  ]
}

async function updateSchool(client, item) {
  await client.query(`
    UPDATE public.escolas
    SET
      nome_escola = $1,
      codigo_inep = $2,
      uf = $3,
      municipio = $4,
      restricao_atendimento = $5,
      localizacao = $6,
      localidade_diferenciada = $7,
      categoria_administrativa = $8,
      endereco = $9,
      telefone = $10,
      dependencia_administrativa = $11,
      categoria_escola_privada = $12,
      conveniada_poder_publico = $13,
      regulamentacao_conselho_educacao = $14,
      porte_escola = $15,
      etapas_modalidades = $16,
      outras_ofertas_educacionais = $17,
      latitude = $18,
      longitude = $19,
      escolas_csv_atualizado_em = CURRENT_TIMESTAMP
    WHERE id_escola = $20
  `, [...valuesFor(item.csv), item.id_escola])
}

async function insertSchool(client, row) {
  await client.query(`
    INSERT INTO public.escolas (
      nome_escola,
      codigo_inep,
      uf,
      municipio,
      restricao_atendimento,
      localizacao,
      localidade_diferenciada,
      categoria_administrativa,
      endereco,
      telefone,
      dependencia_administrativa,
      categoria_escola_privada,
      conveniada_poder_publico,
      regulamentacao_conselho_educacao,
      porte_escola,
      etapas_modalidades,
      outras_ofertas_educacionais,
      latitude,
      longitude,
      projeto,
      escolas_csv_atualizado_em
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19,
      $20,
      CURRENT_TIMESTAMP
    )
  `, [...valuesFor(row), PROJECT_DEFAULT_FOR_NEW_ROWS])
}

async function main() {
  const csvPath = findCsvPath()
  const csvRows = readCsvRows(csvPath)
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
    const dbRows = (await client.query('SELECT * FROM public.escolas ORDER BY id_escola')).rows
    const mapping = buildMapping(csvRows, dbRows)
    const variantUpdates = mapping.updates.filter((item) => item.kind === 'nome_variante')

    const report = {
      mode: APPLY ? 'apply' : 'dry-run',
      csvPath,
      csvRows: csvRows.length,
      dbRowsBefore: dbRows.length,
      updates: mapping.updates.length,
      exactNameUpdates: mapping.updates.length - variantUpdates.length,
      variantNameUpdates: variantUpdates.length,
      inserts: mapping.inserts.length,
      untouchedDbRows: mapping.untouched.length,
      variantNameUpdatesPreview: variantUpdates.map((item) => ({
        id_escola: item.id_escola,
        from: item.db_nome_escola,
        to: item.csv.nome_escola,
        codigo_inep: item.csv.codigo_inep,
        score: Number(item.score.toFixed(3)),
      })),
      insertsPreview: mapping.inserts.map((row) => ({
        nome_escola: row.nome_escola,
        codigo_inep: row.codigo_inep,
      })),
      untouchedPreview: mapping.untouched.map((row) => ({
        id_escola: row.id_escola,
        nome_escola: row.nome_escola,
        projeto: row.projeto,
      })),
    }

    console.log(JSON.stringify(report, null, 2))

    if (!APPLY) return

    await client.query('BEGIN')
    try {
      await ensureSchema(client)
      for (const item of mapping.updates) await updateSchool(client, item)
      for (const row of mapping.inserts) await insertSchool(client, row)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }

    const after = await client.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(codigo_inep)::int AS com_codigo_inep,
        COUNT(*) FILTER (WHERE escolas_csv_atualizado_em IS NOT NULL)::int AS atualizadas_csv
      FROM public.escolas
    `)
    console.log(JSON.stringify({ applied: true, after: after.rows[0] }, null, 2))
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
