import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { canViewResultados, getUserPermissions } from '../services/permissions';

export interface AuthRequest extends Request {
  professor?: { id: string; login: string; nome: string; cpf?: string; permissoes?: { resultados: boolean } };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Não autenticado' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.professor = {
      // tenta pegar o login, se não pega o cpf
      login: payload.login || payload.cpf,
      nome:  payload.nome,
      cpf:   payload.cpf,
      permissoes: payload.permissoes || getUserPermissions(payload.cpf || payload.login || ''),
      // inclua outros campos se necessário
    } as any;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

export function resultadosAccessMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const cpf = req.professor?.cpf || req.professor?.login || ''
  if (!canViewResultados(cpf)) {
    return res.status(403).json({ error: 'Acesso negado aos resultados' })
  }
  next()
}
