import { Router, Response, NextFunction, raw } from 'express'
import { promises as fs } from 'fs'
import * as path from 'path'
import {
  AuthRequest,
  authMiddleware,
  getAuthenticatedCpf
} from '../middleware/auth'
import {
  usuarioTemPerfil
} from '../services/permissions'
import { getPgPool } from '../services/pgPool'

const router = Router()

const AUDIO_STORAGE_PATH =
  process.env.AUDIO_STORAGE_PATH ||
  '/opt/projeto_piloto_app/data/audios'

const AUDIO_MAX_BYTES =
  10 * 1024 * 1024

const audioRawMiddleware = raw({
  type: [
    'audio/webm',
    'application/octet-stream'
  ],
  limit: AUDIO_MAX_BYTES
})

function getAudioRelativePath(
  idFase: number,
  idAplicacao: number,
  idPalavra: number
) {
  return [
    `fase-${idFase}`,
    `aplicacao-${idAplicacao}`,
    `palavra-${idPalavra}.webm`
  ].join('/')
}

function getAudioAbsolutePath(
  relativePath: string
) {
  const root =
    path.resolve(AUDIO_STORAGE_PATH)

  const absolute =
    path.resolve(
      root,
      relativePath
    )

  if (
    absolute !== root &&
    !absolute.startsWith(
      `${root}${path.sep}`
    )
  ) {
    throw new Error(
      'Caminho de áudio inválido'
    )
  }

  return absolute
}

router.use(authMiddleware)

async function requireAplicador(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const cpf = getAuthenticatedCpf(req)

    if (!cpf || cpf.length !== 11) {
      return res.status(401).json({
        error: 'Usuário não autenticado'
      })
    }

    const permitido = await usuarioTemPerfil(
      cpf,
      ['APLICADOR']
    )

    if (!permitido) {
      return res.status(403).json({
        error: 'Acesso restrito ao aplicador'
      })
    }

    next()
  } catch (error) {
    console.error(
      'Erro ao verificar acesso do Aplicador:',
      error
    )

    return res.status(500).json({
      error: 'Erro ao verificar permissão de acesso'
    })
  }
}

router.use(requireAplicador)

/**
 * GET /api/aplicador/me
 */
router.get('/me', async (
  req: AuthRequest,
  res: Response
) => {
  const cpf = getAuthenticatedCpf(req)

  return res.json({
    ok: true,
    modulo: 'APLICADOR',
    cpf,
    nome: req.professor?.nome || null
  })
})

/**
 * GET /api/aplicador/resumo
 */
router.get('/resumo', async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const cpf = getAuthenticatedCpf(req)
    const pool = getPgPool()

    const result = await pool.query(
      `
        SELECT
          COUNT(*)::integer AS total,

          COUNT(*) FILTER (
            WHERE status = 'PENDENTE'
          )::integer AS pendentes,

          COUNT(*) FILTER (
            WHERE status = 'EM_ANDAMENTO'
          )::integer AS "emAndamento",

          COUNT(*) FILTER (
            WHERE status = 'CONCLUIDA'
          )::integer AS concluidas,

          COUNT(*) FILTER (
            WHERE status = 'CANCELADA'
          )::integer AS canceladas

        FROM public.avaliacao_aplicador_aplicacoes

        WHERE cpf_aplicador = $1
      `,
      [cpf]
    )

    return res.json(result.rows[0])

  } catch (error) {
    console.error(
      'Erro ao carregar resumo do Aplicador:',
      error
    )

    return res.status(500).json({
      error: 'Erro ao carregar resumo das aplicações'
    })
  }
})

/**
 * GET /api/aplicador/aplicacoes
 */
router.get('/aplicacoes', async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const cpf = getAuthenticatedCpf(req)
    const pool = getPgPool()

    const result = await pool.query(
      `
        SELECT
          aa.id_aplicacao::text AS "idAplicacao",
          aa.id_fase::text AS "idFase",
          aa.status,

          aa.criado_em AS "criadoEm",
          aa.iniciado_em AS "iniciadoEm",
          aa.concluido_em AS "concluidoEm",

          a.id_aluno::text AS "alunoId",
          a.nome AS "alunoNome",
          a.inep AS "alunoInep",

          t.id_turma::text AS "turmaId",
          t.letra_turma AS "turmaLetra",
          t.turno AS "turmaTurno",

          et.id_etapa::text AS "etapaId",
          et.descricao AS "etapaDescricao",

          e.id_escola::text AS "escolaId",
          e.nome_escola AS "escolaNome",

          COALESCE(
            (
              SELECT BOOL_OR(
                COALESCE(
                  anc.paee,
                  false
                )
              )
              FROM public.aluno_necessidades_contexto anc
              WHERE anc.id_aluno = aa.id_aluno
                AND anc.id_turma = aa.id_turma
                AND anc.id_fase = aa.id_fase
            ),
            false
          ) AS "paee",

          COALESCE(
            (
              SELECT JSON_AGG(
                item
                ORDER BY
                  item->>'descricao'
              )
              FROM (
                SELECT DISTINCT
                  JSONB_BUILD_OBJECT(
                    'necessidadeId',
                    ane.id_necespecifica::text,
                    'descricao',
                    ne."descrição"::text,
                    'tipo',
                    COALESCE(
                      NULLIF(
                        BTRIM(
                          ane.tipo::text
                        ),
                        ''
                      ),
                      NULLIF(
                        BTRIM(
                          ne.paee::text
                        ),
                        ''
                      )
                    ),
                    'descricaoOutros',
                    NULLIF(
                      BTRIM(
                        COALESCE(
                          ane.descricao_outros,
                          ''
                        )
                      ),
                      ''
                    )
                  ) AS item
                FROM public.aluno_necessidades_especificas ane
                INNER JOIN public."necessidades_específicas" ne
                  ON ne.id_necespecifica =
                     ane.id_necespecifica
                WHERE ane.id_aluno = aa.id_aluno
                  AND ane.id_turma = aa.id_turma
                  AND ane.id_fase = aa.id_fase
              ) dados_necessidades
            ),
            '[]'::json
          ) AS "necessidadesEspecificas"

        FROM public.avaliacao_aplicador_aplicacoes aa

        INNER JOIN public.alunos a
          ON a.id_aluno = aa.id_aluno

        INNER JOIN public.turmas t
          ON t.id_turma = aa.id_turma

        INNER JOIN public.escolas e
          ON e.id_escola = t.id_escola

        LEFT JOIN public.etapas et
          ON et.id_etapa = t.id_etapa

        WHERE aa.cpf_aplicador = $1

        ORDER BY
          CASE aa.status
            WHEN 'EM_ANDAMENTO' THEN 1
            WHEN 'PENDENTE' THEN 2
            WHEN 'CONCLUIDA' THEN 3
            WHEN 'CANCELADA' THEN 4
            ELSE 5
          END,
          e.nome_escola,
          a.nome
      `,
      [cpf]
    )

    return res.json(result.rows)

  } catch (error) {
    console.error(
      'Erro ao carregar aplicações do Aplicador:',
      error
    )

    return res.status(500).json({
      error: 'Erro ao carregar aplicações'
    })
  }
})

