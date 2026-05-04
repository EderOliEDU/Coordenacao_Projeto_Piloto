import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { authenticateJWT, JwtPayload } from '../middleware/jwtAuth';

const router = Router();

router.use(authenticateJWT);

// GET /api/turmas - lista turmas vinculadas ao professor autenticado
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const user = req.user as JwtPayload;
  try {
    // Para admin, retornar todas as turmas
    if (user.role === 'ADMIN') {
      const turmas = await prisma.turma.findMany({
        where: { ativo: true },
        include: {
          escola: true,
          _count: { select: { alunos: { where: { ativo: true } } } },
        },
        orderBy: [{ escola: { nome: 'asc' } }, { nome: 'asc' }],
      });
      res.json(turmas);
      return;
    }

    if (!user.googleId) {
      res.status(400).json({ error: 'Token inválido.' });
      return;
    }

    // Para professores, retornar somente turmas vinculadas
    const professor = await prisma.professor.findUnique({ where: { login: user.googleId } });
    if (!professor) {
      res.json([]);
      return;
    }

    const professorTurmas = await prisma.professorTurma.findMany({
      where: { professorId: professor.id },
      include: {
        turma: {
          include: {
            escola: true,
            _count: { select: { alunos: { where: { ativo: true } } } },
          },
        },
      },
    });

    res.json(professorTurmas.map((pt) => pt.turma));
  } catch (err) {
    console.error('[turmas] Erro:', (err as Error).message);
    res.status(500).json({ error: 'Erro ao buscar turmas.' });
  }
});

// GET /api/turmas/:id/alunos
router.get('/:id/alunos', async (req: Request, res: Response): Promise<void> => {
  const user = req.user as JwtPayload;
  const { id } = req.params;

  try {
    // Professores: verificar vínculo com a turma
    if (user.role !== 'ADMIN') {
      if (!user.googleId) {
        res.status(400).json({ error: 'Token inválido.' });
        return;
      }
      const professor = await prisma.professor.findUnique({ where: { login: user.googleId } });
      if (!professor) {
        res.status(403).json({ error: 'Acesso negado.' });
        return;
      }
      const assignment = await prisma.professorTurma.findFirst({
        where: { professorId: professor.id, turmaId: id },
      });
      if (!assignment) {
        res.status(403).json({ error: 'Acesso negado a esta turma.' });
        return;
      }
    }

    const alunos = await prisma.aluno.findMany({
      where: { turmaId: id, ativo: true },
      orderBy: { nome: 'asc' },
    });

    res.json(alunos);
  } catch (err) {
    console.error('[turmas/alunos] Erro:', (err as Error).message);
    res.status(500).json({ error: 'Erro ao buscar alunos.' });
  }
});

export default router;
