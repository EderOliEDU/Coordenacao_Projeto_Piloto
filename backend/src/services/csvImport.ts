import { parse } from 'csv-parse/sync'
import { PoolClient } from 'pg'
import { getPgPool } from './pgPool'

export type ImportTipo = 'escolas' | 'etapas' | 'turmas' | 'professores' | 'alocacoes' | 'alunos'

interface ImportResult {
  message: string
  count: number
  warnings: string[]
}

type CsvRecord = Record<string, string | undefined>

const VALID_TIPOS = new Set<ImportTipo>(['escolas', 'etapas', 'turmas', 'professores', 'alocacoes', 'alunos'])

function value(record: CsvRecord, ...keys: string[]) {
  for (const key of keys) {
    const found = record[key]
    if (found !== undefined && String(found).trim() !== '') return String(found).trim()
  }
  return ''
}

function onlyDigits(input: string) {
  return (input || '').replace(/\D/g, '')
}

function toNumber(input: string) {
  const n = Number(input)
  return Number.isFinite(n) ? n : null
}

async function findEscolaId(client: PoolClient, record: CsvRecord) {
  const explicit = toNumber(value(record, 'id_escola', 'idEscola', 'escolaId'))
  if (explicit !== null) return explicit

  const nome = value(record, 'nome_escola', 'nomeEscola', 'escolaNome', 'escola', 'nome')
  if (!nome) return null

  const result = await client.query<{ id_escola: number }>(
    `SELECT id_escola FROM public.escolas WHERE lower(nome_escola) = lower($1) LIMIT 1`,
    [nome]
  )
  return result.rows[0]?.id_escola ?? null
}

async function findEtapaId(client: PoolClient, record: CsvRecord) {
  const explicit = toNumber(value(record, 'id_etapa', 'idEtapa', 'etapaId'))
  if (explicit !== null) return explicit

  const descricao = value(record, 'descricao', 'etapaDescricao', 'etapa')
  if (!descricao) return null

  const result = await client.query<{ id_etapa: number }>(
    `SELECT id_etapa FROM public.etapas WHERE lower(descricao) = lower($1) LIMIT 1`,
    [descricao]
  )
  return result.rows[0]?.id_etapa ?? null
}

async function findTurmaId(client: PoolClient, record: CsvRecord) {
  const explicit = toNumber(value(record, 'id_turma', 'idTurma', 'turmaId'))
  if (explicit !== null) return explicit

  const letraTurma = value(record, 'letra_turma', 'letraTurma', 'letra', 'turmaNome', 'turma')
  const escolaId = await findEscolaId(client, record)
  const etapaId = await findEtapaId(client, record)

  if (!letraTurma) return null

  const filters = ['lower(letra_turma::text) = lower($1)']
  const params: unknown[] = [letraTurma]

  if (escolaId !== null) {
    params.push(escolaId)
    filters.push(`id_escola = $${params.length}`)
  }
  if (etapaId !== null) {
    params.push(etapaId)
    filters.push(`id_etapa = $${params.length}`)
  }

  const result = await client.query<{ id_turma: number }>(
    `SELECT id_turma FROM public.turmas WHERE ${filters.join(' AND ')} LIMIT 1`,
    params
  )
  return result.rows[0]?.id_turma ?? null
}