/**
 * GET /api/aplicador/aplicacoes/:id
 */
router.get('/aplicacoes/:id', async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const cpf = getAuthenticatedCpf(req)
    const idAplicacao = Number(req.params.id)

    if (
      !Number.isInteger(idAplicacao)
      || idAplicacao <= 0
    ) {
      return res.status(400).json({
        error: 'Aplicação inválida'
      })
    }

    const pool = getPgPool()

    const result = await pool.query(
      `
        SELECT
          aa.id_aplicacao::text AS "idAplicacao",
          aa.status,

          aa.criado_em AS "criadoEm",
          aa.iniciado_em AS "iniciadoEm",
          aa.concluido_em AS "concluidoEm",

          a.id_aluno::text AS "alunoId",
          a.nome AS "alunoNome",
          a.inep AS "alunoInep",

          t.id_turma::text AS "turmaId",
          t.letra_turma AS "turmaLetra",
          t.turno AS "turmaTurno",

          et.id_etapa::text AS "etapaId",
          et.descricao AS "etapaDescricao",

          e.id_escola::text AS "escolaId",
          e.nome_escola AS "escolaNome"

        FROM public.avaliacao_aplicador_aplicacoes aa

        INNER JOIN public.alunos a
          ON a.id_aluno = aa.id_aluno

        INNER JOIN public.turmas t
          ON t.id_turma = aa.id_turma

        INNER JOIN public.escolas e
          ON e.id_escola = t.id_escola

        LEFT JOIN public.etapas et
          ON et.id_etapa = t.id_etapa

        WHERE aa.id_aplicacao = $1
          AND aa.cpf_aplicador = $2

        LIMIT 1
      `,
      [
        idAplicacao,
        cpf
      ]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Aplicação não encontrada'
      })
    }

    return res.json(result.rows[0])

  } catch (error) {
    console.error(
      'Erro ao carregar aplicação:',
      error
    )

    return res.status(500).json({
      error: 'Erro ao carregar aplicação'
    })
  }
})

/**
 * POST /api/aplicador/aplicacoes/:id/iniciar
 */
router.post('/aplicacoes/:id/iniciar', async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const cpf = getAuthenticatedCpf(req)
    const idAplicacao = Number(req.params.id)

    if (
      !Number.isInteger(idAplicacao)
      || idAplicacao <= 0
    ) {
      return res.status(400).json({
        error: 'Aplicação inválida'
      })
    }

    const pool = getPgPool()

    const result = await pool.query(
      `
        SELECT
          id_aplicacao::text AS "idAplicacao",
          status,
          iniciado_em AS "iniciadoEm",
          atualizado_em AS "atualizadoEm"

        FROM public.avaliacao_aplicador_aplicacoes

        WHERE id_aplicacao = $1
          AND cpf_aplicador = $2

        LIMIT 1
      `,
      [
        idAplicacao,
        cpf
      ]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Aplicação não encontrada'
      })
    }

    /*
     * Compatibilidade com o frontend antigo:
     * abrir/iniciar não altera mais o status.
     * A mudança PENDENTE -> EM_ANDAMENTO acontece
     * somente ao salvar a primeira resposta.
     */
    return res.json({
      ok: true,
      aplicacao: result.rows[0]
    })

  } catch (error) {
    console.error(
      'Erro ao abrir aplicação:',
      error
    )

    return res.status(500).json({
      error: 'Erro ao abrir aplicação'
    })
  }
})

/**
 * =========================================================
 * GET /api/aplicador/aplicacoes/:id/questionario
 * =========================================================
 */
router.get('/aplicacoes/:id/questionario', async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const cpf = getAuthenticatedCpf(req)
    const idAplicacao = Number(req.params.id)

    if (!Number.isInteger(idAplicacao) || idAplicacao <= 0) {
      return res.status(400).json({
        error: 'Aplicação inválida'
      })
    }

    const pool = getPgPool()

    const aplicacao = await pool.query(
      `
        SELECT
          id_aplicacao,
          status
        FROM public.avaliacao_aplicador_aplicacoes
        WHERE id_aplicacao = $1
          AND cpf_aplicador = $2
        LIMIT 1
      `,
      [idAplicacao, cpf]
    )

    if (aplicacao.rowCount === 0) {
      return res.status(404).json({
        error: 'Aplicação não encontrada'
      })
    }

    const perguntas = await pool.query(
      `
        SELECT
          p.id_pergunta::text AS "idPergunta",
          p.codigo,
          p.ordem,
          p.habilidade,
          p.pergunta,

          o.id_opcao::text AS "idOpcao",
          o.codigo AS "opcaoCodigo",
          o.descricao AS "opcaoDescricao",
          o.detalhamento,
          o.ordem AS "opcaoOrdem",

          r.id_opcao::text AS "respostaIdOpcao",
          r.letra_aplicada AS "letraAplicada"

        FROM public.avaliacao_aplicador_perguntas p

        INNER JOIN public.avaliacao_aplicador_opcoes o
          ON o.id_pergunta = p.id_pergunta
         AND o.ativo = true

        LEFT JOIN public.avaliacao_aplicador_respostas r
          ON r.id_aplicacao = $1
         AND r.id_pergunta = p.id_pergunta

        WHERE p.ativo = true

        ORDER BY
          p.ordem,
          o.ordem
      `,
      [idAplicacao]
    )

    const mapa = new Map<string, any>()

    for (const row of perguntas.rows) {
      if (!mapa.has(row.idPergunta)) {
        mapa.set(row.idPergunta, {
          idPergunta: row.idPergunta,
          codigo: row.codigo,
          ordem: row.ordem,
          habilidade: row.habilidade,
          pergunta: row.pergunta,
          respostaIdOpcao: row.respostaIdOpcao,
          letraAplicada: row.letraAplicada || null,
          opcoes: []
        })
      }

      mapa.get(row.idPergunta).opcoes.push({
        idOpcao: row.idOpcao,
        codigo: row.opcaoCodigo,
        descricao: row.opcaoDescricao,
        detalhamento: row.detalhamento,
        ordem: row.opcaoOrdem
      })
    }

    return res.json({
      idAplicacao: String(idAplicacao),
      status: aplicacao.rows[0].status,
      perguntas: Array.from(mapa.values())
    })

  } catch (error) {
    console.error(
      'Erro ao carregar questionário:',
      error
    )

    return res.status(500).json({
      error: 'Erro ao carregar questionário'
    })
  }
})


/**
 * =========================================================
 * PUT /api/aplicador/aplicacoes/:id/respostas
 * =========================================================
 *
 * Body:
 *
 * {
 *   "respostas": [
 *     {
 *       "idPergunta": 1,
 *       "idOpcao": 2
 *     }
 *   ]
 * }
 */
