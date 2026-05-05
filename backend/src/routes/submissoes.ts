import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// GET /api/submissoes?turmaId=&alunoId=
router.get('/', async (req: AuthRequest, res: Response) => {
  const { turmaId, alunoId } = req.query as { turmaId?: string; alunoId?: string };

  const where: any = {};
  if (turmaId) where.turmaId = turmaId;
  if (alunoId) where.alunoId = alunoId;

  const submissoes = await prisma.submissao.findMany({
    where,
    include: {
      aluno: true,
      turma: { include: { escola: true } },
      formulario: true,
      _count: { select: { respostas: true } },
    },
    orderBy: { criadaEm: 'desc' },
  });

  res.json(submissoes);
});

// GET /api/submissoes/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const submissao = await prisma.submissao.findUnique({
    where: { id: req.params.id },
    include: {
      aluno: true,
      turma: { include: { escola: true } },
      formulario: {
        include: {
          secoes: {
            orderBy: { ordem: 'asc' },
            include: {
              perguntas: {
                orderBy: { ordem: 'asc' },
                include: { escala: { include: { opcoes: { orderBy: { ordem: 'asc' } } } } },
              },
            },
          },
        },
      },
      respostas: { include: { opcaoEscala: true, pergunta: true } },
    },
  });

  if (!submissao) return res.status(404).json({ error: 'Submissão não encontrada' });
  res.json(submissao);
});

// POST /api/submissoes
router.post('/', async (req: AuthRequest, res: Response) => {
  const { formularioId, escolaId, turmaId, alunoId, respostas, observacoes } = req.body;

  // Check professor is assigned to turma
  const assignment = await prisma.professorTurma.findFirst({
    where: { professorId: req.professor!.id, turmaId },
  });
  if (!assignment) return res.status(403).json({ error: 'Acesso negado a esta turma' });

  // Check for existing rascunho
  let submissao = await prisma.submissao.findFirst({
    where: { turmaId, alunoId, formularioId, status: 'RASCUNHO' },
  });

  if (submissao) {
    // Update existing
    submissao = await prisma.submissao.update({
      where: { id: submissao.id },
      data: { observacoes },
    });
  } else {
    submissao = await prisma.submissao.create({
      data: {
        formularioId,
        escolaId,
        turmaId,
        alunoId,
        observacoes,
        professores: {
          create: { professorId: req.professor!.id },
        },
      },
    });
  }

  // Upsert respostas
  if (respostas && Array.isArray(respostas)) {
    for (const r of respostas) {
      await prisma.resposta.upsert({
        where: { submissaoId_perguntaId: { submissaoId: submissao.id, perguntaId: r.perguntaId } },
        create: { submissaoId: submissao.id, perguntaId: r.perguntaId, opcaoEscalaId: r.opcaoEscalaId },
        update: { opcaoEscalaId: r.opcaoEscalaId },
      });
    }
  }

  res.json(submissao);
});

// PUT /api/submissoes/:id/enviar
router.put('/:id/enviar', async (req: AuthRequest, res: Response) => {
  const submissao = await prisma.submissao.findUnique({ where: { id: req.params.id } });
  if (!submissao) return res.status(404).json({ error: 'Submissão não encontrada' });
  if (submissao.status === 'ENVIADA') return res.status(400).json({ error: 'Já enviada' });

  const updated = await prisma.submissao.update({
    where: { id: req.params.id },
    data: { status: 'ENVIADA', enviadaEm: new Date() },
  });

  res.json(updated);
});

export default router;
