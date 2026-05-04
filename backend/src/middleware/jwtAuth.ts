import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  googleId: string;
  cpf: string;
  nome: string;
  idUnidade: number | null;
  mustChangePassword: boolean;
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
