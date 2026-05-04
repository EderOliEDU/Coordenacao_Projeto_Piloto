import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pgPool } from '../db/pg';
import { authenticateJWT, JwtPayload } from '../middleware/jwtAuth';
import { loginRateLimiter } from '../middleware/rateLimiter';

const router = Router();

const SALT_ROUNDS = 12;

/** Remove todos os caracteres não numéricos do CPF */
function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Aceita dois fluxos:
//   1) Admin via .env: { usuario: string, senha: string } onde usuario === ADMIN_USER
//   2) Professor via CPF+PostgreSQL: { cpf: string, senha: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', loginRateLimiter, async (req: Request, res: Response): Promise<void> => {
  const { cpf, usuario, senha } = req.body as { cpf?: string; usuario?: string; senha?: string };

  if (!senha) {
    res.status(400).json({ error: 'Senha é obrigatória.' });
    return;
  }

  // ── Fluxo Admin (via .env) ────────────────────────────────────────────────
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (usuario && usuario === adminUser) {
    if (!adminPassword) {
      console.error('[auth/login] ADMIN_PASSWORD não configurado no .env');
      res.status(500).json({ error: 'Erro interno de configuração.' });
      return;
    }

    let adminAuthenticated = false;
    // Comparar com hash bcrypt ou texto plano, dependendo do formato
    if (adminPassword.startsWith('$2')) {
      adminAuthenticated = await bcrypt.compare(senha, adminPassword);
    } else {
      adminAuthenticated = senha === adminPassword;
    }

    if (!adminAuthenticated) {
      res.status(401).json({ error: 'Usuário ou senha inválidos.' });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ error: 'Erro interno de configuração.' });
      return;
    }

    const payload: JwtPayload = {
      nome: 'Administrador',
      role: 'ADMIN',
    };

    const token = jwt.sign(payload, secret, { expiresIn: '8h' });

    res.json({
      token,
      user: {
        nome: 'Administrador',
        role: 'ADMIN',
      },
    });
    return;
  }

  // ── Fluxo Professor (CPF + PostgreSQL) ────────────────────────────────────
  const cpfInput = cpf || usuario;
  if (!cpfInput) {
    res.status(400).json({ error: 'CPF ou usuário são obrigatórios.' });
    return;
  }

  const cpfNorm = normalizeCpf(cpfInput);

  if (cpfNorm.length !== 11) {
    res.status(400).json({ error: 'CPF inválido. Informe 11 dígitos.' });
    return;
  }

  try {
    const result = await pgPool.query<{
      google_id: string;
      nome: string;
      email: string | null;
      cpf: string;
      data_nascimento: string | null;
      id_unidade: number | null;
      senha_hash: string | null;
      must_change_password: boolean | null;
    }>(
      `SELECT google_id, nome, email, cpf, data_nascimento, id_unidade,
              senha_hash, must_change_password
         FROM public.usuarios
        WHERE cpf = $1`,
      [cpfNorm]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'CPF ou senha inválidos.' });
      return;
    }

    const user = result.rows[0];
    let authenticated = false;

    if (user.senha_hash) {
      // Senha já foi definida — validar com bcrypt
      authenticated = await bcrypt.compare(senha, user.senha_hash);
    } else {
      // Primeiro login: senha provisória = data_nascimento (DDMMAAAA)
      if (user.data_nascimento && senha === user.data_nascimento) {
        // Gravar hash para logins futuros; manter must_change_password = true
        const hash = await bcrypt.hash(senha, SALT_ROUNDS);
        await pgPool.query(
          `UPDATE public.usuarios
              SET senha_hash = $1, must_change_password = true
            WHERE cpf = $2`,
          [hash, cpfNorm]
        );
        authenticated = true;
      }
    }

    if (!authenticated) {
      res.status(401).json({ error: 'CPF ou senha inválidos.' });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[auth/login] JWT_SECRET não configurado');
      res.status(500).json({ error: 'Erro interno de configuração.' });
      return;
    }

    const mustChange = user.must_change_password ?? true;

    const payload: JwtPayload = {
      googleId: user.google_id,
      cpf: user.cpf,
      nome: user.nome,
      idUnidade: user.id_unidade,
      mustChangePassword: mustChange,
      role: 'PROFESSOR',
    };

    const token = jwt.sign(payload, secret, { expiresIn: '8h' });

    res.json({
      token,
      user: {
        googleId: user.google_id,
        nome: user.nome,
        cpf: user.cpf,
        idUnidade: user.id_unidade,
        mustChangePassword: mustChange,
        role: 'PROFESSOR',
      },
    });
  } catch (error) {
    console.error('[auth/login] Erro:', (error as Error).message);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/change-password
// Header: Authorization: Bearer <token>
// Body: { senhaAtual: string, novaSenha: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/change-password',
  authenticateJWT,
  async (req: Request, res: Response): Promise<void> => {
    const { senhaAtual, novaSenha } = req.body as {
      senhaAtual?: string;
      novaSenha?: string;
    };

    if (!senhaAtual || !novaSenha) {
      res.status(400).json({ error: 'senhaAtual e novaSenha são obrigatórios.' });
      return;
    }

    if (novaSenha.length < 8) {
      res.status(400).json({ error: 'A nova senha deve ter pelo menos 8 caracteres.' });
      return;
    }

    // Exigir ao menos uma letra e um número
    if (!/[A-Za-z]/.test(novaSenha) || !/[0-9]/.test(novaSenha)) {
      res.status(400).json({ error: 'A nova senha deve conter pelo menos uma letra e um número.' });
      return;
    }

    const user = req.user as JwtPayload;

    // Admin não pode trocar senha via este endpoint (gerenciado pelo .env)
    if (user.role === 'ADMIN') {
      res.status(400).json({ error: 'Administrador deve alterar a senha via variável de ambiente ADMIN_PASSWORD.' });
      return;
    }

    if (!user.cpf) {
      res.status(400).json({ error: 'Token inválido: CPF ausente.' });
      return;
    }

    try {
      const result = await pgPool.query<{
        senha_hash: string | null;
        data_nascimento: string | null;
      }>(
        'SELECT senha_hash, data_nascimento FROM public.usuarios WHERE cpf = $1',
        [user.cpf]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Usuário não encontrado.' });
        return;
      }

      const dbUser = result.rows[0];
      let currentPasswordValid = false;

      if (dbUser.senha_hash) {
        currentPasswordValid = await bcrypt.compare(senhaAtual, dbUser.senha_hash);
      } else {
        // Usuário ainda não tem senha_hash — comparar com data_nascimento
        currentPasswordValid =
          dbUser.data_nascimento !== null && senhaAtual === dbUser.data_nascimento;
      }

      if (!currentPasswordValid) {
        res.status(401).json({ error: 'Senha atual incorreta.' });
        return;
      }

      const newHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
      await pgPool.query(
        `UPDATE public.usuarios
            SET senha_hash = $1, must_change_password = false
          WHERE cpf = $2`,
        [newHash, user.cpf]
      );

      res.json({ message: 'Senha alterada com sucesso.' });
    } catch (error) {
      console.error('[auth/change-password] Erro:', (error as Error).message);
      res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }
);

export default router;
