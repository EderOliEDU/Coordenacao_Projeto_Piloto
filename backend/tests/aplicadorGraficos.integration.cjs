// Integração DEV somente leitura; não cria fixtures nem modifica o banco.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { Pool } = require('pg')
const dotenv = require('dotenv')
const poolModule = require('../dist/services/pgPool')
const { carregarGraficosAplicador } = require('../dist/services/aplicadorGraficos')
const { carregarRelatorioTerceiraAvaliacao } = require('../dist/services/relatorioTerceiraAvaliacao')

test('Gráficos com PostgreSQL real: totais, versões, Q2 sem duplicação e filtros', async () => {
  const env = dotenv.parse(fs.readFileSync(__dirname + '/../.env_dev'))
  const pool = new Pool({ host: env.PILOTO_PG_HOST, port: Number(env.PILOTO_PG_PORT) || 5432,
    database: env.PILOTO_PG_DB || env.PILOTO_PG_DATABASE, user: env.PILOTO_PG_USER,
    password: env.PILOTO_PG_PASSWORD, connectionTimeoutMillis: 5000,
    options: '-c default_transaction_read_only=on' })
  const saved = poolModule.getPgPool
  poolModule.getPgPool = () => pool
  try {
    const d = await carregarGraficosAplicador({})
    const expected = await pool.query(`SELECT count(*)::int AS n FROM public.avaliacao_aplicador_aplicacoes
      WHERE id_fase=$1 AND status='CONCLUIDA'`, [d.filtros.faseId])
    assert.equal(d.resumo.concluidas, expected.rows[0].n)
    assert.equal(d.versoes.reduce((s, v) => s + v.total, 0), d.resumo.concluidas)
    assert.ok(d.perguntas.every(r => r.codigo !== 'ALITERACAO'))
    assert.ok(d.vogais.every(r => !Object.hasOwn(r, 'origem')))
    assert.equal(new Set(d.vogais.map(r => `${r.versao}/${r.vogal}/${r.acertou}`)).size, d.vogais.length)
    const vogaisEsperadas = await pool.query(`SELECT a.versao_instrumento AS versao,v.vogal,v.acertou,count(*)::int AS n
      FROM public.avaliacao_aplicador_vogais v JOIN public.avaliacao_aplicador_aplicacoes a USING(id_aplicacao)
      JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
      WHERE a.id_fase=$1 AND a.status='CONCLUIDA' AND p.codigo='ALITERACAO' AND v.acertou IS NOT NULL
      GROUP BY 1,2,3 ORDER BY 1,2,3`, [d.filtros.faseId])
    assert.deepEqual(d.vogais.filter(r => r.acertou !== null), vogaisEsperadas.rows)

    for (const v of d.versoes) {
      for (const vogal of 'AEIOU') {
        assert.equal(d.vogais.filter(r => r.versao === v.versao && r.vogal === vogal).reduce((s, r) => s + r.n, 0), v.total)
      }
      const selected = await carregarGraficosAplicador({ faseId: d.filtros.faseId, versao: v.versao })
      assert.equal(selected.resumo.concluidas, v.total)
      assert.ok(selected.leitura.every(r => r.versao === v.versao && r.comMetadadosAudio <= r.n))
    }
    const relatorio = await carregarRelatorioTerceiraAvaliacao()
    const unicas = await pool.query(`SELECT count(DISTINCT id_aluno)::int AS n FROM public.avaliacao_aplicador_aplicacoes
      WHERE id_fase=$1 AND status='CONCLUIDA'`, [relatorio.filtros.faseId])
    assert.equal(relatorio.base, unicas.rows[0].n)
    assert.equal(relatorio.protocolo.codigo, 'TERCEIRA-AVALIACAO-V1')
    assert.ok(relatorio.linhas.every(l => l.avaliadas + l.ausentes === l.base))
    assert.ok(!JSON.stringify(relatorio).includes('LEGADO'))
    for (const escola of relatorio.filtros.escolas) {
      const escolaReport = await carregarRelatorioTerceiraAvaliacao(escola.id)
      let somaTurmas = 0
      for (const turma of escolaReport.filtros.turmas) {
        const turmaReport = await carregarRelatorioTerceiraAvaliacao(escola.id, turma.id)
        const expectedTurma = await pool.query(`WITH unicas AS (
          SELECT DISTINCT ON (id_aluno) id_aluno,id_turma FROM public.avaliacao_aplicador_aplicacoes
          WHERE id_fase=$1 AND status='CONCLUIDA' ORDER BY id_aluno,concluido_em DESC NULLS LAST,id_aplicacao DESC)
          SELECT count(*)::int AS n FROM unicas WHERE id_turma=$2`, [relatorio.filtros.faseId, turma.id])
        assert.equal(turmaReport.base, expectedTurma.rows[0].n)
        assert.equal(turmaReport.filtros.turmaId, turma.id)
        assert.ok(turmaReport.linhas.every(l => l.base <= turmaReport.base))
        somaTurmas += turmaReport.base
      }
      assert.equal(somaTurmas, escolaReport.base)
      await assert.rejects(carregarRelatorioTerceiraAvaliacao(escola.id, 2147483647), e => e.status === 400)
    }
    await assert.rejects(carregarRelatorioTerceiraAvaliacao(undefined, 1), e => e.status === 400)
    const vazio = await carregarRelatorioTerceiraAvaliacao(2147483647)
    assert.equal(vazio.base, 0)
    const missing = await carregarGraficosAplicador({ faseId: d.filtros.faseId, escolaId: 2147483647 })
    assert.equal(missing.resumo.concluidas, 0)
    for (const key of ['versoes','perguntas','vogais','consoantes','leitura']) assert.deepEqual(missing[key], [])
    if (d.filtros.escolas.length) {
      const school = d.filtros.escolas[0].id
      const filtered = await carregarGraficosAplicador({ faseId: d.filtros.faseId, escolaId: school })
      const expectedSchool = await pool.query(`SELECT count(*)::int AS n FROM public.avaliacao_aplicador_aplicacoes a
        JOIN public.turmas t USING(id_turma) WHERE a.id_fase=$1 AND t.id_escola=$2 AND a.status='CONCLUIDA'`, [d.filtros.faseId, school])
      assert.equal(filtered.resumo.concluidas, expectedSchool.rows[0].n)
    }
    await assert.rejects(carregarGraficosAplicador({ faseId: 2147483647 }), e => e.status === 400)
    console.log(`Snapshot verificado: ${d.resumo.concluidas} aplicações concluídas; ${d.leitura.reduce((s,r)=>s+r.n,0)} marcações de leitura.`)
  } finally { poolModule.getPgPool = saved; await pool.end() }
})
