import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { authenticate } from '../services/ldap';
import { authenticateByCpf } from '../services/cpfAuth';
import { getPgPool } from '../services/pgPool';
import { getUserPermissions } from '../services/permissions';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendPasswordSetupEmail } from '../services/mail';

const router = Router();
const pool = getPgPool();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});

function onlyDigits(value: string): string {
  return (value || '').replace(/\D/g, '');
}

function looksLikeCpf(login: string): boolean {
  const bare = onlyDigits(login);
  return bare.length === 11 && /^\d{11}$/.test(bare);
}

function buildPasswordSetupLink(token: string): string {
  const baseUrl = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${baseUrl}/cadastrar-senha?token=${encodeURIComponent(token)}`;
}

async function sendPasswordSetupForCpf(cpfInput: string) {
  const cpf = onlyDigits(cpfInput).padStart(11, '0');
  const client = await pool.connect();
  try {
    const result = await client.query<{
      cpf: string;
      nome: string;
      email: string | null;
      senha: string | null;
    }>(
      `SELECT
          regexp_replace(profissional_cpf, '\\D', '', 'g') AS cpf,
          COALESCE(NULLIF(trim(profissional_nome_social), ''), NULLIF(trim(profissional_nome), ''), '') AS nome,
          COALESCE(NULLIF(trim(corporativo_e_mail), ''), NULLIF(trim(profissional_e_mail), '')) AS email,
          senha
       FROM public.professores
       WHERE regexp_replace(profissional_cpf, '\\D', '', 'g') = $1
       LIMIT 1`,
      [cpf]
    );

    if (result.rowCount === 0) {
      throw new Error('Usuário não encontrado');
    }

    const professor = result.rows[0];
    if ((professor.senha || '').trim()) {
      throw new Error('Senha já cadastrada. Informe sua senha para entrar.');
    }

    if (!professor.email) {
      throw new Error('Professor sem e-mail cadastrado. Procure a coordenação para atualizar o cadastro.');
    }

    const token = jwt.sign(
      { purpose: 'password_setup', cpf: professor.cpf, nome: professor.nome },
      process.env.JWT_SECRET!,
      { expiresIn: '2h' }
    );

    await sendPasswordSetupEmail(professor.email, professor.nome || 'professor(a)', buildPasswordSetupLink(token));
  } finally {
    client.release();
  }
}

router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { login, senha, password } = req.body;
  const pwd = senha || password || '';

  if (!login) {
    return res.status(400).json({ error: 'Login é obrigatório' });
  }

  if (looksLikeCpf(login) && !pwd) {
    try {
      await sendPasswordSetupForCpf(login);
      return res.json({
        ok: true,
        message: 'Enviamos um link para cadastrar sua senha no e-mail corporativo.',
      });
    } catch (err: any) {
      console.error('Falha ao enviar cadastro de senha:', err);
      return res.status(400).json({ error: err.message || 'Não foi possível enviar o link de cadastro de senha' });
    }
  }

  if (!pwd) {
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
      professorEmail = cpfUser.email;
      mustChangePassword = cpfUser.mustChangePassword;
    } else {
      // Standard LDAP/AD authentication
      const ldapUser = await authenticate(login, pwd);
      professorLogin = ldapUser.login;
      professorNome = ldapUser.nome;
      professorEmail = ldapUser.email;
    }

    // Upsert professor na tabela professores (Postgres)
    const client = await pool.connect();
    let professor;
    try {
      const upsertQuery = `
        INSERT INTO professores (profissional_cpf, profissional_nome, profissional_e_mail)
        VALUES ($1, $2, $3)
        ON CONFLICT (profissional_cpf)
        DO UPDATE SET
          profissional_nome = EXCLUDED.profissional_nome,
          profissional_e_mail = COALESCE(EXCLUDED.profissional_e_mail, professores.profissional_e_mail)
        RETURNING profissional_cpf, profissional_nome
      `;
      const result = await client.query(upsertQuery, [professorLogin, professorNome, professorEmail]);
      professor = result.rows[0];
    } finally {
      client.release();
    }

    const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as `${number}${'s' | 'm' | 'h' | 'd' | 'w'}`;
    const permissoes = getUserPermissions(professor.profissional_cpf);
    const token = jwt.sign(
      {
        cpf: professor.profissional_cpf,
        nome: professor.profissional_nome,
        login: professor.profissional_cpf,
        permissoes,
      },
      process.env.JWT_SECRET!,
      { expiresIn }
    );

    const responseBody: Record<string, unknown> = {
      token,
      professor: {
        cpf: professor.profissional_cpf,
        nome: professor.profissional_nome,
        permissoes,
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

router.post('/cadastrar-senha', async (req: Request, res: Response) => {
  const { token, password, confirmPassword } = req.body;

  if (!token) return res.status(400).json({ error: 'Token obrigatório' });
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'As senhas não conferem' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    if (payload.purpose !== 'password_setup' || !payload.cpf) {
      return res.status(400).json({ error: 'Token inválido' });
    }

    const cpf = onlyDigits(payload.cpf).padStart(11, '0');
    const senhaHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `UPDATE public.professores
       SET senha = $1
       WHERE regexp_replace(profissional_cpf, '\\D', '', 'g') = $2`,
      [senhaHash, cpf]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

    return res.json({ ok: true, message: 'Senha cadastrada com sucesso. Você já pode entrar no sistema.' });
  } catch (err: any) {
    console.error('Falha ao cadastrar senha:', err);
    return res.status(400).json({ error: 'Link inválido ou expirado' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const cpf = req.professor?.cpf || req.professor?.login || '';
  const permissoes = getUserPermissions(cpf);
  res.json({
    professor: {
      cpf,
      nome: req.professor?.nome || '',
      permissoes,
    },
  });
});

export default router;

