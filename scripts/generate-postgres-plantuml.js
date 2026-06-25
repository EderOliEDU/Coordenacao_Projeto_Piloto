const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const { Pool } = require(path.join(root, 'backend', 'node_modules', 'pg'))
const dotenv = require(path.join(root, 'backend', 'node_modules', 'dotenv'))
dotenv.config({ path: path.join(root, 'backend', '.env_dev') })

const outputPath = path.join(root, 'docs', 'banco-postgresql-dbsemecel.puml')

const pool = new Pool({
  host: process.env.PILOTO_PG_HOST,
  port: process.env.PILOTO_PG_PORT ? Number(process.env.PILOTO_PG_PORT) : 5432,
  database: process.env.PILOTO_PG_DB,
  user: process.env.PILOTO_PG_USER,
  password: process.env.PILOTO_PG_PASSWORD,
  ssl: String(process.env.PILOTO_PG_SSL || '').toLowerCase() === 'true'
    ? { rejectUnauthorized: false }
    : undefined,
})

function aliasFor(schema, table, used) {
  const compact = table
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .split('_')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  const base = (compact || table)
    .replace(/^(\d)/, 'T$1')
    .slice(0, 24) || 'T'

  let alias = base
  let i = 2
  while (used.has(alias)) alias = `${base}_${i++}`
  used.add(alias)
  return alias
}

function packageFor(table) {
  const name = table.toLowerCase()
  if (name.startsWith('avaliacao_')) return 'Avaliacao'
  if (name.includes('necessidade') || name.includes('necespecifica')) return 'Necessidades Especificas'
  if (name.includes('submiss')) return 'Submissoes'
  if (name.startsWith('import_') || name.startsWith('de_para') || name.includes('staging') || name === 'designacoes') {
    return 'Importacao e De-Para'
  }
  if (['escolas', 'turmas', 'alunos', 'professores', 'etapas', 'multietapas', 'enturmacao_aluno', 'atribuicao_professor', 'usuarios'].includes(name)) {
    return 'Nucleo Administrativo'
  }
  return 'Outras Tabelas'
}

const preferredColumns = new Map(Object.entries({
  professores: [
    'profissional_cpf',
    'profissional_nome',
    'profissional_dt_nascimento',
    'profissional_e_mail',
    'senha',
    'senha_temporaria',
    'senha_cadastro_token',
    'senha_cadastro_expira_em',
  ],
  import_alunos_csv_staging: [
    'id_import',
    'escola_original',
    'serie_original',
    'turma_original',
    'turno_original',
    'nome',
    'cpf',
    'id_escola',
    'id_etapa',
    'id_turma',
    'id_aluno',
    'status_importacao',
  ],
}))

function displayColumnsFor(tableName, columns, pkSet, fkSet) {
  const preferred = preferredColumns.get(tableName) || []
  const selected = []
  const seen = new Set()

  function add(column) {
    if (!column || seen.has(column.column_name)) return
    selected.push(column)
    seen.add(column.column_name)
  }

  for (const column of columns) {
    if (pkSet.has(column.column_name) || fkSet.has(column.column_name)) add(column)
  }
  for (const columnName of preferred) {
    add(columns.find((column) => column.column_name === columnName))
  }
  for (const column of columns) {
    if (selected.length >= 14) break
    add(column)
  }

  return {
    columns: selected,
    omitted: columns.length - selected.length,
  }
}

