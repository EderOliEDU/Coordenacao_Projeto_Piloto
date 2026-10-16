// Executar após npm run build: node --test tests/liberarReserva.integration.cjs
// Os dados de teste ficam em uma única transação, revertida ao final.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const express = require('express')
const jwt = require('jsonwebtoken')
const { Client } = require('pg')
const dotenv = require('dotenv')

test('liberação de reservas: autorização, preservação de registros e atualização da visão', async t => {
  const env = dotenv.parse(fs.readFileSync(path.join(__dirname, '../.env_dev')))
  assert.equal(env.PILOTO_PG_HOST, '172.17.2.42', 'Teste exclusivo do banco DEV')
  const client = new Client({
    host: env.PILOTO_PG_HOST, port: Number(env.PILOTO_PG_PORT) || 5432,
    database: env.PILOTO_PG_DB, user: env.PILOTO_PG_USER,
    password: env.PILOTO_PG_PASSWORD, connectionTimeoutMillis: 5000
  })
  await client.connect()
  let server
  let originalPool
  const poolModule = require('../dist/services/pgPool')
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL lock_timeout = '5s'")
    const base = (await client.query(`
      SELECT ea.id_aluno, t.id_turma, p.profissional_cpf::text AS cpf
      FROM public.enturmacao_aluno ea
      JOIN public.turmas t USING (id_turma)
      JOIN public.escolas e USING (id_escola)
      JOIN public.etapas et ON et.id_etapa = t.id_etapa
      CROSS JOIN LATERAL (SELECT profissional_cpf FROM public.professores
        WHERE profissional_cpf::text ~ '^[0-9]{11}$' LIMIT 1) p
      WHERE e.projeto = 'PJINSTFONI' AND et.projeto = 'PJINSTFONI' LIMIT 1
    `)).rows[0]
    assert.ok(base, 'O DEV precisa de uma turma do projeto com aluno para os testes')
    const opcao = (await client.query('SELECT id_pergunta, id_opcao FROM public.avaliacao_aplicador_opcoes LIMIT 1')).rows[0]
    const palavra = (await client.query('SELECT id_palavra FROM public.avaliacao_aplicador_leitura_palavras LIMIT 1')).rows[0]
    assert.ok(opcao && palavra, 'O DEV precisa do questionário e das palavras cadastrados')

    // A API usa savepoints dentro da transação externa para que seus commits
    // não persistam os dados de teste. As consultas continuam sendo PostgreSQL real.
    originalPool = poolModule.getPgPool
    poolModule.getPgPool = () => ({
      query: (...args) => client.query(...args),
      connect: async () => ({
        query: (sql, values) => {
          if (sql === 'BEGIN') return client.query('SAVEPOINT reserva_http')
          if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT reserva_http')
          if (sql === 'ROLLBACK') return client.query('ROLLBACK TO SAVEPOINT reserva_http')
          return client.query(sql, values)
        },
        release() {}
      })
    })
    process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex')
    const app = express()
    app.use(express.json())
    app.use('/api/superadmin', require('../dist/routes/superadmin').default)
    app.use('/api/auth', require('../dist/routes/auth').default)
    server = await new Promise(resolve => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
    })
    const url = `http://127.0.0.1:${server.address().port}/api/superadmin`
    const { registerSession } = require('../dist/services/sessions')
    const sessionId = crypto.randomUUID()
    await registerSession(sessionId, '00000000000', new Date(Date.now()+3600000))
    const token = (permissoes, sid = sessionId) => jwt.sign({ cpf: '00000000000', permissoes, sid }, process.env.JWT_SECRET, { expiresIn: '1h' })
    const superToken = token({ superadmin: true, administrador: true })
    const request = async (id, bearer = superToken) => {
      const response = await fetch(`${url}/aplicador/aplicacoes/${id}/liberar-reserva`, {
        method: 'POST', headers: bearer ? { Authorization: `Bearer ${bearer}` } : {}
      })
      return { status: response.status, body: await response.json() }
    }
    const fixture = async (status = 'PENDENTE', observacao = null) => {
      const fase = (await client.query(`
        INSERT INTO public.avaliacao_fases (nome, data_inicio, data_fim, ativo, ordem)
        VALUES ('TESTE liberar reserva (rollback)', CURRENT_DATE, CURRENT_DATE + 1, true, 1)
        RETURNING id_fase
      `)).rows[0].id_fase
      await client.query(`INSERT INTO public.avaliacao_aplicador_atribuicoes
        (id_fase,id_turma,cpf_aplicador,ativo) VALUES ($1,$2,$3,true)`, [fase, base.id_turma, base.cpf])
      const id = (await client.query(`INSERT INTO public.avaliacao_aplicador_aplicacoes
        (id_fase,id_turma,id_aluno,cpf_aplicador,status,observacao,iniciado_em,concluido_em)
        VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $5='EM_ANDAMENTO' THEN CURRENT_TIMESTAMP END,
          CASE WHEN $5='CONCLUIDA' THEN CURRENT_TIMESTAMP END) RETURNING id_aplicacao`,
      [fase, base.id_turma, base.id_aluno, base.cpf, status, observacao])).rows[0].id_aplicacao
      return { id, fase }
    }
    const statusOf = async id => (await client.query('SELECT status FROM public.avaliacao_aplicador_aplicacoes WHERE id_aplicacao=$1', [id])).rows[0].status

    await t.test('lista de acessos combina busca, perfil e status e mantém acesso restrito', async () => {
      await client.query(`INSERT INTO public.usuarios_acessos(cpf_usuario,perfil,ativo)
        VALUES ($1,'APLICADOR',true),($1,'ADMINISTRADOR',false) ON CONFLICT DO NOTHING`,[base.cpf])
      await client.query(`UPDATE public.usuarios_acessos SET ativo=(perfil='APLICADOR')
        WHERE cpf_usuario=$1 AND perfil IN ('APLICADOR','ADMINISTRADOR')`,[base.cpf])
      const search = async (params, bearer=superToken) => {
        const response = await fetch(`${url}/acessos?${new URLSearchParams(params)}`, {
          headers: bearer ? { Authorization: `Bearer ${bearer}` } : {}
        })
        return { status: response.status, body: await response.json() }
      }
      assert.equal((await search({},null)).status,401)
      assert.equal((await search({},token({administrador:true}))).status,403)
      assert.equal((await search({perfil:'INVALIDO'})).status,400)
      assert.equal((await search({status:'INVALIDO'})).status,400)
      for (const [perfil,status] of [['APLICADOR','ATIVO'],['ADMINISTRADOR','INATIVO']]) {
        const result = await search({q:base.cpf,perfil,status})
        assert.equal(result.status,200)
        assert.ok(result.body.length>0)
        assert.ok(result.body.every(item=>item.cpf===base.cpf && item.perfil===perfil && item.ativo===(status==='ATIVO')))
      }
      assert.deepEqual((await search({q:base.cpf,perfil:'APLICADOR',status:'INATIVO'})).body,[])
      const pessoa = (await client.query(`SELECT profissional_nome::text AS nome
        FROM public.professores WHERE profissional_cpf::text=$1 LIMIT 1`,[base.cpf])).rows[0]
      assert.ok(pessoa?.nome)
      const nome = await search({q:pessoa.nome.toLowerCase(),perfil:'APLICADOR',status:'ATIVO'})
      assert.equal(nome.status,200)
      assert.ok(nome.body.some(item=>item.cpf===base.cpf))
      assert.ok(nome.body.every(item=>item.perfil==='APLICADOR' && item.ativo))
    })

    await t.test('sem login recebe 401; administrador comum recebe 403', async () => {
      const f = await fixture()
      assert.equal((await request(f.id, null)).status, 401)
      assert.equal((await request(f.id, token({ administrador: true }))).status, 403)
      assert.equal(await statusOf(f.id), 'PENDENTE')
    })
    await t.test('reserva vazia é liberada, a atribuição permanece e a visão mostra o aluno livre', async () => {
      const f = await fixture()
      const before = await fetch(`${url}/aplicador/atribuicoes/visao?idFase=${f.fase}`, { headers: { Authorization: `Bearer ${superToken}` } })
      assert.equal(before.status, 200)
      const alunoBefore = (await before.json()).find(t => t.idTurma === String(base.id_turma)).alunos.find(a => a.idAluno === String(base.id_aluno))
      assert.equal(alunoBefore.podeLiberarReserva, true)
      assert.equal(alunoBefore.idAplicacao, String(f.id))
      assert.equal((await request(f.id)).status, 200)
      assert.equal(await statusOf(f.id), 'CANCELADA')
      assert.equal((await client.query('SELECT ativo FROM public.avaliacao_aplicador_atribuicoes WHERE id_fase=$1', [f.fase])).rows[0].ativo, true)
      const view = await fetch(`${url}/aplicador/atribuicoes/visao?idFase=${f.fase}`, { headers: { Authorization: `Bearer ${superToken}` } })
      const aluno = (await view.json()).find(t => t.idTurma === String(base.id_turma)).alunos.find(a => a.idAluno === String(base.id_aluno))
      assert.equal(aluno.idAplicacao, null)
      assert.equal(aluno.podeLiberarReserva, false)
      assert.equal((await request(f.id)).body.jaLiberada, true)
    })
    await t.test('reserva em andamento sem registros também pode ser liberada', async () => {
      const f = await fixture('EM_ANDAMENTO')
      assert.equal((await request(f.id)).status, 200)
      assert.equal(await statusOf(f.id), 'CANCELADA')
    })
    await t.test('resposta salva depois do carregamento impede a liberação', async () => {
      const f = await fixture()
      await client.query(`INSERT INTO public.avaliacao_aplicador_respostas
        (id_aplicacao,id_pergunta,id_opcao) VALUES ($1,$2,$3)`, [f.id, opcao.id_pergunta, opcao.id_opcao])
      assert.equal((await request(f.id)).status, 409)
      assert.equal(await statusOf(f.id), 'PENDENTE')
      assert.equal((await client.query('SELECT count(*)::int total FROM public.avaliacao_aplicador_respostas WHERE id_aplicacao=$1', [f.id])).rows[0].total, 1)
    })
    for (const audio of [null, 'TESTE-sem-arquivo.webm']) {
      await t.test(`classificação de leitura ${audio ? 'com áudio' : 'sem áudio'} é preservada`, async () => {
        const f = await fixture('EM_ANDAMENTO')
        await client.query(`INSERT INTO public.avaliacao_aplicador_leitura_respostas
          (id_aplicacao,id_palavra,classificacao,audio_arquivo) VALUES ($1,$2,'NAO_RESPONDEU',$3)`, [f.id, palavra.id_palavra, audio])
        assert.equal((await request(f.id)).status, 409)
        assert.equal(await statusOf(f.id), 'EM_ANDAMENTO')
      })
    }
    await t.test('observação e aplicação concluída são preservadas', async () => {
      for (const [status, observacao] of [['PENDENTE', 'Observação de teste'], ['CONCLUIDA', null]]) {
        const f = await fixture(status, observacao)
        assert.equal((await request(f.id)).status, 409)
        assert.equal(await statusOf(f.id), status)
      }
    })
    await t.test('identificador inválido ou inexistente não altera registros', async () => {
      assert.equal((await request('abc')).status, 400)
      assert.equal((await request('9007199254740991')).status, 404)
    })
    await t.test('atribuição global exige superadmin e fase ativa, reativa vínculos e não duplica ou reserva alunos', async () => {
      const f = await fixture()
      const postAll = async (idFase, bearer = superToken) => {
        const response = await fetch(`${url}/aplicador/atribuicoes/todos`, {
          method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ idFase })
        })
        return { status: response.status, body: await response.json() }
      }
      assert.equal((await postAll(f.fase, token({ administrador: true }))).status, 403)
      assert.equal((await postAll('abc')).status, 400)
      await client.query('UPDATE public.avaliacao_fases SET ativo=false WHERE id_fase=$1', [f.fase])
      assert.equal((await postAll(f.fase)).status, 400)
      await client.query('UPDATE public.avaliacao_fases SET ativo=true WHERE id_fase=$1', [f.fase])
      const aplicadores = (await client.query(`SELECT DISTINCT u.cpf_usuario FROM public.usuarios_acessos u
        JOIN public.professores p ON p.profissional_cpf=u.cpf_usuario
        WHERE u.perfil='APLICADOR' AND u.ativo ORDER BY u.cpf_usuario`)).rows
      assert.ok(aplicadores.length > 1)
      const turmaCount = (await client.query(`SELECT count(*)::int total FROM public.turmas t
        JOIN public.escolas e USING(id_escola) JOIN public.etapas et ON et.id_etapa=t.id_etapa
        WHERE e.projeto='PJINSTFONI' AND et.projeto='PJINSTFONI'
          AND EXISTS(SELECT 1 FROM public.enturmacao_aluno ea JOIN public.alunos a USING(id_aluno) WHERE ea.id_turma=t.id_turma)`)).rows[0].total
      await client.query(`INSERT INTO public.avaliacao_aplicador_atribuicoes
        (id_fase,id_turma,cpf_aplicador,ativo) VALUES($1,$2,$3,false)
        ON CONFLICT(id_fase,id_turma,cpf_aplicador) DO UPDATE SET ativo=false`, [f.fase,base.id_turma,aplicadores[0].cpf_usuario])
      await client.query(`INSERT INTO public.avaliacao_aplicador_atribuicoes
        (id_fase,id_turma,cpf_aplicador,ativo,atualizado_em) VALUES($1,$2,$3,true,'2020-01-01T00:00:00Z')
        ON CONFLICT(id_fase,id_turma,cpf_aplicador) DO UPDATE SET ativo=true,atualizado_em='2020-01-01T00:00:00Z'`, [f.fase,base.id_turma,aplicadores[1].cpf_usuario])
      const pendingBefore = (await client.query('SELECT to_jsonb(ap) registro FROM public.avaliacao_aplicador_aplicacoes ap WHERE id_aplicacao=$1', [f.id])).rows[0].registro
      const totalAppsBefore = (await client.query('SELECT count(*)::int total FROM public.avaliacao_aplicador_aplicacoes')).rows[0].total
      const first = await postAll(f.fase)
      assert.equal(first.status,200)
      assert.equal(first.body.turmas,turmaCount)
      assert.equal(first.body.aplicadores,aplicadores.length)
      assert.equal(first.body.total,turmaCount*aplicadores.length)
      assert.ok(first.body.novasOuReativadas>0)
      const actual = (await client.query(`SELECT count(*)::int total FROM public.avaliacao_aplicador_atribuicoes at
        WHERE at.id_fase=$1 AND at.ativo AND at.cpf_aplicador=ANY($2::text[])`, [f.fase,aplicadores.map(a=>a.cpf_usuario)])).rows[0].total
      assert.equal(actual,first.body.total)
      assert.equal((await client.query(`SELECT atualizado_em=TIMESTAMPTZ '2020-01-01T00:00:00Z' preservado
        FROM public.avaliacao_aplicador_atribuicoes
        WHERE id_fase=$1 AND id_turma=$2 AND cpf_aplicador=$3`,[f.fase,base.id_turma,aplicadores[1].cpf_usuario])).rows[0].preservado,true)
      const second = await postAll(f.fase)
      assert.equal(second.status,200)
      assert.equal(second.body.novasOuReativadas,0)
      assert.equal(second.body.jaAtivas,first.body.total)
      assert.deepEqual((await client.query('SELECT to_jsonb(ap) registro FROM public.avaliacao_aplicador_aplicacoes ap WHERE id_aplicacao=$1',[f.id])).rows[0].registro,pendingBefore)
      assert.equal((await client.query('SELECT count(*)::int total FROM public.avaliacao_aplicador_aplicacoes')).rows[0].total,totalAppsBefore)
      assert.equal((await client.query(`SELECT count(*)::int total FROM public.avaliacao_aplicador_atribuicoes at
        JOIN public.turmas t USING(id_turma) JOIN public.escolas e USING(id_escola) JOIN public.etapas et ON et.id_etapa=t.id_etapa
        WHERE at.id_fase=$1 AND (e.projeto IS DISTINCT FROM 'PJINSTFONI' OR et.projeto IS DISTINCT FROM 'PJINSTFONI'
          OR NOT EXISTS(SELECT 1 FROM public.enturmacao_aluno ea WHERE ea.id_turma=t.id_turma))`,[f.fase])).rows[0].total,0)
    })
    await t.test('tokens antigos sem sessão são rejeitados', async () => {
      const legacy = jwt.sign({ cpf:'00000000000',permissoes:{superadmin:true} },process.env.JWT_SECRET)
      assert.equal((await request('abc',legacy)).status,401)
    })
    await t.test('30 minutos sem interação ou 2 minutos sem presença encerram o acesso', async () => {
      for (const column of ['ultima_atividade_em','ultimo_sinal_em']) {
        const sid = crypto.randomUUID()
        await registerSession(sid,'00000000000',new Date(Date.now()+3600000))
        await client.query(`UPDATE public.auth_sessoes SET ${column}=CURRENT_TIMESTAMP-INTERVAL '${column==='ultima_atividade_em'?'31 minutes':'121 seconds'}' WHERE id=$1`,[sid])
        const bearer = token({superadmin:true},sid)
        assert.equal((await request('abc',bearer)).status,401)
        const heartbeat = await fetch(url.replace('/superadmin','/auth/session/heartbeat'),{method:'POST',headers:{Authorization:`Bearer ${bearer}`,'Content-Type':'application/json'},body:JSON.stringify({activity:true})})
        assert.equal(heartbeat.status,401)
      }
    })
    await t.test('presença sem interação não prolonga a atividade; logout revoga o token no servidor', async () => {
      const sid = crypto.randomUUID()
      await registerSession(sid,'00000000000',new Date(Date.now()+3600000))
      const bearer = token({superadmin:true},sid)
      await client.query("UPDATE public.auth_sessoes SET ultima_atividade_em=CURRENT_TIMESTAMP-INTERVAL '10 minutes',ultimo_sinal_em=CURRENT_TIMESTAMP-INTERVAL '1 minute' WHERE id=$1",[sid])
      const headers = {Authorization:`Bearer ${bearer}`,'Content-Type':'application/json'}
      const heartbeatUrl = url.replace('/superadmin','/auth/session/heartbeat')
      const passive = await fetch(heartbeatUrl,{method:'POST',headers,body:JSON.stringify({activity:false})})
      assert.equal(passive.status,200)
      assert.equal((await client.query("SELECT ultima_atividade_em=CURRENT_TIMESTAMP-INTERVAL '10 minutes' preservada FROM public.auth_sessoes WHERE id=$1",[sid])).rows[0].preservada,true)
      assert.equal((await fetch(heartbeatUrl,{method:'POST',headers,body:JSON.stringify({activity:true})})).status,200)
      assert.equal((await client.query('SELECT ultima_atividade_em=CURRENT_TIMESTAMP atualizada FROM public.auth_sessoes WHERE id=$1',[sid])).rows[0].atualizada,true)
      assert.equal((await fetch(url.replace('/superadmin','/auth/logout'),{method:'POST',headers})).status,200)
      assert.equal((await request('abc',bearer)).status,401)
      assert.equal((await fetch(heartbeatUrl,{method:'POST',headers,body:JSON.stringify({activity:true})})).status,401)
    })
    await t.test('login registra o identificador do JWT e devolve a política de 30 minutos', async () => {
      // A autenticação de senha não mudou. Simula somente esse provedor para
      // validar a emissão real do JWT e a persistência da sessão sem trocar senhas.
      const cpfAuth = require('../dist/services/cpfAuth')
      const original = cpfAuth.authenticateByCpf
      const name = (await client.query('SELECT profissional_nome FROM public.professores WHERE profissional_cpf=$1',[base.cpf])).rows[0].profissional_nome
      cpfAuth.authenticateByCpf = async () => ({cpf:base.cpf,nome:name,mustChangePassword:false})
      try {
        const response = await fetch(url.replace('/superadmin','/auth/login'),{
          method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:base.cpf,password:'provedor-simulado'})
        })
        assert.equal(response.status,200)
        const data = await response.json()
        const payload = jwt.verify(data.token,process.env.JWT_SECRET)
        assert.equal(typeof payload.sid,'string')
        assert.equal(data.session.idleTimeoutSeconds,1800)
        assert.equal(data.session.presenceTimeoutSeconds,120)
        assert.equal((await client.query('SELECT cpf_usuario FROM public.auth_sessoes WHERE id=$1',[payload.sid])).rows[0].cpf_usuario,base.cpf)
      } finally { cpfAuth.authenticateByCpf = original }
    })
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    if (originalPool) poolModule.getPgPool = originalPool
    await client.query('ROLLBACK')
    await client.end()
  }
})
