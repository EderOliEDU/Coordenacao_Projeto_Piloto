import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { canViewResultados, getUserPermissions, isAdministrador, normalizarCpf } from '../services/permissions';

export interface AuthRequest extends Request {
  professor?: { id: string; login: string; nome: string; cpf?: string; permissoes?: { administrador?: boolean; resultados: boolean; superadmin?: boolean } };
}

export function getAuthenticatedCpf(req: AuthRequest) {
  return normalizarCpf(req.professor?.cpf || req.professor?.login || '')
}

export function getViewAsCpf(req: AuthRequest) {
  const authenticatedCpf = getAuthenticatedCpf(req)
  const viewAsCpf = normalizarCpf(String(req.headers['x-view-as-cpf'] || ''))
  if (!viewAsCpf || viewAsCpf.length !== 11) return ''
  if (!isAdministrador(authenticatedCpf)) return ''
  if (viewAsCpf === authenticatedCpf) return ''
  return viewAsCpf
}

export function getEffectiveProfessorCpf(req: AuthRequest) {
  return getViewAsCpf(req) || getAuthenticatedCpf(req)
}

export function isViewOnlyMode(req: AuthRequest) {
  return Boolean(getViewAsCpf(req))
}

export function blockViewOnlyWrites(req: AuthRequest, res: Response, next: NextFunction) {
  if (isViewOnlyMode(req)) {
    return res.status(403).json({ error: 'Modo conferência é somente leitura. Saia da visualização para alterar dados.' })
  }
  next()
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
  const cpf = getAuthenticatedCpf(req)
  if (!canViewResultados(cpf) && !req.professor?.permissoes?.superadmin) {
    return res.status(403).json({ error: 'Acesso negado aos resultados' })
  }
  next()
}
