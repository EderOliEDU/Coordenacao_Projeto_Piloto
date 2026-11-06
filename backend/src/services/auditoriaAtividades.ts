import { randomUUID } from 'crypto'
import type { PoolClient } from 'pg'
import { AuthRequest, getAuthenticatedCpf } from '../middleware/auth'
import type { AtividadeRequest } from '../middleware/atividadeSuperadmin'

type Db = Pick<PoolClient, 'query'>
type Tipo = 'FORMULARIO' | 'VERIFICACAO'
type Contexto = { tipo: Tipo; faseId: number; turmaId: number; alunoId: number; aplicacaoId?: number }
type Captura = { contexto: Contexto; antes: unknown; requisicaoId: string }
const capturas = new WeakMap<AuthRequest, Captura>()

async function fotografar(db: Db, c: Contexto, cpf: string) {
  const dados: Record<string, unknown> = {}
  if (c.tipo === 'FORMULARIO') {
    for (const tabela of ['submissoes_pg','avaliacao_respostas','aluno_necessidades_contexto','aluno_necessidades_especificas']) {
      const r = await db.query(`SELECT to_jsonb(r) AS dado FROM public.${tabela} r
        WHERE id_fase=$1 AND id_turma=$2 AND id_aluno=$3 AND cpf_professor=$4
        ORDER BY to_jsonb(r)::text`, [c.faseId,c.turmaId,c.alunoId,cpf])
      dados[tabela] = r.rows.map(r => r.dado)
    }
  } else {
    const app = await db.query(`SELECT * FROM public.avaliacao_aplicador_aplicacoes
      WHERE id_fase=$1 AND id_turma=$2 AND id_aluno=$3 AND cpf_aplicador=$4
      ${c.aplicacaoId ? 'AND id_aplicacao=$5' : ''} ORDER BY id_aplicacao`,
      [c.faseId,c.turmaId,c.alunoId,cpf,...(c.aplicacaoId ? [c.aplicacaoId] : [])])
    dados.aplicacoes = app.rows
    const ids = app.rows.map(r => r.id_aplicacao)
    for (const tabela of ['avaliacao_aplicador_respostas','avaliacao_aplicador_vogais','avaliacao_aplicador_leitura_respostas']) {
      const r = await db.query(`SELECT to_jsonb(r) AS dado FROM public.${tabela} r
        WHERE id_aplicacao=ANY($1::integer[]) ORDER BY to_jsonb(r)::text`, [ids])
      dados[tabela] = r.rows.map(r => r.dado)
    }
  }
  // Datas/JSON são normalizados antes de comparar e persistir.
  return JSON.parse(JSON.stringify(dados))
}

// Chamado dentro da transação, antes de qualquer escrita. A trava também protege
// o retrato anterior contra gravações concorrentes dos responsáveis normais.
export async function abrirAuditoria(req: AuthRequest, db: Db, tipo: Tipo) {
  const admin = (req as AtividadeRequest).atividadeAdmin
  let contexto: Contexto
  if (tipo === 'VERIFICACAO' && req.params.id) {
    const r = await db.query(`SELECT id_fase,id_turma,id_aluno,id_aplicacao
      FROM public.avaliacao_aplicador_aplicacoes WHERE id_aplicacao=$1 FOR UPDATE`, [Number(req.params.id)])
    if (!r.rowCount || !admin) return
    const a = r.rows[0]
    contexto = {tipo,faseId:a.id_fase,turmaId:a.id_turma,alunoId:a.id_aluno,aplicacaoId:a.id_aplicacao}
  } else {
    contexto = {tipo,faseId:Number(req.body?.faseId || req.body?.idFase),
      turmaId:Number(req.body?.turmaId || req.body?.idTurma),alunoId:Number(req.body?.alunoId || req.body?.idAluno)}
    if (![contexto.faseId,contexto.turmaId,contexto.alunoId].every(n=>Number.isSafeInteger(n)&&n>0)) return
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
      [`atividade:${tipo}:${contexto.faseId}:${contexto.turmaId}:${contexto.alunoId}`])
    if (tipo === 'VERIFICACAO') {
      await db.query(`SELECT id_aplicacao FROM public.avaliacao_aplicador_aplicacoes
        WHERE id_fase=$1 AND id_turma=$2 AND id_aluno=$3 ORDER BY id_aplicacao FOR UPDATE`,
        [contexto.faseId,contexto.turmaId,contexto.alunoId])
    }
    if (!admin) return
  }
  capturas.set(req, {contexto,antes:await fotografar(db,contexto,admin.cpf),requisicaoId:randomUUID()})
}

export async function registrarEvento(req: AuthRequest, db: Db, c: Contexto,
  evento: 'CONFIRMACAO' | 'ALTERACAO', antes: unknown, depois: unknown, requisicaoId: string = randomUUID()) {
  const admin = (req as AtividadeRequest).atividadeAdmin
  if (!admin) throw new Error('Auditoria exige autorização do superadministrador')
  try {
    await db.query(`INSERT INTO public.auditoria_atividades
    (requisicao_id,autor_cpf,autor_nome,responsavel_cpf,tipo,evento,fase_id,turma_id,aluno_id,aplicacao_id,metodo,rota,ip,antes,depois)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb)`,
    [requisicaoId,getAuthenticatedCpf(req),req.professor?.nome || '',admin.cpf,c.tipo,evento,c.faseId,
      c.turmaId,c.alunoId,c.aplicacaoId || null,req.method,req.baseUrl+req.path,req.ip || null,
      antes == null ? null : JSON.stringify(antes),depois == null ? null : JSON.stringify(depois)])
  } catch {
    // Erros do PostgreSQL podem conter os retratos completos no campo detail.
    throw new Error('Falha ao registrar a auditoria da atividade.')
  }
}

// Se o INSERT da auditoria falhar, a rota desfaz também as respostas.
export async function concluirAuditoria(req: AuthRequest, db: Db) {
  const captura = capturas.get(req)
  if (!captura) {
    if ((req as AtividadeRequest).atividadeAdmin) throw new Error('Contexto de auditoria ausente; alteração cancelada.')
    return
  }
  const admin = (req as AtividadeRequest).atividadeAdmin!
  const depois = await fotografar(db,captura.contexto,admin.cpf)
  const c = {...captura.contexto}
  if (c.tipo === 'VERIFICACAO' && !c.aplicacaoId) c.aplicacaoId = depois.aplicacoes?.[0]?.id_aplicacao
  if (JSON.stringify(captura.antes) !== JSON.stringify(depois)) {
    await registrarEvento(req,db,c,'ALTERACAO',captura.antes,depois,captura.requisicaoId)
  }
  capturas.delete(req)
}
