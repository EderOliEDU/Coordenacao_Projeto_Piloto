import { atividadeSuperadmin, periodoAtividade } from '../middleware/atividadeSuperadmin'
import { Router, Request, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { getPgPool } from '../services/pgPool'
import { consultarPeriodoFormulario } from '../services/periodoFormulario'

const router = Router()
router.use(authMiddleware)
router.use(atividadeSuperadmin)
function ordenarOpcoesEscala(tipo: string, opcoes: any[]) {
  if (tipo !== 'PEA') return opcoes

  const ordemPEA: Record<string, number> = {
    'PEA-D': 1,
    D: 1,
    'PEA-PD': 2,
    PD: 2,
    'PEA-TD': 3,
    TD: 3,
    'PEA-NDA': 4,
    NDA: 4,
  }

  return [...opcoes].sort((a, b) => {
    const ordemA = ordemPEA[String(a.chave || '').toUpperCase()] ?? 99
    const ordemB = ordemPEA[String(b.chave || '').toUpperCase()] ?? 99
    return ordemA - ordemB || Number(a.id) - Number(b.id)
  })
}

router.get('/periodo',async (_req:AuthRequest,res:Response)=>{
  res.setHeader('Cache-Control','private, no-store')
  try{res.json(await periodoAtividade(_req))}
  catch(error){console.error(error);res.status(503).json({error:'Não foi possível confirmar o prazo de preenchimento. Tente novamente.'})}
})

// GET /api/formularios/ativo (Postgres)
router.get('/ativo', async (_req: AuthRequest, res: Response) => {
  try {
    const pool = getPgPool()

    const [gruposRes, perguntasRes, opcoesRes] = await Promise.all([
      pool.query(`SELECT id_grupo, nome_grupo FROM public.avaliacao_grupos ORDER BY id_grupo`),
      pool.query(`
        SELECT id_pergunta, id_grupo, texto_pergunta, tipo_escala
        FROM public.avaliacao_perguntas
        WHERE NULLIF(BTRIM(tipo_escala::text), '') IS NOT NULL
        ORDER BY id_grupo, id_pergunta
      `),
      pool.query(`SELECT id_opcao, tipo_escala, sigla, descricao, cor_hex, simbolo FROM public.avaliacao_opcoes ORDER BY tipo_escala, id_opcao`),
    ])

    const opcoesByTipo = new Map<string, any[]>()
    for (const o of opcoesRes.rows) {
      const tipo = o.tipo_escala || 'SEM_ESCALA'
      const arr = opcoesByTipo.get(tipo) || []
      arr.push({
        id: String(o.id_opcao),
        chave: o.sigla ?? '',
        rotuloUI: o.sigla ?? '',
        corHex: o.cor_hex ?? null,
        descricaoLegenda: o.descricao ?? '',
        ordem: Number(o.id_opcao),
      })
      opcoesByTipo.set(tipo, arr)
    }

    const perguntasByGrupo = new Map<number, any[]>()
    for (const p of perguntasRes.rows) {
      const gid = Number(p.id_grupo)
      const escalaCodigo = p.tipo_escala ?? null
      const escala = escalaCodigo
        ? {
            id: String(escalaCodigo), // ex: "PEA", "SN", "FLUXO"
            codigo: String(escalaCodigo),
            nomeExibicao: String(escalaCodigo),
            opcoes: ordenarOpcoesEscala(String(escalaCodigo), opcoesByTipo.get(escalaCodigo) || []),
          }
        : null

      const arr = perguntasByGrupo.get(gid) || []
      arr.push({
        id: String(p.id_pergunta),
        codigo: `P${p.id_pergunta}`,
        enunciado: p.texto_pergunta,
        ordem: Number(p.id_pergunta),
        escala,
      })
      perguntasByGrupo.set(gid, arr)
    }

    const secoes = gruposRes.rows.map((g: any) => ({
      id: String(g.id_grupo),
      titulo: g.nome_grupo,
      ordem: Number(g.id_grupo),
      perguntas: perguntasByGrupo.get(Number(g.id_grupo)) || [],
    }))

    const formulario = {
      id: 'PG_V1',
      nome: 'Enfoque de observação',
      versao: '1.0.0',
      secoes,
      periodoPreenchimento: await periodoAtividade(_req),
    }

    return res.json(formulario)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao buscar formulário ativo' })
  }
})

export default router
