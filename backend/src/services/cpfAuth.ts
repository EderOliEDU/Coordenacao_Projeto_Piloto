import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface CpfUser {
  cpf: string;
  nome: string;
  email?: string;
  mustChangePassword: boolean;
}

/** Strip every non-digit character from a string. */
function onlyDigits(s: string): string {
  return (s ?? '').replace(/\D/g, '');
}

function md5Hex(s: string): string {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}

function looksLikeMd5(hex: string): boolean {
  return /^[a-f0-9]{32}$/i.test((hex ?? '').trim());
}

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      host: process.env.PILOTO_PG_HOST,
      port: process.env.PILOTO_PG_PORT ? parseInt(process.env.PILOTO_PG_PORT, 10) || 5432 : 5432,
      database: process.env.PILOTO_PG_DB,
      user: process.env.PILOTO_PG_USER,
      password: process.env.PILOTO_PG_PASSWORD,
      ssl: (process.env.PILOTO_PG_SSL ?? '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined,
    });
  }
  return _pool;
}

export async function authenticateByCpf(cpf: string, password: string): Promise<CpfUser> {
  const cpfNorm = onlyDigits(cpf).padStart(11, '0');
  if (cpfNorm.length !== 11) throw new Error('CPF inválido');

  const pool = getPool();

  const result = await pool.query<{
    cpf: string;
    nome: string;
    senha: string | null;
  }>(
    `SELECT
        regexp_replace(profissional_cpf, '\\D', '', 'g') as cpf,
        COALESCE(NULLIF(trim(profissional_nome_social), ''), NULLIF(trim(profissional_nome), ''), '') as nome,
        senha
     FROM public.professores
     WHERE regexp_replace(profissional_cpf, '\\D', '', 'g') = $1
     LIMIT 1`,
    [cpfNorm]
  );

  if (result.rowCount === 0) {
    console.warn(`[cpfAuth] CPF ${cpfNorm.slice(0, 3)}***${cpfNorm.slice(-2)} não encontrado`);
    throw new Error('Usuário não encontrado');
  }

  const user = result.rows[0];
  const stored = (user.senha ?? '').trim();

  if (!stored) {
    throw new Error('Senha inválida');
  }

  // Compat:
  // - MD5 hex (legacy): compare md5(password)
  // - bcrypt ($2...): bcrypt compare
  // - otherwise: plain compare (last resort)
  if (looksLikeMd5(stored)) {
    const ok = md5Hex(password).toLowerCase() === stored.toLowerCase();
    if (!ok) throw new Error('Senha inválida');
  } else if (stored.startsWith('$2')) {
    const ok = await bcrypt.compare(password, stored);
    if (!ok) throw new Error('Senha inválida');
  } else {
    if (password !== stored) throw new Error('Senha inválida');
  }

  return {
    cpf: cpfNorm,
    nome: (user.nome ?? '').trim(),
    mustChangePassword: false,
  };
}