router.put('/aplicacoes/:id/respostas', async (
  req: AuthRequest,
  res: Response
) => {
  const client = await getPgPool().connect()

  try {
    const cpf = getAuthenticatedCpf(req)
    const idAplicacao = Number(req.params.id)

    if (!Number.isInteger(idAplicacao) || idAplicacao <= 0) {
      return res.status(400).json({
        error: 'Aplicação inválida'
      })
    }

    const respostas = Array.isArray(req.body?.respostas)
      ? req.body.respostas
      : []

    if (respostas.length === 0) {
      return res.status(400).json({
        error: 'Informe ao menos uma resposta'
      })
    }

    await client.query('BEGIN')

    const aplicacao = await client.query(
      `
        SELECT
          id_aplicacao,
          status
        FROM public.avaliacao_aplicador_aplicacoes
        WHERE id_aplicacao = $1
          AND cpf_aplicador = $2
        FOR UPDATE
      `,
      [idAplicacao, cpf]
    )

    if (aplicacao.rowCount === 0) {
      await client.query('ROLLBACK')

      return res.status(404).json({
        error: 'Aplicação não encontrada'
      })
    }

    const statusAtual =
      aplicacao.rows[0].status

    if (
      statusAtual !== 'PENDENTE' &&
      statusAtual !== 'EM_ANDAMENTO'
    ) {
      await client.query('ROLLBACK')

      return res.status(409).json({
        error: 'Esta aplicação não pode mais receber respostas',
        status: statusAtual
      })
    }

    /*
     * A aplicação só entra em andamento quando há
     * uma tentativa real de salvar resposta.
     * Como tudo ocorre na mesma transação, qualquer
     * erro posterior desfaz também esta mudança.
     */
    if (statusAtual === 'PENDENTE') {
      await client.query(
        `
          UPDATE public.avaliacao_aplicador_aplicacoes

          SET
            status = 'EM_ANDAMENTO',
            iniciado_em = COALESCE(
              iniciado_em,
              CURRENT_TIMESTAMP
            ),
            atualizado_em = CURRENT_TIMESTAMP

          WHERE id_aplicacao = $1
            AND cpf_aplicador = $2
            AND status = 'PENDENTE'
        `,
        [
          idAplicacao,
          cpf
        ]
      )
    }

    for (const resposta of respostas) {
      const idPergunta = Number(resposta?.idPergunta)
      const idOpcao = Number(resposta?.idOpcao)

      const letraAplicadaRaw =
        resposta?.letraAplicada == null
          ? ''
          : String(resposta.letraAplicada)

      const letraAplicada =
        letraAplicadaRaw
          .trim()
          .toUpperCase()

      if (
        !Number.isInteger(idPergunta)
        || idPergunta <= 0
        || !Number.isInteger(idOpcao)
        || idOpcao <= 0
      ) {
        await client.query('ROLLBACK')

        return res.status(400).json({
          error: 'Resposta inválida'
        })
      }

      const opcaoValida = await client.query(
        `
          SELECT
            p.ordem AS "ordemPergunta"
          FROM public.avaliacao_aplicador_opcoes o
          INNER JOIN public.avaliacao_aplicador_perguntas p
            ON p.id_pergunta = o.id_pergunta
          WHERE o.id_opcao = $1
            AND o.id_pergunta = $2
            AND o.ativo = true
            AND p.ativo = true
          LIMIT 1
        `,
        [
          idOpcao,
          idPergunta
        ]
      )

      if (opcaoValida.rowCount === 0) {
        await client.query('ROLLBACK')

        return res.status(400).json({
          error: 'Opção inválida para a pergunta informada'
        })
      }

      const ordemPergunta =
        Number(
          opcaoValida.rows[0].ordemPergunta
        )

      const vogaisValidas =
        new Set([
          'A',
          'E',
          'I',
          'O',
          'U'
        ])

      const consoantesValidas =
        new Set([
          'B',
          'C',
          'D',
          'F',
          'J',
          'L',
          'M',
          'N',
          'P',
          'R',
          'S',
          'T',
          'V',
          'X',
          'Z'
        ])

      let letraParaSalvar:
        string | null = null

      if (ordemPergunta === 2) {
        if (
          letraAplicada.length !== 1 ||
          !vogaisValidas.has(
            letraAplicada
          )
        ) {
          await client.query('ROLLBACK')

          return res.status(400).json({
            error:
              'Informe uma vogal válida para a Questão 2: A, E, I, O ou U.'
          })
        }

        letraParaSalvar =
          letraAplicada
      } else if (
        ordemPergunta === 5
      ) {
        if (
          letraAplicada.length !== 1 ||
          !consoantesValidas.has(
            letraAplicada
          )
        ) {
          await client.query('ROLLBACK')

          return res.status(400).json({
            error:
              'Informe uma consoante válida para a Questão 5.'
          })
        }

        letraParaSalvar =
          letraAplicada
      }

      await client.query(
        `
          INSERT INTO public.avaliacao_aplicador_respostas
          (
            id_aplicacao,
            id_pergunta,
            id_opcao,
            letra_aplicada,
            respondido_em,
            atualizado_em
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )

          ON CONFLICT (id_aplicacao, id_pergunta)

          DO UPDATE SET
            id_opcao = EXCLUDED.id_opcao,
            letra_aplicada =
              EXCLUDED.letra_aplicada,
            atualizado_em = CURRENT_TIMESTAMP
        `,
        [
          idAplicacao,
          idPergunta,
          idOpcao,
          letraParaSalvar
        ]
      )
    }

    const aplicacaoAtualizada = await client.query(
      `
        UPDATE public.avaliacao_aplicador_aplicacoes
        SET atualizado_em = CURRENT_TIMESTAMP
        WHERE id_aplicacao = $1
          AND cpf_aplicador = $2
        RETURNING
          status,
          iniciado_em AS "iniciadoEm",
          atualizado_em AS "atualizadoEm"
      `,
      [
        idAplicacao,
        cpf
      ]
    )

    await client.query('COMMIT')

    return res.json({
      ok: true,
      respostasSalvas: respostas.length,
      status: aplicacaoAtualizada.rows[0]?.status || 'EM_ANDAMENTO',
      iniciadoEm: aplicacaoAtualizada.rows[0]?.iniciadoEm || null
    })

  } catch (error) {
    await client.query('ROLLBACK')

    console.error(
      'Erro ao salvar respostas:',
      error
    )

    return res.status(500).json({
      error: 'Erro ao salvar respostas'
    })

  } finally {
    client.release()
  }
})




/**
 * =========================================================
 * GET /api/aplicador/aplicacoes/:id/sugestao-vogal
 * =========================================================
 *
 * Sugere somente a vogal da Questão 2.
 *
 * Regras:
 * - considera a mesma fase + turma;
 * - usa somente A, E, I, O, U;
 * - aplicações CANCELADA não entram na contagem;
 * - se a aplicação atual já possui vogal salva,
 *   devolve a própria vogal como sugestão;
 * - em empate, usa ordem determinística A, E, I, O, U.
 */
