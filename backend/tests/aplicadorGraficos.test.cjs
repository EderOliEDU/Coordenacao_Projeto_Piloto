const { test } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const jwt = require('jsonwebtoken')
const pool = require('../dist/services/pgPool')
const permissions = require('../dist/services/permissions')
const sessions = require('../dist/services/sessions')
const service = require('../dist/services/aplicadorGraficos')
const report = require('../dist/services/relatorioTerceiraAvaliacao')

test('API exige autenticação e administrador e valida filtros antes da consulta', async () => {
  process.env.JWT_SECRET = 'graficos-test-only'
  const saved = { pool: pool.getPgPool, profile: permissions.usuarioTemPerfil, admin: permissions.isAdministrador,
    active: sessions.sessionIsActive, load: service.carregarGraficosAplicador, report: report.carregarRelatorioTerceiraAvaliacao }
  let loads = 0
  pool.getPgPool = () => ({})
  permissions.usuarioTemPerfil = async () => false
  permissions.isAdministrador = () => false
  sessions.sessionIsActive = async () => true
  service.carregarGraficosAplicador = async filters => { loads++; return { filtros: filters } }
  report.carregarRelatorioTerceiraAvaliacao = async (escolaId, turmaId) => ({ escolaId, turmaId, protocolo: 'V1' })
  const app = express(); app.use('/api/superadmin', require('../dist/routes/superadmin').default)
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  const get = (query = '', perms) => fetch(`http://127.0.0.1:${server.address().port}/api/superadmin/aplicador/graficos${query}`, {
    headers: perms ? { Authorization: `Bearer ${jwt.sign({ cpf: '00000000000', sid: 'test', permissoes: perms }, process.env.JWT_SECRET)}` } : {} })
  try {
    assert.equal((await get()).status, 401)
    for (const perms of [{ aplicador: true }, { resultados: true }, { coordenador: true }]) assert.equal((await get('', perms)).status, 403)
    assert.equal(loads, 0)
    for (const query of ['?faseId=0', '?faseId=3x', '?faseId=1&faseId=2', '?escolaId=-2', '?versao=3', '?faseId=2147483648']) {
      assert.equal((await get(query, { administrador: true })).status, 400)
    }
    assert.equal(loads, 0)
    const res = await get('?faseId=3&escolaId=7&versao=1', { administrador: true })
    assert.equal(res.status, 200); assert.equal(res.headers.get('cache-control'), 'no-store')
    assert.deepEqual((await res.json()).filtros, { faseId: 3, escolaId: 7, versao: 1 })
    const url = `http://127.0.0.1:${server.address().port}/api/superadmin/aplicador/relatorio-terceira`
    assert.equal((await fetch(url)).status, 401)
    const headers = { Authorization: `Bearer ${jwt.sign({ cpf: '00000000000', sid: 'test', permissoes: { aplicador: true } }, process.env.JWT_SECRET)}` }
    assert.equal((await fetch(url, { headers })).status, 403)
    headers.Authorization = `Bearer ${jwt.sign({ cpf: '00000000000', sid: 'test', permissoes: { administrador: true } }, process.env.JWT_SECRET)}`
    for (const q of ['?faseId=1', '?versao=1', '?escolaId=0', '?escolaId=1&escolaId=2', '?turmaId=1', '?escolaId=7&turmaId=-1']) assert.equal((await fetch(url + q, { headers })).status, 400)
    const rr = await fetch(url + '?escolaId=7&turmaId=8', { headers })
    assert.equal(rr.status, 200); const result = await rr.json(); assert.equal(result.escolaId, 7); assert.equal(result.turmaId, 8)

  } finally {
    await new Promise(resolve => server.close(resolve))
    pool.getPgPool = saved.pool; permissions.usuarioTemPerfil = saved.profile; permissions.isAdministrador = saved.admin
    sessions.sessionIsActive = saved.active; service.carregarGraficosAplicador = saved.load
    report.carregarRelatorioTerceiraAvaliacao = saved.report
  }
})

test('Snapshot mantém leitura consistente e filtros; erro e período inválido liberam conexão', async () => {
  const saved = pool.getPgPool; const calls = []; let released = false
  pool.getPgPool = () => ({ connect: async () => ({
    query: async (sql, params) => {
      calls.push({ sql, params })
      if (sql.includes('SELECT f.id_fase')) return { rows: [{ id: 3, nome: 'Período', temAplicacoes: true }] }
      if (sql.includes('SELECT DISTINCT e.id_escola')) return { rows: [] }
      if (sql.includes('FROM base')) throw new Error('falha controlada')
      return { rows: [] }
    }, release: () => { released = true }
  }) })
  try {
    await assert.rejects(service.carregarGraficosAplicador({ faseId: 3, escolaId: 7, versao: 2 }), /falha controlada/)
    assert.equal(calls[0].sql, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    assert.deepEqual(calls.find(c => c.sql.includes('FROM base')).params, [3, 7, 2, null])
    assert.equal(calls.at(-1).sql, 'ROLLBACK'); assert.ok(released)
    calls.length = 0
    await assert.rejects(service.carregarGraficosAplicador({ faseId: 99 }), e => e.status === 400)
    assert.ok(!calls.some(c => c.sql.includes('FROM base')))
  } finally { pool.getPgPool = saved }
})
