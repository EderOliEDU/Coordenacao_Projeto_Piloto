import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { authenticateJWT, JwtPayload } from '../middleware/jwtAuth';

const router = Router();

router.use(authenticateJWT);

// GET /api/submissoes?turmaId=&alunoId=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const user = req.user as JwtPayload;
  const { turmaId, alunoId } = req.query as { turmaId?: string; alunoId?: string };

  const where: Record<string, unknown> = {};
  if (turmaId) where.turmaId = turmaId;
  if (alunoId) where.alunoId = alunoId;

  try {
    // Professores só veem submissões de suas turmas
    if (user.role !== 'ADMIN' && user.googleId) {
      const professor = await prisma.professor.findUnique({ where: { login: user.googleId } });
      if (professor) {
        const turmas = await prisma.professorTurma.findMany({
          where: { professorId: professor.id },
          select: { turmaId: true },
        });
        const turmaIds = turmas.map((t) => t.turmaId);
        if (turmaId && !turmaIds.includes(turmaId)) {
          res.status(403).json({ error: 'Acesso negado a esta turma.' });
          return;
        }
        if (!turmaId) {
          where.turmaId = { in: turmaIds };
        }
      }
    }

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
  } catch (err) {
    console.error('[submissoes] Erro:', (err as Error).message);
    res.status(500).json({ error: 'Erro ao buscar submissões.' });
  }
});

// GET /api/submissoes/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
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

    if (!submissao) {
      res.status(404).json({ error: 'Submissão não encontrada.' });
      return;
    }
    res.json(submissao);
  } catch (err) {
    console.error('[submissoes/:id] Erro:', (err as Error).message);
    res.status(500).json({ error: 'Erro ao buscar submissão.' });
  }
});

// POST /api/submissoes
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const user = req.user as JwtPayload;
  const { formularioId, escolaId, turmaId, alunoId, respostas, observacoes } = req.body;

  if (!formularioId || !turmaId || !alunoId) {
    res.status(400).json({ error: 'formularioId, turmaId e alunoId são obrigatórios.' });
    return;
  }

  try {
    let professor = null;
    if (user.role !== 'ADMIN' && user.googleId) {
      professor = await prisma.professor.findUnique({ where: { login: user.googleId } });
      if (!professor) {
        res.status(403).json({ error: 'Professor não encontrado.' });
        return;
      }
      // Verificar vínculo com a turma
      const assignment = await prisma.professorTurma.findFirst({
        where: { professorId: professor.id, turmaId },
      });
      if (!assignment) {
        res.status(403).json({ error: 'Acesso negado a esta turma.' });
        return;
      }
    }

    // Verificar rascunho existente
    let submissao = await prisma.submissao.findFirst({
      where: { turmaId, alunoId, formularioId, status: 'RASCUNHO' },
    });

    if (submissao) {
      submissao = await prisma.submissao.update({
        where: { id: submissao.id },
        data: { observacoes },
      });
    } else {
      const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
      const resolvedEscolaId = escolaId || turma?.escolaId;
      if (!resolvedEscolaId) {
        res.status(400).json({ error: 'escolaId não encontrado.' });
        return;
      }

      submissao = await prisma.submissao.create({
        data: {
          formularioId,
          escolaId: resolvedEscolaId,
          turmaId,
          alunoId,
          observacoes,
          ...(professor && {
            professores: {
              create: { professorId: professor.id },
            },
          }),
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
  } catch (err) {
    console.error('[submissoes POST] Erro:', (err as Error).message);
    res.status(500).json({ error: 'Erro ao salvar submissão.' });
  }
});

// PUT /api/submissoes/:id/enviar
router.put('/:id/enviar', async (req: Request, res: Response): Promise<void> => {
  try {
    const submissao = await prisma.submissao.findUnique({ where: { id: req.params.id } });
    if (!submissao) {
      res.status(404).json({ error: 'Submissão não encontrada.' });
      return;
    }
    if (submissao.status === 'ENVIADA') {
      res.status(400).json({ error: 'Já enviada.' });
      return;
    }

    const updated = await prisma.submissao.update({
      where: { id: req.params.id },
      data: { status: 'ENVIADA', enviadaEm: new Date() },
    });

    res.json(updated);
  } catch (err) {
    console.error('[submissoes/enviar] Erro:', (err as Error).message);
    res.status(500).json({ error: 'Erro ao enviar submissão.' });
  }
});

export default router;
