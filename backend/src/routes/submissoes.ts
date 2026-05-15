import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

const STATUS_RASCUNHO = 'RASCUNHO';
const STATUS_FINALIZADO = 'FINALIZADO';

const salvarRespostaSchema = z.object({
  formularioId: z.string().min(1),
  escolaId: z.string().min(1),
  turmaId: z.string().min(1),
  alunoId: z.string().min(1),
  observacoes: z.string().optional(),
  status: z.enum([STATUS_RASCUNHO, STATUS_FINALIZADO]).optional(),
  respostas: z.array(z.object({
    perguntaId: z.string().min(1),
    opcaoEscalaId: z.string().min(1),
  })).optional(),
});

function normalizarStatus(status?: string | null) {
  if (status === STATUS_FINALIZADO || status === 'ENVIADA') return STATUS_FINALIZADO;
  return STATUS_RASCUNHO;
}

function mapSubmissaoStatus<T extends { status?: string | null }>(submissao: T): T & { status: string } {
  return { ...submissao, status: normalizarStatus(submissao.status) };
}

async function salvarResposta(req: AuthRequest, res: Response, fallbackStatus?: string) {
  const incomingBody = fallbackStatus ? { ...req.body, status: fallbackStatus } : req.body;
  const parsed = salvarRespostaSchema.safeParse(incomingBody);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido', detalhes: parsed.error.flatten() });
  }

  const { formularioId, escolaId, turmaId, alunoId, respostas, observacoes, status } = parsed.data;
  const targetStatus = status || STATUS_RASCUNHO;

  const assignment = await prisma.professorTurma.findFirst({
    where: { professorId: req.professor!.id, turmaId },
  });
  if (!assignment) return res.status(403).json({ error: 'Acesso negado a esta turma' });

  let submissao = await prisma.submissao.findFirst({
    where: {
      turmaId,
      alunoId,
      formularioId,
      professores: { some: { professorId: req.professor!.id } },
    },
    orderBy: { criadaEm: 'desc' },
  });

  if (submissao) {
    submissao = await prisma.submissao.update({
      where: { id: submissao.id },
      data: {
        observacoes,
        status: targetStatus,
        enviadaEm: targetStatus === STATUS_FINALIZADO ? new Date() : null,
      },
    });
  } else {
    submissao = await prisma.submissao.create({
      data: {
        formularioId,
        escolaId,
        turmaId,
        alunoId,
        status: targetStatus,
        enviadaEm: targetStatus === STATUS_FINALIZADO ? new Date() : null,
        observacoes,
        professores: {
          create: { professorId: req.professor!.id },
        },
      },
    });
  }

  if (respostas && Array.isArray(respostas)) {
    for (const r of respostas) {
      const [pergunta, opcao] = await Promise.all([
        prisma.pergunta.findUnique({ where: { id: r.perguntaId }, select: { escalaId: true } }),
        prisma.opcaoEscala.findUnique({ where: { id: r.opcaoEscalaId }, select: { escalaId: true } }),
      ]);

      if (!pergunta || !opcao) {
        return res.status(400).json({ error: 'Pergunta ou opção inválida' });
      }
      if (pergunta.escalaId && opcao.escalaId !== pergunta.escalaId) {
        return res.status(400).json({ error: 'Opção incompatível com a escala da pergunta' });
      }

      await prisma.resposta.upsert({
        where: { submissaoId_perguntaId: { submissaoId: submissao.id, perguntaId: r.perguntaId } },
        create: { submissaoId: submissao.id, perguntaId: r.perguntaId, opcaoEscalaId: r.opcaoEscalaId },
        update: { opcaoEscalaId: r.opcaoEscalaId },
      });
    }
  }

  const withRespostas = await prisma.submissao.findUnique({
    where: { id: submissao.id },
    include: { respostas: true },
  });
  return res.json(mapSubmissaoStatus(withRespostas!));
}

// GET /api/submissoes?turmaId=&alunoId=
router.get('/', async (req: AuthRequest, res: Response) => {
  const { turmaId, alunoId } = req.query as { turmaId?: string; alunoId?: string };

  const where: any = {
    professores: { some: { professorId: req.professor!.id } },
  };
  if (turmaId) where.turmaId = turmaId;
  if (alunoId) where.alunoId = alunoId;

  const submissoes = await prisma.submissao.findMany({
    where,
    include: {
      aluno: true,
      turma: { include: { escola: true } },
      formulario: true,
      _count: { select: { respostas: true } },
    },
    orderBy: { criadaEm: 'desc' },
  });

  res.json(submissoes.map(mapSubmissaoStatus));
});

