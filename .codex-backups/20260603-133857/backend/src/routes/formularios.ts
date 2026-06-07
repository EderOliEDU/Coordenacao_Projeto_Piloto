import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getPgPool } from '../services/pgPool'

const router = Router()
router.use(authMiddleware)

// GET /api/formularios/ativo (Postgres)
router.get('/ativo', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool()

    const [gruposRes, perguntasRes, opcoesRes] = await Promise.all([
      pool.query(`SELECT id_grupo, nome_grupo FROM public.avaliacao_grupos ORDER BY id_grupo`),
      pool.query(`SELECT id_pergunta, id_grupo, texto_pergunta, tipo_escala FROM public.avaliacao_perguntas ORDER BY id_grupo, id_pergunta`),
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
            opcoes: opcoesByTipo.get(escalaCodigo) || [],
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
    }

    return res.json(formulario)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao buscar formulário ativo' })
  }
})

export default router
