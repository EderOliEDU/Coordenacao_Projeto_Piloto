import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import prisma from '../db/prisma';
import { authenticateJWT, requireAdmin } from '../middleware/jwtAuth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Todas as rotas de importação exigem admin
router.use(authenticateJWT, requireAdmin);

router.post('/importar/:tipo', upload.single('arquivo'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'Arquivo CSV obrigatório.' });
    return;
  }

  const tipo = req.params.tipo;
  const records = parse(req.file.buffer.toString('utf-8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  try {
    let count = 0;
    const warnings: string[] = [];

    if (tipo === 'escolas') {
      for (const r of records) {
        if (r.id) {
          await prisma.escola.upsert({
            where: { id: r.id },
            create: { id: r.id, nome: r.nome, municipio: r.municipio, uf: r.uf },
            update: { nome: r.nome, municipio: r.municipio, uf: r.uf },
          });
        } else {
          await prisma.escola.create({
            data: { nome: r.nome, municipio: r.municipio, uf: r.uf },
          });
        }
        count++;
      }
    } else if (tipo === 'turmas') {
      for (const r of records) {
        const escola = await prisma.escola.findFirst({ where: { nome: r.escolaNome } });
        if (!escola) {
          warnings.push(`Escola não encontrada: "${r.escolaNome}" — linha ignorada`);
          continue;
        }
        await prisma.turma.create({
          data: {
            nome: r.nome,
            codigo: r.codigo,
            anoLetivo: parseInt(r.anoLetivo),
            turno: r.turno,
            escolaId: escola.id,
          },
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
        if (!professor) {
          warnings.push(`Professor não encontrado: "${r.professorLogin}" — linha ignorada`);
          continue;
        }
        if (!turma) {
          warnings.push(`Turma não encontrada: "${r.turmaNome}" — linha ignorada`);
          continue;
        }
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
        if (!turma) {
          warnings.push(`Turma não encontrada: "${r.turmaNome}" — aluno "${r.nome}" ignorado`);
          continue;
        }
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
      res.status(400).json({ error: `Tipo inválido: ${tipo}` });
      return;
    }

    res.json({ message: `Importados ${count} registros`, count, warnings });
  } catch (err) {
    console.error('[importacao] Erro:', (err as Error).message);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