// GET /api/submissoes/perguntas?grupoId=&tipoEscala=
router.get('/perguntas', async (req: AuthRequest, res: Response) => {
  const { grupoId, tipoEscala } = req.query as { grupoId?: string; tipoEscala?: string };

  const where: any = {};
  if (grupoId) where.secaoId = grupoId;
  if (tipoEscala) where.escala = { codigo: tipoEscala };

  const perguntas = await prisma.pergunta.findMany({
    where,
    include: {
      secao: true,
      escala: true,
    },
    orderBy: [{ secao: { ordem: 'asc' } }, { ordem: 'asc' }],
  });

  res.json(perguntas.map((p) => ({
    id: p.id,
    id_grupo: p.secaoId,
    nome_grupo: p.secao.titulo,
    texto_pergunta: p.enunciado,
    tipo_escala: p.escala?.codigo || null,
    obrigatoria: p.obrigatoria,
  })));
});

// GET /api/submissoes/opcoes?tipoEscala=
router.get('/opcoes', async (req: AuthRequest, res: Response) => {
  const { tipoEscala } = req.query as { tipoEscala?: string };
  if (!tipoEscala) return res.status(400).json({ error: 'tipoEscala é obrigatório' });

  const opcoes = await prisma.opcaoEscala.findMany({
    where: { escala: { codigo: tipoEscala } },
    include: { escala: true },
    orderBy: { ordem: 'asc' },
  });

  res.json(opcoes.map((o) => ({
    id_opcao: o.id,
    tipo_escala: o.escala.codigo,
    sigla: o.chave,
    descricao: o.descricaoLegenda,
    simbolo: o.rotuloUI,
    cor_hex: o.corHex,
  })));
});

// GET /api/submissoes/respostas/aluno/:alunoId?turmaId=&formularioId=
router.get('/respostas/aluno/:alunoId', async (req: AuthRequest, res: Response) => {
  const { turmaId, formularioId } = req.query as { turmaId?: string; formularioId?: string };
  const where: any = {
    alunoId: req.params.alunoId,
    professores: { some: { professorId: req.professor!.id } },
  };
  if (turmaId) where.turmaId = turmaId;
  if (formularioId) where.formularioId = formularioId;

  const submissao = await prisma.submissao.findFirst({
    where,
    include: {
      respostas: { include: { opcaoEscala: true, pergunta: true } },
    },
    orderBy: { criadaEm: 'desc' },
  });

  if (!submissao) return res.json(null);
  return res.json(mapSubmissaoStatus(submissao));
});

