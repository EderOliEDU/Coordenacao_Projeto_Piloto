import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../services/ldap';
import { authenticateByCpf } from '../services/cpfAuth';

const router = Router();
const prisma = new PrismaClient();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});

/** Returns true when the string looks like a Brazilian CPF:
 *  - exactly 11 digits (bare), or
 *  - formatted as DDD.DDD.DDD-DD
 */
function looksLikeCpf(login: string): boolean {
  const bare = login.replace(/\D/g, '');
  return bare.length === 11 && /^\d{11}$/.test(bare);
}

router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { login, senha, password } = req.body;
  const pwd = senha || password;

  if (!login || !pwd) {
    return res.status(400).json({ error: 'Login e senha são obrigatórios' });
  }

  try {
    let professorLogin: string;
    let professorNome: string;
    let professorEmail: string | undefined;
    let mustChangePassword = false;

    if (looksLikeCpf(login)) {
      // CPF-based authentication against Postgres public.usuarios
      const cpfUser = await authenticateByCpf(login, pwd);
      professorLogin = cpfUser.cpf; // normalised 11-digit CPF
      professorNome = cpfUser.nome;
      mustChangePassword = cpfUser.mustChangePassword;
    } else {
      // Standard LDAP/AD authentication
      const ldapUser = await authenticate(login, pwd);
      professorLogin = ldapUser.login;
      professorNome = ldapUser.nome;
      professorEmail = ldapUser.email;
    }

    // Upsert professor into the local SQLite database
    let professor = await prisma.professor.findUnique({ where: { login: professorLogin } });

    if (!professor) {
      professor = await prisma.professor.create({
        data: {
          login: professorLogin,
          nome: professorNome,
          email: professorEmail,
        },
      });
    }

    const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as `${number}${'s' | 'm' | 'h' | 'd' | 'w'}`;
    const token = jwt.sign(
      { id: professor.id, login: professor.login, nome: professor.nome },
      process.env.JWT_SECRET!,
      { expiresIn }
    );

    const responseBody: Record<string, unknown> = {
      token,
      professor: { id: professor.id, nome: professor.nome, login: professor.login },
    };

    if (mustChangePassword) {
      responseBody.mustChangePassword = true;
    }

    res.json(responseBody);
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Autenticação falhou' });
  }
});

export default router;
