import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  googleId?: string;
  cpf?: string;
  nome: string;
  idUnidade?: number | null;
  mustChangePassword?: boolean;
  role?: 'ADMIN' | 'PROFESSOR';
}

// Extend Express Request to carry the decoded JWT payload
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware que valida o Bearer JWT enviado no header Authorization.
 * Popula req.user com o payload decodificado.
 */
export function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[JWT] JWT_SECRET não configurado');
    res.status(500).json({ error: 'Erro interno de configuração.' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

/**
 * Middleware que exige que o usuário autenticado tenha role === 'ADMIN'.
 * Deve ser usado APÓS authenticateJWT.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado.' });
    return;
  }
  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Acesso restrito ao administrador.' });
    return;
  }
  next();
}
