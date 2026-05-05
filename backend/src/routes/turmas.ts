import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// GET /api/turmas - list turmas for logged-in professor
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const professorTurmas = await prisma.professorTurma.findMany({
      where: { professorId: req.professor!.id },
      include: {
        turma: {
          include: {
            escola: true,
            _count: { select: { alunos: { where: { ativo: true } } } },
          },
        },
      },
    });

    const turmas = professorTurmas.map((pt) => ({
      ...pt.turma,
      _count: pt.turma._count,
    }));

    res.json(turmas);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar turmas' });
  }
});

// GET /api/turmas/:id/alunos
router.get('/:id/alunos', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  // Check professor is assigned to this turma
  const assignment = await prisma.professorTurma.findFirst({
    where: { professorId: req.professor!.id, turmaId: id },
  });

  if (!assignment) {
    return res.status(403).json({ error: 'Acesso negado a esta turma' });
  }

  const alunos = await prisma.aluno.findMany({
    where: { turmaId: id, ativo: true },
    orderBy: { nome: 'asc' },
  });

  res.json(alunos);
});

export default router;
