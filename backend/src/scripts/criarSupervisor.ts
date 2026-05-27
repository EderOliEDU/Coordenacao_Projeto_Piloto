import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import path from 'path'
import { getPgPool } from '../services/pgPool'

const ESCOLAS_PARTICIPANTES = [
  'EMEI Mateus Vinicius Braz',
  'EMEI Rubens Alves de Souza',
  'EMEI Elaine Aparecida de Oliveira Lopes',
  'EMEI Cora Coralina',
  'CMEI Antônio Vanier',
  'CMEI Widisney Aparecido Pereira Rodrigues',
  'CMEI Celina Fialho Bezerra',
  'EMCEB Rural Fazenda Carimã',
  'CMEI LEONESE DE PINHO CARVALHO'
]

function normalizarCpf(value: string) {
  return (value || '').replace(/\D/g, '')
}

function getArg(name: string) {
  const idx = process.argv.indexOf(name)
  return idx >= 0 ? process.argv[idx + 1] : undefined
}

function hasFlag(name: string) {
  return process.argv.includes(name)
}

function printUsage() {
  console.log(`
Uso:
  ts-node src/scripts/criarSupervisor.ts --cpf <cpf> --nome "<nome>" --senha "<senha>" [--email <email>] [--env <arquivo>] [--todas-escolas]

Exemplo:
  ts-node src/scripts/criarSupervisor.ts --env .env_dev --cpf 12345678900 --nome "Supervisor Projeto Piloto" --senha "Senha@123"

Por padrao, o acesso e criado para as 8 escolas participantes do projeto.
Use --todas-escolas para vincular o supervisor a todas as turmas cadastradas no banco.
`)
}

function carregarEnv() {
  const envArg = getArg('--env')
  const candidates = envArg
    ? [path.resolve(process.cwd(), envArg)]
    : [
        path.join(__dirname, '../../.env'),
        path.join(__dirname, '../../.env_dev'),
      ]

  for (const candidate of candidates) {
    const result = dotenv.config({ path: candidate })
    if (!result.error) {
      console.log(`Ambiente carregado de ${candidate}`)
      return
    }
  }

  dotenv.config()
}

async function main() {
  const cpf = normalizarCpf(getArg('--cpf') || '')
  const nome = (getArg('--nome') || '').trim()
  const senha = getArg('--senha') || ''
  const email = (getArg('--email') || '').trim() || null
  const todasEscolas = hasFlag('--todas-escolas')

  if (!cpf || cpf.length !== 11 || !nome || !senha) {
    printUsage()
    process.exit(1)
  }

  carregarEnv()

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const senhaHash = await bcrypt.hash(senha, 10)
    await client.query(
      `
      INSERT INTO public.professores (profissional_cpf, profissional_nome, profissional_e_mail, senha)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (profissional_cpf)
      DO UPDATE SET
        profissional_nome = EXCLUDED.profissional_nome,
        profissional_e_mail = EXCLUDED.profissional_e_mail,
        senha = EXCLUDED.senha
      `,
      [cpf, nome, email, senhaHash]
    )

    const turmasQuery = todasEscolas
      ? `
        SELECT t.id_turma, e.nome_escola
        FROM public.turmas t
        JOIN public.escolas e ON e.id_escola = t.id_escola
        ORDER BY e.nome_escola, t.id_turma
        `
      : `
        SELECT t.id_turma, e.nome_escola
        FROM public.turmas t
        JOIN public.escolas e ON e.id_escola = t.id_escola
        WHERE e.nome_escola = ANY($1::text[])
        ORDER BY e.nome_escola, t.id_turma
        `

    const turmasRes = await client.query(
      turmasQuery,
      todasEscolas ? [] : [ESCOLAS_PARTICIPANTES]
    )

    if (turmasRes.rowCount === 0) {
      throw new Error('Nenhuma turma encontrada para as escolas selecionadas.')
    }

    let vinculadas = 0
    for (const turma of turmasRes.rows) {
      const existe = await client.query(
        `
        SELECT 1
        FROM public.atribuicao_professor
        WHERE cpf_professor = $1 AND id_turma = $2
        LIMIT 1
        `,
        [cpf, turma.id_turma]
      )

      if ((existe.rowCount || 0) > 0) {
        continue
      }

      await client.query(
        `
        INSERT INTO public.atribuicao_professor (cpf_professor, id_turma)
        VALUES ($1, $2)
        `,
        [cpf, turma.id_turma]
      )
      vinculadas += 1
    }

    await client.query('COMMIT')

    const escolas = Array.from(new Set(turmasRes.rows.map((turma) => turma.nome_escola))).length
    console.log('Supervisor criado/atualizado com sucesso.')
    console.log(`CPF: ${cpf}`)
    console.log(`Escolas contempladas: ${escolas}`)
    console.log(`Turmas encontradas: ${turmasRes.rowCount}`)
    console.log(`Novas vinculacoes criadas: ${vinculadas}`)
    console.log('')
    console.log('Para liberar a tela Resultados, inclua este CPF em RESULTADOS_ALLOWED_CPFS e reinicie o backend.')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Erro ao criar supervisor:', err.message || err)
  process.exit(1)
})