router.get(
  '/aplicacoes/:id/sugestao-vogal',
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const cpf =
        getAuthenticatedCpf(req)

      const idAplicacao =
        Number(req.params.id)

      if (
        !Number.isInteger(idAplicacao) ||
        idAplicacao <= 0
      ) {
        return res.status(400).json({
          error:
            'Aplicação inválida'
        })
      }

      const pool =
        getPgPool()

      const aplicacao =
        await pool.query(
          `
            SELECT
              aa.id_aplicacao,
              aa.id_fase AS "idFase",
              aa.id_turma AS "idTurma",
              aa.status
            FROM public.avaliacao_aplicador_aplicacoes aa
            WHERE aa.id_aplicacao = $1
              AND aa.cpf_aplicador = $2
            LIMIT 1
          `,
          [
            idAplicacao,
            cpf
          ]
        )

      if (
        aplicacao.rowCount === 0
      ) {
        return res.status(404).json({
          error:
            'Aplicação não encontrada'
        })
      }

      const idFase =
        Number(
          aplicacao.rows[0].idFase
        )

      const idTurma =
        Number(
          aplicacao.rows[0].idTurma
        )

      if (
        !Number.isInteger(idFase) ||
        idFase <= 0 ||
        !Number.isInteger(idTurma) ||
        idTurma <= 0
      ) {
        return res.status(409).json({
          error:
            'A aplicação não possui fase e turma válidas para sugerir a vogal.'
        })
      }

      const respostaAtual =
        await pool.query(
          `
            SELECT
              UPPER(
                BTRIM(
                  r.letra_aplicada
                )
              ) AS letra
            FROM public.avaliacao_aplicador_respostas r
            INNER JOIN public.avaliacao_aplicador_perguntas p
              ON p.id_pergunta =
                 r.id_pergunta
            WHERE r.id_aplicacao = $1
              AND p.ativo = true
              AND p.ordem = 2
              AND UPPER(
                    BTRIM(
                      COALESCE(
                        r.letra_aplicada,
                        ''
                      )
                    )
                  ) IN (
                    'A',
                    'E',
                    'I',
                    'O',
                    'U'
                  )
            LIMIT 1
          `,
          [idAplicacao]
        )

      const contagemResult =
        await pool.query(
          `
            SELECT
              UPPER(
                BTRIM(
                  r.letra_aplicada
                )
              ) AS letra,
              COUNT(*)::integer
                AS quantidade
            FROM public.avaliacao_aplicador_respostas r
            INNER JOIN public.avaliacao_aplicador_perguntas p
              ON p.id_pergunta =
                 r.id_pergunta
            INNER JOIN public.avaliacao_aplicador_aplicacoes aa
              ON aa.id_aplicacao =
                 r.id_aplicacao
            WHERE p.ativo = true
              AND p.ordem = 2
              AND aa.id_fase = $1
              AND aa.id_turma = $2
              AND aa.status <> 'CANCELADA'
              AND UPPER(
                    BTRIM(
                      COALESCE(
                        r.letra_aplicada,
                        ''
                      )
                    )
                  ) IN (
                    'A',
                    'E',
                    'I',
                    'O',
                    'U'
                  )
            GROUP BY
              UPPER(
                BTRIM(
                  r.letra_aplicada
                )
              )
          `,
          [
            idFase,
            idTurma
          ]
        )

      const ordemVogais =
        ['A', 'E', 'I', 'O', 'U']

      const contagens:
        Record<string, number> = {
          A: 0,
          E: 0,
          I: 0,
          O: 0,
          U: 0
        }

      for (
        const row
        of contagemResult.rows
      ) {
        const letra =
          String(
            row.letra || ''
          )
            .trim()
            .toUpperCase()

        if (
          letra in contagens
        ) {
          contagens[letra] =
            Number(
              row.quantidade || 0
            )
        }
      }

      const letraAtual =
        respostaAtual.rowCount > 0
          ? String(
              respostaAtual.rows[0].letra
            )
              .trim()
              .toUpperCase()
          : null

      let sugestao =
        letraAtual

      if (!sugestao) {
        sugestao =
          ordemVogais.reduce(
            (
              melhor,
              atual
            ) => {
              if (
                contagens[atual] <
                contagens[melhor]
              ) {
                return atual
              }

              return melhor
            },
            ordemVogais[0]
          )
      }

      return res.json({
        idAplicacao:
          String(idAplicacao),

        idFase:
          String(idFase),

        idTurma:
          String(idTurma),

        letraAtual,

        sugestao,

        contagens
      })

    } catch (error) {
      console.error(
        'Erro ao calcular sugestão de vogal:',
        error
      )

      return res.status(500).json({
        error:
          'Erro ao calcular sugestão de vogal'
      })
    }
  }
)


/**
 * =========================================================
 * QUESTÃO 9 - LEITURA DE PALAVRAS
 * =========================================================
 *
 * Regras:
 * - uma classificação por palavra;
 * - a classificação é salva antes do áudio;
 * - áudio obrigatório para finalizar, exceto
 *   quando classificacao = NAO_RESPONDEU;
 * - o primeiro salvamento real altera
 *   PENDENTE -> EM_ANDAMENTO;
 * - armazenamento:
 *   fase-{id_fase}/aplicacao-{id_aplicacao}/palavra-{id_palavra}.webm
 */

router.get(
  '/aplicacoes/:id/leitura',
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const cpf =
        getAuthenticatedCpf(req)

      const idAplicacao =
        Number(req.params.id)

      if (
        !Number.isInteger(idAplicacao) ||
        idAplicacao <= 0
      ) {
        return res.status(400).json({
          error: 'Aplicação inválida'
        })
      }

      const pool = getPgPool()

      const aplicacao =
        await pool.query(
          `
            SELECT
              id_aplicacao,
              id_fase,
              status
            FROM public.avaliacao_aplicador_aplicacoes
            WHERE id_aplicacao = $1
              AND cpf_aplicador = $2
            LIMIT 1
          `,
          [idAplicacao, cpf]
        )

      if (
        aplicacao.rowCount === 0
      ) {
        return res.status(404).json({
          error:
            'Aplicação não encontrada'
        })
      }

      const palavras =
        await pool.query(
          `
            SELECT
              p.id_palavra::text
                AS "idPalavra",
              p.palavra,
              p.ordem,
              r.classificacao,

              CASE
                WHEN NULLIF(
                  BTRIM(
                    COALESCE(
                      r.audio_arquivo,
                      ''
                    )
                  ),
                  ''
                ) IS NULL
                  THEN false
                ELSE true
              END AS "possuiAudio",

              r.audio_mime_type
                AS "audioMimeType",
              r.audio_tamanho
                AS "audioTamanho",
              r.respondido_em
                AS "respondidoEm",
              r.atualizado_em
                AS "atualizadoEm"

            FROM public.avaliacao_aplicador_leitura_palavras p

            LEFT JOIN public.avaliacao_aplicador_leitura_respostas r
              ON r.id_palavra = p.id_palavra
             AND r.id_aplicacao = $1

            WHERE p.ativo = true

            ORDER BY p.ordem
          `,
          [idAplicacao]
        )

      return res.json({
        idAplicacao:
          String(idAplicacao),

        idFase:
          aplicacao.rows[0].id_fase
            ? String(
                aplicacao.rows[0].id_fase
              )
            : null,

        status:
          aplicacao.rows[0].status,

        palavras:
          palavras.rows
      })

    } catch (error) {
      console.error(
        'Erro ao carregar leitura:',
        error
      )

      return res.status(500).json({
        error:
          'Erro ao carregar leitura'
      })
    }
  }
)


