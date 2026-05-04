import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { authenticateJWT } from '../middleware/jwtAuth';

const router = Router();

router.use(authenticateJWT);

// GET /api/formularios/ativo
router.get('/ativo', async (_req: Request, res: Response): Promise<void> => {
  try {
    const formulario = await prisma.formulario.findFirst({
      where: { ativo: true },
      include: {
        secoes: {
          orderBy: { ordem: 'asc' },
          include: {
            perguntas: {
              orderBy: { ordem: 'asc' },
              include: {
                escala: {
                  include: {
                    opcoes: { orderBy: { ordem: 'asc' } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!formulario) {
      res.status(404).json({ error: 'Nenhum formulário ativo encontrado.' });
      return;
    }

    res.json(formulario);
  } catch (err) {
    console.error('[formularios] Erro:', (err as Error).message);
    res.status(500).json({ error: 'Erro ao buscar formulário.' });
  }
});

export default router;
