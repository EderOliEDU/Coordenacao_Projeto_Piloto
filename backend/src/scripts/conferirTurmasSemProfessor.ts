import dotenv from 'dotenv'
import path from 'path'
import { getPgPool } from '../services/pgPool'

const PROJETO_INSTRUCAO_FONICA = 'PJINSTFONI'
const ADMIN_CPFS = ['65495934172', '05365763190']

type TurmaSemProfessor = {
  id_turma: string
  escola_nome: string | null
  etapa_descricao: string | null
  letra_turma: string | null
  turno: string | null
  alunos_count: string
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
  ts-node src/scripts/conferirTurmasSemProfessor.ts [--env <arquivo>] [--todas-escolas] [--json]

Exemplos:
  ts-node src/scripts/conferirTurmasSemProfessor.ts --env .env_dev
  npm run turmas:sem-professor -- --env .env_dev
  npm run turmas:sem-professor -- --todas-escolas --json

Por padrao, confere apenas turmas do projeto ${PROJETO_INSTRUCAO_FONICA}.
Use --todas-escolas para conferir todas as turmas cadastradas no banco.
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
      if (!hasFlag('--json')) {
        console.log(`Ambiente carregado de ${candidate}`)
      }
      return
    }
  }

  dotenv.config()
}

function formatarNomeTurma(turma: TurmaSemProfessor) {
  const etapa = (turma.etapa_descricao || 'Etapa nao informada').trim()
  const letra = (turma.letra_turma || turma.id_turma).trim()
  return `Turma ${etapa} ${letra}`
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    printUsage()
    return
  }

  const todasEscolas = hasFlag('--todas-escolas')
  const json = hasFlag('--json')

  carregarEnv()

  const pool = getPgPool()

  try {
    const whereProjeto = todasEscolas
      ? ''
      : `
        WHERE e.projeto = $1
          AND et.projeto = $1
        `

    const { rows } = await pool.query<TurmaSemProfessor>(
      `
      SELECT
        t.id_turma::text                  AS id_turma,
        e.nome_escola::text               AS escola_nome,
        et.descricao::text                AS etapa_descricao,
        t.letra_turma::text               AS letra_turma,
        t.turno::text                     AS turno,
        COUNT(DISTINCT ea.id_aluno)::text AS alunos_count
      FROM public.turmas t
      JOIN public.escolas e ON e.id_escola = t.id_escola
      JOIN public.etapas et ON et.id_etapa = t.id_etapa
      LEFT JOIN public.enturmacao_aluno ea ON ea.id_turma = t.id_turma
      LEFT JOIN public.atribuicao_professor ap ON ap.id_turma = t.id_turma
      ${whereProjeto}
      GROUP BY t.id_turma, t.letra_turma, t.turno, e.nome_escola, et.descricao
      HAVING COUNT(DISTINCT NULLIF(regexp_replace(COALESCE(ap.cpf_professor::text, ''), '\\D', '', 'g'), ''))
        FILTER (
          WHERE regexp_replace(COALESCE(ap.cpf_professor::text, ''), '\\D', '', 'g') <> ALL($${todasEscolas ? 1 : 2}::text[])
        ) = 0
      ORDER BY e.nome_escola NULLS LAST, et.descricao NULLS LAST, t.letra_turma NULLS LAST, t.id_turma;
      `,
      todasEscolas ? [ADMIN_CPFS] : [PROJETO_INSTRUCAO_FONICA, ADMIN_CPFS]
    )

    const resultado = rows.map((turma) => ({
      idTurma: turma.id_turma,
      escola: turma.escola_nome || '',
      turma: formatarNomeTurma(turma),
      etapa: turma.etapa_descricao || '',
      letra: turma.letra_turma || '',
      turno: turma.turno || '',
      alunos: Number(turma.alunos_count || 0),
    }))

    if (json) {
      console.log(JSON.stringify(resultado, null, 2))
      return
    }

    console.log('')
    console.log(`Turmas sem professor: ${resultado.length}`)
    console.log(`Escopo: ${todasEscolas ? 'todas as escolas' : `projeto ${PROJETO_INSTRUCAO_FONICA}`}`)
    console.log('')

    if (resultado.length === 0) {
      console.log('Nenhuma turma sem professor encontrada.')
      return
    }

    console.table(resultado)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Erro ao conferir turmas sem professor:', err.message || err)
  process.exit(1)
})