router.put(
  '/aplicacoes/:id/leitura/:idPalavra',
  async (
    req: AuthRequest,
    res: Response
  ) => {
    const client =
      await getPgPool().connect()

    try {
      const cpf =
        getAuthenticatedCpf(req)

      const idAplicacao =
        Number(req.params.id)

      const idPalavra =
        Number(req.params.idPalavra)

      const classificacao =
        String(
          req.body?.classificacao ||
          ''
        )
          .trim()
          .toUpperCase()

      const classificacoesValidas =
        new Set([
          'NAO_UTILIZA_SONS',
          'UTILIZA_ALGUNS_SONS',
          'DECODIFICA',
          'LE_AUTONOMIA',
          'NAO_RESPONDEU'
        ])

      if (
        !Number.isInteger(idAplicacao) ||
        idAplicacao <= 0 ||
        !Number.isInteger(idPalavra) ||
        idPalavra <= 0
      ) {
        return res.status(400).json({
          error:
            'Aplicação ou palavra inválida'
        })
      }

      if (
        !classificacoesValidas.has(
          classificacao
        )
      ) {
        return res.status(400).json({
          error:
            'Classificação inválida'
        })
      }

      await client.query('BEGIN')

      const aplicacao =
        await client.query(
          `
            SELECT
              id_aplicacao,
              status
            FROM public.avaliacao_aplicador_aplicacoes
            WHERE id_aplicacao = $1
              AND cpf_aplicador = $2
            FOR UPDATE
          `,
          [idAplicacao, cpf]
        )

      if (
        aplicacao.rowCount === 0
      ) {
        await client.query('ROLLBACK')

        return res.status(404).json({
          error:
            'Aplicação não encontrada'
        })
      }

      const statusAtual =
        aplicacao.rows[0].status

      if (
        statusAtual !== 'PENDENTE' &&
        statusAtual !== 'EM_ANDAMENTO'
      ) {
        await client.query('ROLLBACK')

        return res.status(409).json({
          error:
            'Esta aplicação não pode mais receber respostas',
          status: statusAtual
        })
      }

      const palavra =
        await client.query(
          `
            SELECT id_palavra
            FROM public.avaliacao_aplicador_leitura_palavras
            WHERE id_palavra = $1
              AND ativo = true
            LIMIT 1
          `,
          [idPalavra]
        )

      if (
        palavra.rowCount === 0
      ) {
        await client.query('ROLLBACK')

        return res.status(404).json({
          error:
            'Palavra não encontrada'
        })
      }

      if (
        statusAtual === 'PENDENTE'
      ) {
        await client.query(
          `
            UPDATE public.avaliacao_aplicador_aplicacoes
            SET
              status = 'EM_ANDAMENTO',
              iniciado_em = COALESCE(
                iniciado_em,
                CURRENT_TIMESTAMP
              ),
              atualizado_em = CURRENT_TIMESTAMP
            WHERE id_aplicacao = $1
              AND cpf_aplicador = $2
              AND status = 'PENDENTE'
          `,
          [idAplicacao, cpf]
        )
      }

      const resposta =
        await client.query(
          `
            INSERT INTO public.avaliacao_aplicador_leitura_respostas
            (
              id_aplicacao,
              id_palavra,
              classificacao,
              respondido_em,
              atualizado_em
            )
            VALUES
            (
              $1,
              $2,
              $3,
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )

            ON CONFLICT
              (id_aplicacao, id_palavra)

            DO UPDATE SET
              classificacao =
                EXCLUDED.classificacao,
              atualizado_em =
                CURRENT_TIMESTAMP

            RETURNING
              id_resposta::text
                AS "idResposta",
              classificacao,
              audio_arquivo
                AS "audioArquivo",
              audio_mime_type
                AS "audioMimeType",
              audio_tamanho
                AS "audioTamanho",
              atualizado_em
                AS "atualizadoEm"
          `,
          [
            idAplicacao,
            idPalavra,
            classificacao
          ]
        )

      await client.query(
        `
          UPDATE public.avaliacao_aplicador_aplicacoes
          SET atualizado_em =
              CURRENT_TIMESTAMP
          WHERE id_aplicacao = $1
            AND cpf_aplicador = $2
        `,
        [idAplicacao, cpf]
      )

      await client.query('COMMIT')

      return res.json({
        ok: true,
        resposta:
          resposta.rows[0],
        status:
          statusAtual === 'PENDENTE'
            ? 'EM_ANDAMENTO'
            : statusAtual
      })

    } catch (error) {
      await client.query('ROLLBACK')

      console.error(
        'Erro ao salvar classificação da leitura:',
        error
      )

      return res.status(500).json({
        error:
          'Erro ao salvar classificação da leitura'
      })

    } finally {
      client.release()
    }
  }
)


