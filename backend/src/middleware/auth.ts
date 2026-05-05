import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  professor?: { id: string; login: string; nome: string };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Não autenticado' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.professor = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}
