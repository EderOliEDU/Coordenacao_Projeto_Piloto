import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../services/ldap';

const router = Router();
const prisma = new PrismaClient();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});

router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { login, senha, password } = req.body;
  const pwd = senha || password;

  if (!login || !pwd) {
    return res.status(400).json({ error: 'Login e senha são obrigatórios' });
  }

  try {
    const ldapUser = await authenticate(login, pwd);

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

    const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as any;
    const token = jwt.sign(
      { id: professor.id, login: professor.login, nome: professor.nome },
      process.env.JWT_SECRET!,
      { expiresIn }
    );

    res.json({ token, professor: { id: professor.id, nome: professor.nome, login: professor.login } });
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Autenticação falhou' });
  }
});

export default router;
