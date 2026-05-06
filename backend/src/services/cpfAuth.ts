/**
 * Fallback authentication via CPF + data_nascimento against the Postgres
 * `public.usuarios` table (projPiloto database).
 *
 * Logic (Option A):
 *  - Normalise the provided CPF and password to digits only.
 *  - Look up the user by CPF in Postgres.
 *  - If `senha_hash` is NULL/empty (trim), accept the login when the
 *    normalised password equals the normalised `data_nascimento` and the
 *    result is exactly 8 digits (DDMMYYYY).
 *  - If `senha_hash` is set, verify with bcryptjs.
 *  - `must_change_password = true` is reported in the return value but does
 *    NOT block authentication so that test logins work without extra steps.
 */

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

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

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      host: process.env.PILOTO_PG_HOST,
      port: process.env.PILOTO_PG_PORT ? parseInt(process.env.PILOTO_PG_PORT, 10) || 5432 : 5432,
      database: process.env.PILOTO_PG_DB,
      user: process.env.PILOTO_PG_USER,
      password: process.env.PILOTO_PG_PASSWORD,
    });
  }
  return _pool;
}

/**
 * Authenticate a user by CPF (11 digits) and password (DDMMYYYY or any
 * format that reduces to 8 digits once non-digit chars are stripped).
 *
 * @throws Error with a human-readable message on failure.
 */
export async function authenticateByCpf(cpf: string, password: string): Promise<CpfUser> {
  const cpfNorm = onlyDigits(cpf).padStart(11, '0');
  if (cpfNorm.length !== 11) {
    throw new Error('CPF inválido');
  }

  const pool = getPool();

  const result = await pool.query<{
    cpf: string;
    nome: string;
    data_nascimento: string;
    senha_hash: string | null;
    must_change_password: boolean;
  }>(
    `SELECT cpf, nome, data_nascimento, senha_hash, must_change_password
     FROM public.usuarios
     WHERE regexp_replace(cpf, '\\D', '', 'g') = $1
     LIMIT 1`,
    [cpfNorm]
  );

  if (result.rowCount === 0) {
    console.warn(`[cpfAuth] CPF ${cpfNorm.slice(0, 3)}***${cpfNorm.slice(-2)} não encontrado`);
    throw new Error('Usuário não encontrado');
  }

  const user = result.rows[0];
  const senhaHash = (user.senha_hash ?? '').trim();
  const pwdNorm = onlyDigits(password);

  if (senhaHash === '') {
    // Fallback: compare digits-only password to digits-only data_nascimento.
    // Both must be exactly 8 digits (DDMMYYYY) and equal.
    const dataNorm = onlyDigits(user.data_nascimento ?? '');
    if (pwdNorm.length !== 8 || dataNorm.length !== 8 || pwdNorm !== dataNorm) {
      console.warn(
        `[cpfAuth] Falha no login por data de nascimento – CPF ${cpfNorm.slice(0, 3)}***${cpfNorm.slice(-2)}`
      );
      throw new Error('Senha inválida');
    }
  } else {
    // Normal path: bcrypt verify
    const ok = await bcrypt.compare(password, senhaHash);
    if (!ok) {
      console.warn(
        `[cpfAuth] Falha no login (bcrypt) – CPF ${cpfNorm.slice(0, 3)}***${cpfNorm.slice(-2)}`
      );
      throw new Error('Senha inválida');
    }
  }

  return {
    cpf: cpfNorm,
    nome: (user.nome ?? '').trim(),
    mustChangePassword: user.must_change_password ?? true,
  };
}