router.post(
  '/aplicacoes/:id/leitura/:idPalavra/audio',
  audioRawMiddleware,
  async (
    req: AuthRequest,
    res: Response
  ) => {
    let arquivoGravado:
      string | null = null

    try {
      const cpf =
        getAuthenticatedCpf(req)

      const idAplicacao =
        Number(req.params.id)

      const idPalavra =
        Number(req.params.idPalavra)

      if (
        !Number.isInteger(idAplicacao) ||
        idAplicacao <= 0 ||
        !Number.isInteger(idPalavra) ||
        idPalavra <= 0
      ) {
        return res.status(400).json({
          error:
            'Aplicação ou palavra inválida'
        })
      }

      if (
        !Buffer.isBuffer(req.body) ||
        req.body.length === 0
      ) {
        return res.status(400).json({
          error:
            'Áudio não informado'
        })
      }

      if (
        req.body.length >
        AUDIO_MAX_BYTES
      ) {
        return res.status(413).json({
          error:
            'Arquivo de áudio muito grande'
        })
      }

      const contentType =
        String(
          req.headers[
            'content-type'
          ] || ''
        )
          .split(';')[0]
          .trim()
          .toLowerCase()

      if (
        contentType !== 'audio/webm' &&
        contentType !==
          'application/octet-stream'
      ) {
        return res.status(415).json({
          error:
            'Formato de áudio não suportado. Utilize WEBM.'
        })
      }

      const pool = getPgPool()

      const registro =
        await pool.query(
          `
            SELECT
              aa.id_fase AS "idFase",
              aa.status,
              lr.classificacao

            FROM public.avaliacao_aplicador_aplicacoes aa

            INNER JOIN public.avaliacao_aplicador_leitura_respostas lr
              ON lr.id_aplicacao = aa.id_aplicacao
             AND lr.id_palavra = $3

            INNER JOIN public.avaliacao_aplicador_leitura_palavras lp
              ON lp.id_palavra = lr.id_palavra
             AND lp.ativo = true

            WHERE aa.id_aplicacao = $1
              AND aa.cpf_aplicador = $2

            LIMIT 1
          `,
          [
            idAplicacao,
            cpf,
            idPalavra
          ]
        )

      if (
        registro.rowCount === 0
      ) {
        return res.status(409).json({
          error:
            'Salve primeiro a classificação desta palavra antes de enviar o áudio.'
        })
      }

      const status =
        registro.rows[0].status

      if (
        status !== 'PENDENTE' &&
        status !== 'EM_ANDAMENTO'
      ) {
        return res.status(409).json({
          error:
            'Esta aplicação não pode mais receber áudio',
          status
        })
      }

      const idFase =
        Number(
          registro.rows[0].idFase
        )

      if (
        !Number.isInteger(idFase) ||
        idFase <= 0
      ) {
        return res.status(409).json({
          error:
            'A aplicação não possui fase válida para armazenamento do áudio.'
        })
      }

      const relativePath =
        getAudioRelativePath(
          idFase,
          idAplicacao,
          idPalavra
        )

      const absolutePath =
        getAudioAbsolutePath(
          relativePath
        )

      await fs.mkdir(
        path.dirname(
          absolutePath
        ),
        {
          recursive: true
        }
      )

      await fs.writeFile(
        absolutePath,
        req.body
      )

      arquivoGravado =
        absolutePath

      const atualizado =
        await pool.query(
          `
            UPDATE public.avaliacao_aplicador_leitura_respostas
            SET
              audio_arquivo = $1,
              audio_mime_type = $2,
              audio_tamanho = $3,
              atualizado_em =
                CURRENT_TIMESTAMP
            WHERE id_aplicacao = $4
              AND id_palavra = $5
            RETURNING
              audio_arquivo
                AS "audioArquivo",
              audio_mime_type
                AS "audioMimeType",
              audio_tamanho
                AS "audioTamanho",
              atualizado_em
                AS "atualizadoEm"
          `,
          [
            relativePath,
            'audio/webm',
            req.body.length,
            idAplicacao,
            idPalavra
          ]
        )

      await pool.query(
        `
          UPDATE public.avaliacao_aplicador_aplicacoes
          SET atualizado_em =
              CURRENT_TIMESTAMP
          WHERE id_aplicacao = $1
            AND cpf_aplicador = $2
        `,
        [idAplicacao, cpf]
      )

      return res.json({
        ok: true,
        audio:
          atualizado.rows[0]
      })

    } catch (error) {
      if (arquivoGravado) {
        try {
          await fs.unlink(
            arquivoGravado
          )
        } catch {
          // Ignora erro de limpeza.
        }
      }

      console.error(
        'Erro ao salvar áudio da leitura:',
        error
      )

      return res.status(500).json({
        error:
          'Erro ao salvar áudio da leitura'
      })
    }
  }
)


router.get(
  '/aplicacoes/:id/leitura/:idPalavra/audio',
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const cpf =
        getAuthenticatedCpf(req)

      const idAplicacao =
        Number(req.params.id)

      const idPalavra =
        Number(req.params.idPalavra)

      if (
        !Number.isInteger(idAplicacao) ||
        idAplicacao <= 0 ||
        !Number.isInteger(idPalavra) ||
        idPalavra <= 0
      ) {
        return res.status(400).json({
          error:
            'Aplicação ou palavra inválida'
        })
      }

      const pool = getPgPool()

      const result =
        await pool.query(
          `
            SELECT
              lr.audio_arquivo
                AS "audioArquivo",

              COALESCE(
                lr.audio_mime_type,
                'audio/webm'
              ) AS "audioMimeType"

            FROM public.avaliacao_aplicador_leitura_respostas lr

            INNER JOIN public.avaliacao_aplicador_aplicacoes aa
              ON aa.id_aplicacao =
                 lr.id_aplicacao

            WHERE lr.id_aplicacao = $1
              AND lr.id_palavra = $2
              AND aa.cpf_aplicador = $3

            LIMIT 1
          `,
          [
            idAplicacao,
            idPalavra,
            cpf
          ]
        )

      if (
        result.rowCount === 0
      ) {
        return res.status(404).json({
          error:
            'Registro de leitura não encontrado'
        })
      }

      const relativePath =
        String(
          result.rows[0].audioArquivo ||
          ''
        ).trim()

      if (!relativePath) {
        return res.status(404).json({
          error:
            'Esta palavra ainda não possui áudio'
        })
      }

      const absolutePath =
        getAudioAbsolutePath(
          relativePath
        )

      try {
        await fs.access(
          absolutePath
        )
      } catch {
        return res.status(404).json({
          error:
            'Arquivo de áudio não encontrado no armazenamento'
        })
      }

      res.setHeader(
        'Content-Type',
        result.rows[0].audioMimeType ||
        'audio/webm'
      )

      res.setHeader(
        'Cache-Control',
        'private, no-store'
      )

      return res.sendFile(
        absolutePath
      )

    } catch (error) {
      console.error(
        'Erro ao carregar áudio da leitura:',
        error
      )

      return res.status(500).json({
        error:
          'Erro ao carregar áudio da leitura'
      })
    }
  }
)


