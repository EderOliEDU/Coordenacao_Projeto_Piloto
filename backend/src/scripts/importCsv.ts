import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'
import { importCsvRecords, parseCsvContent } from '../services/csvImport'

dotenv.config({ path: path.join(__dirname, '../../.env') })

async function main() {
  const args = process.argv.slice(2)
  const tipoIdx = args.indexOf('--tipo')
  const arquivoIdx = args.indexOf('--arquivo')

  if (tipoIdx === -1 || arquivoIdx === -1) {
    console.error('Uso: ts-node src/scripts/importCsv.ts --tipo <tipo> --arquivo <arquivo>')
    console.error('Tipos: escolas, etapas, turmas, professores, alocacoes, alunos')
    process.exit(1)
  }

  const tipo = args[tipoIdx + 1]
  const arquivo = args[arquivoIdx + 1]

  if (!fs.existsSync(arquivo)) {
    console.error(`Arquivo não encontrado: ${arquivo}`)
    process.exit(1)
  }

  const records = parseCsvContent(fs.readFileSync(arquivo, 'utf-8'))
  console.log(`Importando ${records.length} registros do tipo "${tipo}"...`)

  const result = await importCsvRecords(tipo, records)
  for (const warning of result.warnings) {
    console.warn(`Aviso: ${warning}`)
  }
  console.log(result.message)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