async function main() {
  const tablesRes = await pool.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)

  const columnsRes = await pool.query(`
    SELECT
      table_schema,
      table_name,
      column_name,
      ordinal_position,
      data_type,
      udt_name,
      character_maximum_length,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `)

  const pkRes = await pool.query(`
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name,
      kcu.ordinal_position
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_schema = tc.constraint_schema
     AND kcu.constraint_name = tc.constraint_name
     AND kcu.table_schema = tc.table_schema
     AND kcu.table_name = tc.table_name
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY tc.table_name, kcu.ordinal_position
  `)

  const uniqueRes = await pool.query(`
    SELECT
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      array_to_string(array_agg(kcu.column_name ORDER BY kcu.ordinal_position), ', ') AS columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_schema = tc.constraint_schema
     AND kcu.constraint_name = tc.constraint_name
     AND kcu.table_schema = tc.table_schema
     AND kcu.table_name = tc.table_name
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'UNIQUE'
    GROUP BY tc.table_schema, tc.table_name, tc.constraint_name
    ORDER BY tc.table_name, tc.constraint_name
  `)

  const fkRes = await pool.query(`
    SELECT
      tc.constraint_name,
      kcu.table_schema,
      kcu.table_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      kcu.ordinal_position
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_schema = tc.constraint_schema
     AND kcu.constraint_name = tc.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_schema = tc.constraint_schema
     AND ccu.constraint_name = tc.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
    ORDER BY kcu.table_name, tc.constraint_name, kcu.ordinal_position
  `)

  const tables = tablesRes.rows.map((row) => ({
    schema: row.table_schema,
    name: row.table_name,
  }))

  const key = (schema, table) => `${schema}.${table}`
  const columnsByTable = new Map()
  const pkByTable = new Map()
  const uniqueByTable = new Map()
  const fkColumnsByTable = new Map()
  const usedAliases = new Set()
  const aliases = new Map()

  for (const table of tables) {
    aliases.set(key(table.schema, table.name), aliasFor(table.schema, table.name, usedAliases))
  }

  for (const column of columnsRes.rows) {
    const tableKey = key(column.table_schema, column.table_name)
    if (!columnsByTable.has(tableKey)) columnsByTable.set(tableKey, [])
    columnsByTable.get(tableKey).push(column)
  }

  for (const pk of pkRes.rows) {
    const tableKey = key(pk.table_schema, pk.table_name)
    if (!pkByTable.has(tableKey)) pkByTable.set(tableKey, new Set())
    pkByTable.get(tableKey).add(pk.column_name)
  }

  for (const unique of uniqueRes.rows) {
    const tableKey = key(unique.table_schema, unique.table_name)
    if (!uniqueByTable.has(tableKey)) uniqueByTable.set(tableKey, [])
    uniqueByTable.get(tableKey).push(unique)
  }

  for (const fk of fkRes.rows) {
    const tableKey = key(fk.table_schema, fk.table_name)
    if (!fkColumnsByTable.has(tableKey)) fkColumnsByTable.set(tableKey, new Set())
    fkColumnsByTable.get(tableKey).add(fk.column_name)
  }

  const groups = new Map()
  for (const table of tables) {
    const group = packageFor(table.name)
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group).push(table)
  }

  const lines = [
    '@startuml banco-postgresql-dbsemecel',
    "' Gerado automaticamente a partir de dbsemecel/public.",
    "' Fonte: catalogo PostgreSQL em information_schema.",
    'skinparam ClassBackgroundColor white',
    'skinparam ClassBorderColor #1a365d',
    'skinparam ClassHeaderBackgroundColor #edf2f7',
    'skinparam Shadowing false',
    '',
  ]

  for (const [group, groupTables] of groups) {
    lines.push(`package "${group}" {`)
    for (const table of groupTables) {
      const tableKey = key(table.schema, table.name)
      const alias = aliases.get(tableKey)
      const pkSet = pkByTable.get(tableKey) || new Set()
      const fkSet = fkColumnsByTable.get(tableKey) || new Set()
      const columns = columnsByTable.get(tableKey) || []
      const display = displayColumnsFor(table.name, columns, pkSet, fkSet)
      const pkColumns = display.columns.filter((column) => pkSet.has(column.column_name))
      const otherColumns = display.columns.filter((column) => !pkSet.has(column.column_name))

      lines.push(`  class "${table.name}" as ${alias} {`)
      for (const column of pkColumns) {
        const isFk = fkSet.has(column.column_name)
        lines.push(`    ${column.column_name} (${isFk ? 'PK/FK' : 'PK'})`)
      }
      if (pkColumns.length > 0 && otherColumns.length > 0) {
        lines.push('    --')
      }
      for (const column of otherColumns) {
        if (fkSet.has(column.column_name)) {
          lines.push(`    ${column.column_name} (FK)`)
        } else {
          lines.push(`    ${column.column_name}`)
        }
      }
      if (display.omitted > 0) {
        lines.push(`    demais_campos_adicionais_${display.omitted}`)
      }
      lines.push('  }')
      lines.push('')
    }
    lines.push('}')
    lines.push('')
  }

  const fkGroups = new Map()
  for (const fk of fkRes.rows) {
    const fkKey = [
      fk.constraint_name,
      fk.table_schema,
      fk.table_name,
      fk.foreign_table_schema,
      fk.foreign_table_name,
    ].join('|')
    if (!fkGroups.has(fkKey)) fkGroups.set(fkKey, [])
    fkGroups.get(fkKey).push(fk)
  }

  lines.push("' Relacionamentos")
  const relationKeys = new Set()
  for (const rows of fkGroups.values()) {
    const first = rows[0]
    const fromAlias = aliases.get(key(first.table_schema, first.table_name))
    const toAlias = aliases.get(key(first.foreign_table_schema, first.foreign_table_name))
    const fromCols = rows.map((row) => row.column_name).join(', ')
    const toCols = rows.map((row) => row.foreign_column_name).join(', ')
    if (fromAlias && toAlias) {
      relationKeys.add(`${fromAlias}->${toAlias}:${fromCols}->${toCols}`)
      lines.push(`${fromAlias} --> ${toAlias} : "${fromCols} -> ${toCols}"`)
    }
  }

  const inferredRelations = [
    ['public.atribuicao_professor', 'public.professores', 'cpf_professor', 'profissional_cpf'],
    ['public.aluno_necessidades_contexto', 'public.alunos', 'id_aluno', 'id_aluno'],
    ['public.aluno_necessidades_contexto', 'public.turmas', 'id_turma', 'id_turma'],
    ['public.aluno_necessidades_contexto', 'public.professores', 'cpf_professor', 'profissional_cpf'],
    ['public.aluno_necessidades_especificas', 'public.alunos', 'id_aluno', 'id_aluno'],
    ['public.aluno_necessidades_especificas', 'public.turmas', 'id_turma', 'id_turma'],
    ['public.aluno_necessidades_especificas', 'public.professores', 'cpf_professor', 'profissional_cpf'],
    ['public.de_para_escolas', 'public.escolas', 'id_escola', 'id_escola'],
    ['public.de_para_turmas', 'public.etapas', 'id_etapas', 'id_etapa'],
    ['public.de_para_turmas', 'public.multietapas', 'id_multi_etapas', 'id_multi_etapa'],
    ['public.cronograma_aplicacao', 'public.etapas', 'id_etapa', 'id_etapa'],
    ['public.turma_cronograma_aplicacao', 'public.cronograma_aplicacao', 'id_cronograma_aplicacao', 'id_cronograma_aplicacao'],
    ['public.import_alunos_csv_staging', 'public.escolas', 'id_escola', 'id_escola'],
    ['public.import_alunos_csv_staging', 'public.etapas', 'id_etapa', 'id_etapa'],
    ['public.import_alunos_csv_staging', 'public.turmas', 'id_turma', 'id_turma'],
    ['public.import_alunos_csv_staging', 'public.alunos', 'id_aluno', 'id_aluno'],
  ]

  lines.push('')
  lines.push("' Relacionamentos inferidos pelo uso no sistema")
  for (const [fromTable, toTable, fromCol, toCol] of inferredRelations) {
    const fromAlias = aliases.get(fromTable)
    const toAlias = aliases.get(toTable)
    const relationKey = `${fromAlias}->${toAlias}:${fromCol}->${toCol}`
    if (fromAlias && toAlias && !relationKeys.has(relationKey)) {
      lines.push(`${fromAlias} ..> ${toAlias} : "${fromCol} -> ${toCol}"`)
    }
  }

  lines.push('', '@enduml', '')

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8')

  console.log(`Arquivo gerado: ${outputPath}`)
  console.log(`Tabelas: ${tables.length}`)
  console.log(`Relacionamentos FK: ${fkGroups.size}`)
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
