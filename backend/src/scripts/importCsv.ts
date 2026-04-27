import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const tipoIdx = args.indexOf('--tipo');
  const arquivoIdx = args.indexOf('--arquivo');

  if (tipoIdx === -1 || arquivoIdx === -1) {
    console.error('Uso: ts-node src/scripts/importCsv.ts --tipo <tipo> --arquivo <arquivo>');
    console.error('Tipos: escolas, turmas, professores, alocacoes, alunos');
    process.exit(1);
  }

  const tipo = args[tipoIdx + 1];
  const arquivo = args[arquivoIdx + 1];

  if (!fs.existsSync(arquivo)) {
    console.error(`Arquivo não encontrado: ${arquivo}`);
    process.exit(1);
  }

  const content = fs.readFileSync(arquivo, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });

  console.log(`Importando ${records.length} registros do tipo "${tipo}"...`);
  let count = 0;

  if (tipo === 'escolas') {
    for (const r of records) {
      if (r.id) {
        await prisma.escola.upsert({
          where: { id: r.id },
          create: { id: r.id, nome: r.nome, municipio: r.municipio, uf: r.uf },
          update: { nome: r.nome, municipio: r.municipio, uf: r.uf },
        });
      } else {
        await prisma.escola.create({ data: { nome: r.nome, municipio: r.municipio, uf: r.uf } });
      }
      count++;
    }
  } else if (tipo === 'turmas') {
    for (const r of records) {
      const escola = await prisma.escola.findFirst({ where: { nome: r.escolaNome } });
      if (!escola) { console.warn(`Escola não encontrada: ${r.escolaNome}`); continue; }
      await prisma.turma.create({
        data: { nome: r.nome, codigo: r.codigo, anoLetivo: parseInt(r.anoLetivo), turno: r.turno, escolaId: escola.id },
      });
      count++;
    }
  } else if (tipo === 'professores') {
    for (const r of records) {
      await prisma.professor.upsert({
        where: { login: r.login },
        create: { nome: r.nome, login: r.login, email: r.email, matricula: r.matricula },
        update: { nome: r.nome, email: r.email, matricula: r.matricula },
      });
      count++;
    }
  } else if (tipo === 'alocacoes') {
    for (const r of records) {
      const professor = await prisma.professor.findUnique({ where: { login: r.professorLogin } });
      const turma = await prisma.turma.findFirst({ where: { nome: r.turmaNome } });
      if (!professor || !turma) { console.warn(`Professor ou turma não encontrados`); continue; }
      await prisma.professorTurma.upsert({
        where: { professorId_turmaId: { professorId: professor.id, turmaId: turma.id } },
        create: { professorId: professor.id, turmaId: turma.id },
        update: {},
      });
      count++;
    }
  } else if (tipo === 'alunos') {
    for (const r of records) {
      const turma = await prisma.turma.findFirst({ where: { nome: r.turmaNome } });
      if (!turma) { console.warn(`Turma não encontrada: ${r.turmaNome}`); continue; }
      await prisma.aluno.create({
        data: {
          nome: r.nome,
          matricula: r.matricula,
          dataNascimento: r.dataNascimento ? new Date(r.dataNascimento) : undefined,
          sexo: r.sexo,
          turmaId: turma.id,
        },
      });
      count++;
    }
  } else {
    console.error(`Tipo inválido: ${tipo}`);
    process.exit(1);
  }

  console.log(`✓ ${count} registros importados com sucesso`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