async function importEscolas(client: PoolClient, records: CsvRecord[], warnings: string[]) {
  let count = 0
  for (const record of records) {
    const id = toNumber(value(record, 'id_escola', 'idEscola', 'id'))
    const nome = value(record, 'nome_escola', 'nomeEscola', 'nome', 'escola')
    const projeto = value(record, 'projeto') || 'PJINSTFONI'

    if (!nome) {
      warnings.push('Escola sem nome ignorada')
      continue
    }

    if (id !== null) {
      await client.query(
        `INSERT INTO public.escolas (id_escola, nome_escola, projeto)
         VALUES ($1, $2, $3)
         ON CONFLICT (id_escola)
         DO UPDATE SET nome_escola = EXCLUDED.nome_escola, projeto = EXCLUDED.projeto`,
        [id, nome, projeto]
      )
    } else {
      await client.query(
        `INSERT INTO public.escolas (nome_escola, projeto)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [nome, projeto]
      )
    }
    count++
  }
  return count
}

async function importEtapas(client: PoolClient, records: CsvRecord[], warnings: string[]) {
  let count = 0
  for (const record of records) {
    const id = toNumber(value(record, 'id_etapa', 'idEtapa', 'id'))
    const descricao = value(record, 'descricao', 'etapa')
    const projeto = value(record, 'projeto') || 'PJINSTFONI'

    if (!descricao) {
      warnings.push('Etapa sem descrição ignorada')
      continue
    }

    if (id !== null) {
      await client.query(
        `INSERT INTO public.etapas (id_etapa, descricao, projeto)
         VALUES ($1, $2, $3)
         ON CONFLICT (id_etapa)
         DO UPDATE SET descricao = EXCLUDED.descricao, projeto = EXCLUDED.projeto`,
        [id, descricao, projeto]
      )
    } else {
      await client.query(
        `INSERT INTO public.etapas (descricao, projeto)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [descricao, projeto]
      )
    }
    count++
  }
  return count
}

