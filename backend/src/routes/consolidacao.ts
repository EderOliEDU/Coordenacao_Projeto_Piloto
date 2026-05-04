import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { authenticateJWT, requireAdmin } from '../middleware/jwtAuth';

const router = Router();

// Todas as rotas neste arquivo exigem autenticação + role ADMIN
router.use(authenticateJWT, requireAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/consolidacao
// Query params (opcionais):
//   escolaId    — filtrar por escola (UUID do SQLite)
//   turmaId     — filtrar por turma (UUID do SQLite)
//   status      — "RASCUNHO" | "ENVIADA" (case-insensitive)
//   dataInicio  — ISO 8601 date string (criadaEm >=)
//   dataFim     — ISO 8601 date string (criadaEm <=)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/consolidacao', async (req: Request, res: Response): Promise<void> => {
  const { escolaId, turmaId, status, dataInicio, dataFim } = req.query as Record<string, string | undefined>;

  try {
    const where: Record<string, unknown> = {};

    if (escolaId) where.escolaId = escolaId;
    if (turmaId) where.turmaId = turmaId;
    if (status) where.status = status.toUpperCase();

    if (dataInicio || dataFim) {
      const criadaEm: Record<string, Date> = {};
      if (dataInicio) criadaEm.gte = new Date(dataInicio);
      if (dataFim) criadaEm.lte = new Date(dataFim + 'T23:59:59.999Z');
      where.criadaEm = criadaEm;
    }

    const submissoes = await prisma.submissao.findMany({
      where,
      include: {
        aluno: { select: { id: true, nome: true, matricula: true } },
        turma: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            anoLetivo: true,
            turno: true,
            escola: { select: { id: true, nome: true, municipio: true, uf: true } },
          },
        },
        formulario: { select: { id: true, nome: true, versao: true } },
        professores: {
          select: {
            professor: { select: { id: true, nome: true, login: true } },
            papel: true,
          },
        },
        _count: { select: { respostas: true } },
      },
      orderBy: { criadaEm: 'desc' },
    });

    // Totais por status
    const total = submissoes.length;
    const porStatus: Record<string, number> = {};
    for (const s of submissoes) {
      porStatus[s.status] = (porStatus[s.status] || 0) + 1;
    }

    const percentuais: Record<string, string> = {};
    for (const [st, count] of Object.entries(porStatus)) {
      percentuais[st] = total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0%';
    }

    res.json({
      total,
      porStatus,
      percentuais,
      submissoes: submissoes.map((s) => ({
        id: s.id,
        status: s.status,
        criadaEm: s.criadaEm,
        enviadaEm: s.enviadaEm,
        observacoes: s.observacoes,
        totalRespostas: s._count.respostas,
        aluno: s.aluno,
        turma: {
          id: s.turma.id,
          nome: s.turma.nome,
          codigo: s.turma.codigo,
          anoLetivo: s.turma.anoLetivo,
          turno: s.turma.turno,
        },
        escola: s.turma.escola,
        formulario: s.formulario,
        professores: s.professores.map((p) => ({
          nome: p.professor.nome,
          login: p.professor.login,
          papel: p.papel,
        })),
      })),
    });
  } catch (err) {
    console.error('[admin/consolidacao] Erro:', (err as Error).message);
    res.status(500).json({ error: 'Erro ao buscar dados de consolidação.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/consolidacao/escolas
// Lista todas as escolas (para preencher filtro)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/consolidacao/escolas', async (_req: Request, res: Response): Promise<void> => {
  try {
    const escolas = await prisma.escola.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, municipio: true },
      orderBy: { nome: 'asc' },
    });
    res.json(escolas);
  } catch (err) {
    console.error('[admin/consolidacao/escolas] Erro:', (err as Error).message);
    res.status(500).json({ error: 'Erro ao buscar escolas.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/consolidacao/turmas
// Lista todas as turmas (para preencher filtro), opcionalmente filtrando por escola
// ─────────────────────────────────────────────────────────────────────────────
router.get('/consolidacao/turmas', async (req: Request, res: Response): Promise<void> => {
  const { escolaId } = req.query as { escolaId?: string };
  try {
    const turmas = await prisma.turma.findMany({
      where: { ativo: true, ...(escolaId && { escolaId }) },
      select: {
        id: true,
        nome: true,
        codigo: true,
        anoLetivo: true,
        turno: true,
        escola: { select: { id: true, nome: true } },
      },
      orderBy: [{ escola: { nome: 'asc' } }, { nome: 'asc' }],
    });
    res.json(turmas);
  } catch (err) {
    console.error('[admin/consolidacao/turmas] Erro:', (err as Error).message);
    res.status(500).json({ error: 'Erro ao buscar turmas.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/consolidacao/csv
// Exporta os dados de consolidação como CSV
// Aceita os mesmos query params que /consolidacao
// ─────────────────────────────────────────────────────────────────────────────
router.get('/consolidacao/csv', async (req: Request, res: Response): Promise<void> => {
  const { escolaId, turmaId, status, dataInicio, dataFim } = req.query as Record<string, string | undefined>;

  try {
    const where: Record<string, unknown> = {};
    if (escolaId) where.escolaId = escolaId;
    if (turmaId) where.turmaId = turmaId;
    if (status) where.status = status.toUpperCase();
    if (dataInicio || dataFim) {
      const criadaEm: Record<string, Date> = {};
      if (dataInicio) criadaEm.gte = new Date(dataInicio);
      if (dataFim) criadaEm.lte = new Date(dataFim + 'T23:59:59.999Z');
      where.criadaEm = criadaEm;
    }

    const submissoes = await prisma.submissao.findMany({
      where,
      include: {
        aluno: { select: { nome: true, matricula: true } },
        turma: {
          select: {
            nome: true,
            escola: { select: { nome: true } },
          },
        },
        professores: {
          select: { professor: { select: { nome: true } } },
        },
      },
      orderBy: { criadaEm: 'desc' },
    });

    const header = 'escola;turma;aluno;matricula;status;criadaEm;enviadaEm;professores\n';
    const rows = submissoes.map((s) => {
      const profs = s.professores.map((p) => p.professor.nome).join(' | ');
      return [
        `"${s.turma.escola.nome}"`,
        `"${s.turma.nome}"`,
        `"${s.aluno.nome}"`,
        `"${s.aluno.matricula || ''}"`,
        `"${s.status}"`,
        `"${s.criadaEm.toISOString()}"`,
        `"${s.enviadaEm ? s.enviadaEm.toISOString() : ''}"`,
        `"${profs}"`,
      ].join(';');
    });

    const csv = header + rows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="consolidacao.csv"');
    res.send('\uFEFF' + csv); // BOM para compatibilidade com Excel
  } catch (err) {
    console.error('[admin/consolidacao/csv] Erro:', (err as Error).message);
    res.status(500).json({ error: 'Erro ao gerar CSV.' });
  }
});

export default router;