// GET /api/submissoes/pendencias?turmaId=&formularioId=
router.get('/pendencias', async (req: AuthRequest, res: Response) => {
  const { turmaId, formularioId } = req.query as { turmaId?: string; formularioId?: string };

  const professorTurmas = await prisma.professorTurma.findMany({
    where: { professorId: req.professor!.id },
    select: { turmaId: true },
  });
  const turmaIds = turmaId ? [turmaId] : professorTurmas.map((pt) => pt.turmaId);

  if (turmaIds.length === 0) {
    return res.json({ totalPerguntas: 0, semFinalizacao: [], rascunhos: [], inconsistencias: [] });
  }

  const formulario = formularioId
    ? await prisma.formulario.findUnique({
        where: { id: formularioId },
        include: { secoes: { include: { perguntas: true } } },
      })
    : await prisma.formulario.findFirst({
        where: { ativo: true },
        include: { secoes: { include: { perguntas: true } } },
      });

  if (!formulario) {
    return res.status(404).json({ error: 'Formulário não encontrado' });
  }

  const totalPerguntas = formulario.secoes.reduce((acc, secao) => acc + secao.perguntas.length, 0);
  const alunos = await prisma.aluno.findMany({
    where: { turmaId: { in: turmaIds }, ativo: true },
    include: { turma: true },
    orderBy: { nome: 'asc' },
  });

  const submissoes = await prisma.submissao.findMany({
    where: {
      turmaId: { in: turmaIds },
      formularioId: formulario.id,
      professores: { some: { professorId: req.professor!.id } },
    },
    include: {
      aluno: true,
      turma: true,
      respostas: { include: { pergunta: true, opcaoEscala: true } },
    },
    orderBy: { criadaEm: 'desc' },
  });

  const latestByAluno = new Map<string, (typeof submissoes)[number]>();
  for (const sub of submissoes) {
    if (!latestByAluno.has(sub.alunoId)) {
      latestByAluno.set(sub.alunoId, sub);
    }
  }

  const semFinalizacao = alunos
    .map((aluno) => {
      const sub = latestByAluno.get(aluno.id);
      const status = normalizarStatus(sub?.status);
      const totalRespondidas = sub?.respostas?.length || 0;
      const finalizadoCompleto = status === STATUS_FINALIZADO && totalRespondidas >= totalPerguntas;
      if (finalizadoCompleto) return null;

      return {
        alunoId: aluno.id,
        alunoNome: aluno.nome,
        turmaId: aluno.turmaId,
        turmaNome: aluno.turma.nome,
        submissaoId: sub?.id || null,
        status,
        totalRespondidas,
        totalPerguntas,
      };
    })
    .filter(Boolean);

  const rascunhos = submissoes
    .filter((sub) => normalizarStatus(sub.status) === STATUS_RASCUNHO)
    .map((sub) => ({
      submissaoId: sub.id,
      alunoId: sub.alunoId,
      alunoNome: sub.aluno.nome,
      turmaId: sub.turmaId,
      turmaNome: sub.turma.nome,
      totalRespondidas: sub.respostas.length,
      totalPerguntas,
      atualizadaEm: sub.updatedAt,
    }));

  const inconsistencias = submissoes.flatMap((sub) =>
    sub.respostas
      .filter((resp) => resp.pergunta.escalaId && resp.opcaoEscala.escalaId !== resp.pergunta.escalaId)
      .map((resp) => ({
        submissaoId: sub.id,
        alunoId: sub.alunoId,
        alunoNome: sub.aluno.nome,
        turmaId: sub.turmaId,
        turmaNome: sub.turma.nome,
        perguntaId: resp.perguntaId,
        opcaoEscalaId: resp.opcaoEscalaId,
      }))
  );

  return res.json({
    formularioId: formulario.id,
    totalPerguntas,
    semFinalizacao,
    rascunhos,
    inconsistencias,
  });
});

// GET /api/submissoes/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const submissao = await prisma.submissao.findFirst({
    where: { id: req.params.id, professores: { some: { professorId: req.professor!.id } } },
    include: {
      aluno: true,
      turma: { include: { escola: true } },
      formulario: {
        include: {
          secoes: {
            orderBy: { ordem: 'asc' },
            include: {
              perguntas: {
                orderBy: { ordem: 'asc' },
                include: { escala: { include: { opcoes: { orderBy: { ordem: 'asc' } } } } },
              },
            },
          },
        },
      },
      respostas: { include: { opcaoEscala: true, pergunta: true } },
    },
  });

  if (!submissao) return res.status(404).json({ error: 'Submissão não encontrada' });
  res.json(mapSubmissaoStatus(submissao));
});

// POST /api/submissoes/respostas
router.post('/respostas', async (req: AuthRequest, res: Response) => {
  return salvarResposta(req, res);
});

// POST /api/submissoes (compat)
router.post('/', async (req: AuthRequest, res: Response) => {
  return salvarResposta(req, res, STATUS_RASCUNHO);
});

// PUT /api/submissoes/:id/enviar
router.put('/:id/enviar', async (req: AuthRequest, res: Response) => {
  const submissao = await prisma.submissao.findFirst({
    where: { id: req.params.id, professores: { some: { professorId: req.professor!.id } } },
  });
  if (!submissao) return res.status(404).json({ error: 'Submissão não encontrada' });
  if (normalizarStatus(submissao.status) === STATUS_FINALIZADO) {
    return res.status(400).json({ error: 'Já finalizada' });
  }

  const updated = await prisma.submissao.update({
    where: { id: req.params.id },
    data: { status: STATUS_FINALIZADO, enviadaEm: new Date() },
  });

  res.json(mapSubmissaoStatus(updated));
});

export default router;