router.post('/aplicacoes/:id/finalizar', async (
  req: AuthRequest,
  res: Response
) => {
  const client = await getPgPool().connect()

  try {
    const cpf = getAuthenticatedCpf(req)
    const idAplicacao = Number(req.params.id)

    if (!Number.isInteger(idAplicacao) || idAplicacao <= 0) {
      return res.status(400).json({
        error: 'Aplicação inválida'
      })
    }

    await client.query('BEGIN')

    const aplicacao = await client.query(
      `
        SELECT
          id_aplicacao,
          status
        FROM public.avaliacao_aplicador_aplicacoes
        WHERE id_aplicacao = $1
          AND cpf_aplicador = $2
        FOR UPDATE
      `,
      [
        idAplicacao,
        cpf
      ]
    )

    if (aplicacao.rowCount === 0) {
      await client.query('ROLLBACK')

      return res.status(404).json({
        error: 'Aplicação não encontrada'
      })
    }

    if (aplicacao.rows[0].status !== 'EM_ANDAMENTO') {
      await client.query('ROLLBACK')

      return res.status(409).json({
        error: 'Somente aplicações em andamento podem ser finalizadas',
        status: aplicacao.rows[0].status
      })
    }

    const conferencia = await client.query(
      `
        SELECT
          (
            SELECT COUNT(*)
            FROM public.avaliacao_aplicador_perguntas
            WHERE ativo = true
              AND ordem <> 8
          )::integer AS total_perguntas,

          (
            SELECT COUNT(DISTINCT r.id_pergunta)
            FROM public.avaliacao_aplicador_respostas r
            INNER JOIN public.avaliacao_aplicador_perguntas p
              ON p.id_pergunta = r.id_pergunta
            WHERE r.id_aplicacao = $1
              AND p.ativo = true
              AND p.ordem <> 8
          )::integer AS total_respostas,

          (
            SELECT COUNT(*)
            FROM public.avaliacao_aplicador_leitura_palavras
            WHERE ativo = true
          )::integer AS total_palavras_leitura,

          (
            SELECT COUNT(DISTINCT lr.id_palavra)
            FROM public.avaliacao_aplicador_leitura_respostas lr
            INNER JOIN public.avaliacao_aplicador_leitura_palavras lp
              ON lp.id_palavra = lr.id_palavra
            WHERE lr.id_aplicacao = $1
              AND lp.ativo = true
          )::integer AS total_leituras_respondidas,

          (
            SELECT COUNT(*)
            FROM public.avaliacao_aplicador_respostas r
            INNER JOIN public.avaliacao_aplicador_perguntas p
              ON p.id_pergunta = r.id_pergunta
            WHERE r.id_aplicacao = $1
              AND p.ativo = true
              AND (
                (
                  p.ordem = 2
                  AND UPPER(
                        BTRIM(
                          COALESCE(
                            r.letra_aplicada,
                            ''
                          )
                        )
                      ) NOT IN (
                        'A',
                        'E',
                        'I',
                        'O',
                        'U'
                      )
                )
                OR
                (
                  p.ordem = 5
                  AND UPPER(
                        BTRIM(
                          COALESCE(
                            r.letra_aplicada,
                            ''
                          )
                        )
                      ) NOT IN (
                        'B',
                        'C',
                        'D',
                        'F',
                        'J',
                        'L',
                        'M',
                        'N',
                        'P',
                        'R',
                        'S',
                        'T',
                        'V',
                        'X',
                        'Z'
                      )
                )
              )
          )::integer AS letras_obrigatorias_invalidas,

          (
            SELECT COUNT(*)
            FROM public.avaliacao_aplicador_leitura_respostas lr
            INNER JOIN public.avaliacao_aplicador_leitura_palavras lp
              ON lp.id_palavra = lr.id_palavra
            WHERE lr.id_aplicacao = $1
              AND lp.ativo = true
              AND lr.classificacao <> 'NAO_RESPONDEU'
              AND NULLIF(
                    BTRIM(
                      COALESCE(
                        lr.audio_arquivo,
                        ''
                      )
                    ),
                    ''
                  ) IS NULL
          )::integer AS leituras_sem_audio
      `,
      [idAplicacao]
    )

    const totalPerguntas =
      Number(
        conferencia.rows[0].total_perguntas
      )

    const totalRespostas =
      Number(
        conferencia.rows[0].total_respostas
      )

    const letrasObrigatoriasInvalidas =
      Number(
        conferencia.rows[0]
          .letras_obrigatorias_invalidas
      )

    const totalPalavrasLeitura =
      Number(
        conferencia.rows[0].total_palavras_leitura
      )

    const totalLeiturasRespondidas =
      Number(
        conferencia.rows[0].total_leituras_respondidas
      )

    const leiturasSemAudio =
      Number(
        conferencia.rows[0].leituras_sem_audio
      )

    if (
      totalRespostas <
      totalPerguntas
    ) {
      await client.query('ROLLBACK')

      return res.status(409).json({
        error:
          'Existem perguntas sem resposta',
        totalPerguntas,
        totalRespostas,
        faltantes:
          totalPerguntas -
          totalRespostas
      })
    }

    if (
      letrasObrigatoriasInvalidas > 0
    ) {
      await client.query('ROLLBACK')

      return res.status(409).json({
        error:
          'As Questões 2 e 5 exigem o registro da letra aplicada.',
        letrasObrigatoriasInvalidas
      })
    }

    if (
      totalLeiturasRespondidas <
      totalPalavrasLeitura
    ) {
      await client.query('ROLLBACK')

      return res.status(409).json({
        error:
          'Existem palavras da leitura sem classificação',
        totalPalavras:
          totalPalavrasLeitura,
        totalClassificadas:
          totalLeiturasRespondidas,
        faltantes:
          totalPalavrasLeitura -
          totalLeiturasRespondidas
      })
    }

    /*
     * Áudio obrigatório quando houve tentativa de leitura.
     * Para NAO_RESPONDEU, a Aplicadora pode finalizar sem áudio.
     */
    if (
      leiturasSemAudio > 0
    ) {
      await client.query('ROLLBACK')

      return res.status(409).json({
        error:
          'Existem palavras classificadas sem o áudio obrigatório',
        leiturasSemAudio
      })
    }


    const result = await client.query(
      `
        UPDATE public.avaliacao_aplicador_aplicacoes

        SET
          status = 'CONCLUIDA',
          concluido_em = CURRENT_TIMESTAMP,
          atualizado_em = CURRENT_TIMESTAMP

        WHERE id_aplicacao = $1
          AND cpf_aplicador = $2

        RETURNING
          id_aplicacao::text AS "idAplicacao",
          status,
          iniciado_em AS "iniciadoEm",
          concluido_em AS "concluidoEm"
      `,
      [
        idAplicacao,
        cpf
      ]
    )

    await client.query('COMMIT')

    return res.json({
      ok: true,
      aplicacao: result.rows[0]
    })

  } catch (error) {
    await client.query('ROLLBACK')

    console.error(
      'Erro ao finalizar aplicação:',
      error
    )

    return res.status(500).json({
      error: 'Erro ao finalizar aplicação'
    })

  } finally {
    client.release()
  }
})

router.get('/pendentes/escolas', async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const cpf = getAuthenticatedCpf(req)
    const pool = getPgPool()

    const result = await pool.query(
      `
        SELECT
          e.id_escola::text AS "idEscola",
          e.nome_escola AS "nomeEscola",
          COUNT(*)::integer AS quantidade

        FROM public.avaliacao_aplicador_aplicacoes aa

        INNER JOIN public.turmas t
          ON t.id_turma = aa.id_turma

        INNER JOIN public.escolas e
          ON e.id_escola = t.id_escola

        WHERE aa.cpf_aplicador = $1
          AND aa.status = 'PENDENTE'

        GROUP BY
          e.id_escola,
          e.nome_escola

        ORDER BY
          e.nome_escola
      `,
      [cpf]
    )

    return res.json(result.rows)

  } catch (error) {
    console.error(
      'Erro ao carregar escolas pendentes:',
      error
    )

    return res.status(500).json({
      error: 'Erro ao carregar escolas'
    })
  }
})

