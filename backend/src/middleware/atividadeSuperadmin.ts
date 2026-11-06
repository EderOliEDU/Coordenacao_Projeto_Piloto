import { Response, NextFunction } from 'express'
import { AuthRequest, getAuthenticatedCpf, getEffectiveProfessorCpf, isViewOnlyMode } from './auth'
import { isSuperadmin, usuarioTemPerfil } from '../services/permissions'
import { getPgPool } from '../services/pgPool'

export interface AtividadeRequest extends AuthRequest {
  atividadeAdmin?: { cpf: string; faseId: number }
}

// Escopo explícito: nunca altera a identidade autenticada ou libera outras rotas.
export async function atividadeSuperadmin(req: AtividadeRequest, res: Response, next: NextFunction) {
  const cpf = String(req.headers['x-atividade-cpf'] || '')
  const faseId = Number(req.headers['x-atividade-fase'])
  if (!cpf && !req.headers['x-atividade-fase']) return next()
  try {
    const ator = getAuthenticatedCpf(req)
    const permitido = req.professor?.permissoes?.superadmin || isSuperadmin(ator) || await usuarioTemPerfil(ator, ['SUPERADMIN'])
    if (!permitido) return res.status(403).json({error:'Acesso restrito ao superadministrador.'})
    if (isViewOnlyMode(req)) return res.status(403).json({error:'Saia do modo conferência antes de editar uma atividade.'})
    if (!/^\d{11}$/.test(cpf) || !Number.isSafeInteger(faseId) || faseId <= 0) return res.status(400).json({error:'Responsável ou fase inválidos.'})
    if (req.headers['x-atividade-confirmada'] !== 'sim') return res.status(409).json({error:'Confirme que deseja preencher ou alterar a atividade de outro responsável.'})
    const fase = await getPgPool().query('SELECT 1 FROM public.avaliacao_fases WHERE id_fase=$1', [faseId])
    if (!fase.rowCount) return res.status(404).json({error:'Fase não encontrada.'})
    const aplicacaoId = /^\/aplicacoes\/(\d+)(?:\/|$)/.exec(req.path)?.[1]
    if (aplicacaoId) {
      const aplicacao = await getPgPool().query(`SELECT 1 FROM public.avaliacao_aplicador_aplicacoes
        WHERE id_aplicacao=$1 AND cpf_aplicador=$2 AND id_fase=$3`, [aplicacaoId,cpf,faseId])
      if (!aplicacao.rowCount) return res.status(404).json({error:'Aplicação não encontrada para o responsável e a fase selecionados.'})
    }
    if (req.method === 'POST' && req.path === '/aplicacoes/iniciar' && Number(req.body?.idFase) !== faseId)
      return res.status(409).json({error:'A fase da atividade mudou. Abra a atividade novamente.'})
    req.atividadeAdmin = {cpf, faseId}
    next()
  } catch (error) { console.error(error); return res.status(500).json({error:'Não foi possível autorizar a atividade.'}) }
}
export function atividadeAdmin(req: AuthRequest) { return (req as AtividadeRequest).atividadeAdmin }
export function cpfAtividade(req: AuthRequest) { return atividadeAdmin(req)?.cpf || getEffectiveProfessorCpf(req) }
export function cpfAplicacao(req: AuthRequest) { return atividadeAdmin(req)?.cpf || getAuthenticatedCpf(req) }
export async function periodoAtividade(req: AuthRequest, db = getPgPool() as Pick<import('pg').PoolClient, 'query'>, bloquear = false) {
  const admin = atividadeAdmin(req)
  if (!admin) return (await import('../services/periodoFormulario')).consultarPeriodoFormulario(db, bloquear)
  const fase = await db.query(`SELECT id_fase AS id,nome,data_inicio::text AS "dataInicio",data_fim::text AS "dataFim"
    FROM public.avaliacao_fases WHERE id_fase=$1 ${bloquear ? 'FOR SHARE' : ''}`, [admin.faseId])
  return {aberto: Boolean(fase.rowCount),fase:fase.rows[0] || null,mensagem:'Edição pelo superadministrador confirmada.'}
}
