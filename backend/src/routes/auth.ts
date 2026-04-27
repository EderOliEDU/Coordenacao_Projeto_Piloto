import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../services/ldap';

const router = Router();
const prisma = new PrismaClient();

router.post('/login', async (req: Request, res: Response) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Login e senha são obrigatórios' });
  }

  try {
    const ldapUser = await authenticate(login, password);

    // Upsert professor
    let professor = await prisma.professor.findUnique({ where: { login: ldapUser.login } });

    if (!professor) {
      professor = await prisma.professor.create({
        data: {
          login: ldapUser.login,
          nome: ldapUser.nome,
          email: ldapUser.email,
        },
      });
    }

    const token = jwt.sign(
      { id: professor.id, login: professor.login, nome: professor.nome },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' } as any
    );

    res.json({ token, professor: { id: professor.id, nome: professor.nome, login: professor.login } });
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Autenticação falhou' });
  }
});

export default router;