router.get('/pendentes/escolas/:idEscola/etapas', async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const cpf = getAuthenticatedCpf(req)
    const idEscola = Number(req.params.idEscola)

    if (!Number.isInteger(idEscola) || idEscola <= 0) {
      return res.status(400).json({
        error: 'Escola inválida'
      })
    }

    const pool = getPgPool()

    const result = await pool.query(
      `
        SELECT
          et.id_etapa::text AS "idEtapa",
          et.descricao,
          COUNT(*)::integer AS quantidade

        FROM public.avaliacao_aplicador_aplicacoes aa

        INNER JOIN public.turmas t
          ON t.id_turma = aa.id_turma

        INNER JOIN public.etapas et
          ON et.id_etapa = t.id_etapa

        WHERE aa.cpf_aplicador = $1
          AND aa.status = 'PENDENTE'
          AND t.id_escola = $2

        GROUP BY
          et.id_etapa,
          et.descricao

        ORDER BY
          et.descricao
      `,
      [
        cpf,
        idEscola
      ]
    )

    return res.json(result.rows)

  } catch (error) {
    console.error(
      'Erro ao carregar etapas pendentes:',
      error
    )

    return res.status(500).json({
      error: 'Erro ao carregar etapas'
    })
  }
})

router.get(
  '/pendentes/escolas/:idEscola/etapas/:idEtapa/turmas',
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const cpf = getAuthenticatedCpf(req)

      const idEscola = Number(req.params.idEscola)
      const idEtapa = Number(req.params.idEtapa)

      if (
        !Number.isInteger(idEscola)
        || idEscola <= 0
        || !Number.isInteger(idEtapa)
        || idEtapa <= 0
      ) {
        return res.status(400).json({
          error: 'Escola ou etapa inválida'
        })
      }

      const pool = getPgPool()

      const result = await pool.query(
        `
          SELECT
            t.id_turma::text AS "idTurma",
            t.letra_turma AS "letraTurma",
            t.turno,
            COUNT(*)::integer AS quantidade

          FROM public.avaliacao_aplicador_aplicacoes aa

          INNER JOIN public.turmas t
            ON t.id_turma = aa.id_turma

          WHERE aa.cpf_aplicador = $1
            AND aa.status = 'PENDENTE'
            AND t.id_escola = $2
            AND t.id_etapa = $3

          GROUP BY
            t.id_turma,
            t.letra_turma,
            t.turno

          ORDER BY
            t.letra_turma,
            t.turno
        `,
        [
          cpf,
          idEscola,
          idEtapa
        ]
      )

      return res.json(result.rows)

    } catch (error) {
      console.error(
        'Erro ao carregar turmas pendentes:',
        error
      )

      return res.status(500).json({
        error: 'Erro ao carregar turmas'
      })
    }
  }
)

router.get(
  '/pendentes/escolas/:idEscola/etapas/:idEtapa/turmas/:idTurma/alunos',
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const cpf = getAuthenticatedCpf(req)

      const idEscola = Number(req.params.idEscola)
      const idEtapa = Number(req.params.idEtapa)
      const idTurma = Number(req.params.idTurma)

      if (
        !Number.isInteger(idEscola)
        || idEscola <= 0
        || !Number.isInteger(idEtapa)
        || idEtapa <= 0
        || !Number.isInteger(idTurma)
        || idTurma <= 0
      ) {
        return res.status(400).json({
          error: 'Parâmetros inválidos'
        })
      }

      const pool = getPgPool()

      const result = await pool.query(
        `
          SELECT
            aa.id_aplicacao::text AS "idAplicacao",

            a.id_aluno::text AS "idAluno",
            a.nome AS "nomeAluno",
            a.inep,

            aa.status

          FROM public.avaliacao_aplicador_aplicacoes aa

          INNER JOIN public.alunos a
            ON a.id_aluno = aa.id_aluno

          INNER JOIN public.turmas t
            ON t.id_turma = aa.id_turma

          WHERE aa.cpf_aplicador = $1
            AND aa.status = 'PENDENTE'

            AND t.id_escola = $2
            AND t.id_etapa = $3
            AND t.id_turma = $4

          ORDER BY
            a.nome
        `,
        [
          cpf,
          idEscola,
          idEtapa,
          idTurma
        ]
      )

      return res.json(result.rows)

    } catch (error) {
      console.error(
        'Erro ao carregar alunos pendentes:',
        error
      )

      return res.status(500).json({
        error: 'Erro ao carregar alunos'
      })
    }
  }
)

router.get('/em-andamento', async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const cpf = getAuthenticatedCpf(req)
    const pool = getPgPool()

    const result = await pool.query(
      `
        SELECT
          aa.id_aplicacao::text AS "idAplicacao",

          aa.status,

          aa.iniciado_em AS "iniciadoEm",
          aa.atualizado_em AS "atualizadoEm",

          a.id_aluno::text AS "idAluno",
          a.nome AS "nomeAluno",
          a.inep,

          e.id_escola::text AS "idEscola",
          e.nome_escola AS "nomeEscola",

          et.id_etapa::text AS "idEtapa",
          et.descricao AS "etapa",

          t.id_turma::text AS "idTurma",
          t.letra_turma AS "letraTurma",
          t.turno

        FROM public.avaliacao_aplicador_aplicacoes aa

        INNER JOIN public.alunos a
          ON a.id_aluno = aa.id_aluno

        INNER JOIN public.turmas t
          ON t.id_turma = aa.id_turma

        INNER JOIN public.escolas e
          ON e.id_escola = t.id_escola

        LEFT JOIN public.etapas et
          ON et.id_etapa = t.id_etapa

        WHERE aa.cpf_aplicador = $1
          AND aa.status = 'EM_ANDAMENTO'

        ORDER BY
          a.nome
      `,
      [cpf]
    )

    return res.json(result.rows)

  } catch (error) {
    console.error(
      'Erro ao carregar aplicações em andamento:',
      error
    )

    return res.status(500).json({
      error: 'Erro ao carregar aplicações em andamento'
    })
  }
})

router.get('/concluidas', async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const cpf = getAuthenticatedCpf(req)
    const pool = getPgPool()

    const result = await pool.query(
      `
        SELECT
          aa.id_aplicacao::text AS "idAplicacao",

          aa.concluido_em AS "concluidoEm",

          a.id_aluno::text AS "idAluno",
          a.nome AS "nomeAluno",
          a.inep,

          e.id_escola::text AS "idEscola",
          e.nome_escola AS "nomeEscola",

          et.id_etapa::text AS "idEtapa",
          et.descricao AS "etapa",

          t.id_turma::text AS "idTurma",
          t.letra_turma AS "letraTurma",
          t.turno

        FROM public.avaliacao_aplicador_aplicacoes aa

        INNER JOIN public.alunos a
          ON a.id_aluno = aa.id_aluno

        INNER JOIN public.turmas t
          ON t.id_turma = aa.id_turma

        INNER JOIN public.escolas e
          ON e.id_escola = t.id_escola

        LEFT JOIN public.etapas et
          ON et.id_etapa = t.id_etapa

        WHERE aa.cpf_aplicador = $1
          AND aa.status = 'CONCLUIDA'

        ORDER BY
          e.nome_escola,
          et.descricao,
          t.letra_turma,
          t.turno,
          a.nome
      `,
      [cpf]
    )

    return res.json(result.rows)

  } catch (error) {
    console.error(
      'Erro ao carregar aplicações concluídas:',
      error
    )

    return res.status(500).json({
      error: 'Erro ao carregar avaliações concluídas'
    })
  }
})

export default router