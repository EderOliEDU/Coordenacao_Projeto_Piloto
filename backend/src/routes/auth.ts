import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../services/ldap';
import { authenticateByCpf } from '../services/cpfAuth';
import { getPgPool } from '../services/pgPool';

const router = Router();
const pool = getPgPool();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});

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
      //professorEmail = ldapUser.email;
    }

    // Upsert professor na tabela professores (Postgres)
    const client = await pool.connect();
    let professor;
    try {
      const upsertQuery = `
        INSERT INTO professores (profissional_cpf, profissional_nome, profissional_e_mail)
        VALUES ($1, $2, $3)
        ON CONFLICT (profissional_cpf)
        DO UPDATE SET profissional_nome = EXCLUDED.profissional_nome, profissional_e_mail = EXCLUDED.profissional_e_mail
        RETURNING profissional_cpf, profissional_nome
      `;
      const result = await client.query(upsertQuery, [professorLogin, professorNome, professorEmail]);
      professor = result.rows[0];
    } finally {
      client.release();
    }

    const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as `${number}${'s' | 'm' | 'h' | 'd' | 'w'}`;
    const token = jwt.sign(
      {
        cpf: professor.profissional_cpf,
        nome: professor.profissional_nome,
        login: professor.profissional_cpf,
      },
      process.env.JWT_SECRET!,
      { expiresIn }
    );

    const responseBody: Record<string, unknown> = {
      token,
      professor: {
        cpf: professor.profissional_cpf,
        nome: professor.profissional_nome
      },
    };

    if (mustChangePassword) {
      responseBody.mustChangePassword = true;
    }

    res.json(responseBody);
  } catch (err: any) {
    // log detalhado no servidor para depuração
    console.error('Falha no login:', err);
    res.status(401).json({ error: err.message || 'Autenticação falhou' });
  }
});

export default router;
