import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// GET /api/formularios/ativo
router.get('/ativo', async (req: Request, res: Response) => {
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

  if (!formulario) return res.status(404).json({ error: 'Nenhum formulário ativo encontrado' });

  res.json(formulario);
});

export default router;