async function importTurmas(client: PoolClient, records: CsvRecord[], warnings: string[]) {
  let count = 0
  for (const record of records) {
    const id = toNumber(value(record, 'id_turma', 'idTurma', 'id'))
    const escolaId = await findEscolaId(client, record)
    const etapaId = await findEtapaId(client, record)
    const letraTurma = value(record, 'letra_turma', 'letraTurma', 'letra', 'nome', 'turma')
    const turno = value(record, 'turno') || null

    if (escolaId === null || etapaId === null || !letraTurma) {
      warnings.push(`Turma ignorada por escola/etapa/letra ausente: ${JSON.stringify(record)}`)
      continue
    }

    if (id !== null) {
      await client.query(
        `INSERT INTO public.turmas (id_turma, id_escola, id_etapa, letra_turma, turno)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id_turma)
         DO UPDATE SET id_escola = EXCLUDED.id_escola, id_etapa = EXCLUDED.id_etapa,
                       letra_turma = EXCLUDED.letra_turma, turno = EXCLUDED.turno`,
        [id, escolaId, etapaId, letraTurma, turno]
      )
    } else {
      await client.query(
        `INSERT INTO public.turmas (id_escola, id_etapa, letra_turma, turno)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [escolaId, etapaId, letraTurma, turno]
      )
    }
    count++
  }
  return count
}

async function importProfessores(client: PoolClient, records: CsvRecord[], warnings: string[]) {
  let count = 0
  for (const record of records) {
    const cpf = onlyDigits(value(record, 'profissional_cpf', 'cpf', 'login'))
    const nome = value(record, 'profissional_nome', 'nome')
    const nomeSocial = value(record, 'profissional_nome_social', 'nomeSocial') || null
    const nascimento = value(record, 'profissional_dt_nascimento', 'dataNascimento', 'dtNascimento') || null
    const email = value(record, 'profissional_e_mail', 'email', 'e_mail') || null

    if (cpf.length !== 11 || !nome) {
      warnings.push(`Professor ignorado por CPF/nome inválido: ${JSON.stringify(record)}`)
      continue
    }

    await client.query(
      `INSERT INTO public.professores
        (profissional_cpf, profissional_nome, profissional_nome_social, profissional_dt_nascimento, profissional_e_mail)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (profissional_cpf)
       DO UPDATE SET profissional_nome = EXCLUDED.profissional_nome,
                     profissional_nome_social = EXCLUDED.profissional_nome_social,
                     profissional_dt_nascimento = EXCLUDED.profissional_dt_nascimento,
                     profissional_e_mail = EXCLUDED.profissional_e_mail`,
      [cpf, nome, nomeSocial, nascimento, email]
    )
    count++
  }
  return count
}

async function importAlocacoes(client: PoolClient, records: CsvRecord[], warnings: string[]) {
  let count = 0
  for (const record of records) {
    const cpf = onlyDigits(value(record, 'cpf_professor', 'professorCpf', 'professorLogin', 'cpf'))
    const turmaId = await findTurmaId(client, record)

    if (cpf.length !== 11 || turmaId === null) {
      warnings.push(`Alocação ignorada por CPF/turma inválida: ${JSON.stringify(record)}`)
      continue
    }

    await client.query(
      `INSERT INTO public.atribuicao_professor (cpf_professor, id_turma)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [cpf, turmaId]
    )
    count++
  }
  return count
}

async function importAlunos(client: PoolClient, records: CsvRecord[], warnings: string[]) {
  let count = 0
  for (const record of records) {
    const id = toNumber(value(record, 'id_aluno', 'idAluno', 'id'))
    const nome = value(record, 'nome', 'alunoNome')
    const cpf = onlyDigits(value(record, 'cpf')) || null
    const inep = value(record, 'inep') || null
    const situacao = value(record, 'situacao') || null
    const escola = value(record, 'escola', 'escolaNome') || null
    const serie = value(record, 'serie', 'etapa') || null
    const turma = value(record, 'turma', 'turmaNome', 'letra_turma') || null
    const turno = value(record, 'turno') || null
    const turmaId = await findTurmaId(client, record)

    if (!nome) {
      warnings.push(`Aluno ignorado por nome ausente: ${JSON.stringify(record)}`)
      continue
    }

    let alunoId = id
    if (alunoId !== null) {
      const result = await client.query<{ id_aluno: number }>(
        `INSERT INTO public.alunos (id_aluno, escola, serie, turma, turno, inep, nome, cpf, situacao)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id_aluno)
         DO UPDATE SET escola = EXCLUDED.escola, serie = EXCLUDED.serie, turma = EXCLUDED.turma,
                       turno = EXCLUDED.turno, inep = EXCLUDED.inep, nome = EXCLUDED.nome,
                       cpf = EXCLUDED.cpf, situacao = EXCLUDED.situacao
         RETURNING id_aluno`,
        [alunoId, escola, serie, turma, turno, inep, nome, cpf, situacao]
      )
      alunoId = result.rows[0].id_aluno
    } else {
      const result = await client.query<{ id_aluno: number }>(
        `INSERT INTO public.alunos (escola, serie, turma, turno, inep, nome, cpf, situacao)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id_aluno`,
        [escola, serie, turma, turno, inep, nome, cpf, situacao]
      )
      alunoId = result.rows[0].id_aluno
    }

    if (turmaId !== null) {
      await client.query(
        `INSERT INTO public.enturmacao_aluno (id_turma, id_aluno)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [turmaId, alunoId]
      )
    }
    count++
  }
  return count
}

export function parseCsvContent(content: string): CsvRecord[] {
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as CsvRecord[]
}

export async function importCsvRecords(tipo: string, records: CsvRecord[]): Promise<ImportResult> {
  if (!VALID_TIPOS.has(tipo as ImportTipo)) {
    throw new Error(`Tipo inválido: ${tipo}`)
  }

  const client = await getPgPool().connect()
  const warnings: string[] = []

  try {
    await client.query('BEGIN')

    let count = 0
    if (tipo === 'escolas') count = await importEscolas(client, records, warnings)
    if (tipo === 'etapas') count = await importEtapas(client, records, warnings)
    if (tipo === 'turmas') count = await importTurmas(client, records, warnings)
    if (tipo === 'professores') count = await importProfessores(client, records, warnings)
    if (tipo === 'alocacoes') count = await importAlocacoes(client, records, warnings)
    if (tipo === 'alunos') count = await importAlunos(client, records, warnings)

    await client.query('COMMIT')
    return { message: `Importados ${count} registros`, count, warnings }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
