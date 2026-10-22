// PostgreSQL real do DEV; migração e fixtures revertidas na transação externa.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { Client } = require('pg')
const express = require('express')
const jwt = require('jsonwebtoken')
const dotenv = require('dotenv')

test('Questão 2: migração, autorização, persistência e conclusão', async t => {
  const env = dotenv.parse(fs.readFileSync(__dirname + '/../.env_dev'))
  assert.equal(env.PILOTO_PG_HOST, '172.17.2.42')
  assert.equal(env.PILOTO_PG_DB, 'dbsemecel')
  const db = new Client({ host: env.PILOTO_PG_HOST, database: env.PILOTO_PG_DB,
    user: env.PILOTO_PG_USER, password: env.PILOTO_PG_PASSWORD })
  await db.connect()
  const pool = require('../dist/services/pgPool')
  const originalPool = pool.getPgPool
  let server
  try {
    await db.query('BEGIN')
    await db.query("SET LOCAL lock_timeout='5s'")
    const migration = fs.readFileSync(__dirname + '/../../docs/migracoes-prod/2026-10-16-questao2-vogais.sql', 'utf8')
      .replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '')
    const snapshot = async () => (await db.query(`SELECT json_agg(a ORDER BY id_aplicacao) AS dados
      FROM (SELECT id_aplicacao,status,concluido_em FROM public.avaliacao_aplicador_aplicacoes) a`)).rows[0].dados
    const before = await snapshot()
    await db.query(migration)
    await db.query(fs.readFileSync(__dirname + '/../../docs/migracoes-prod/2026-10-22-questoes7-8.sql','utf8').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,''))
    await t.test('migra somente a vogal escolhida e preserva a conclusão e o registro original', async () => {
      assert.deepEqual(await snapshot(), before)
      const invalid = await db.query(`SELECT r.id_resposta FROM public.avaliacao_aplicador_respostas r
        JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
        JOIN public.avaliacao_aplicador_opcoes o USING(id_opcao)
        LEFT JOIN public.avaliacao_aplicador_vogais v ON v.id_aplicacao=r.id_aplicacao
          AND v.id_pergunta=r.id_pergunta AND v.vogal=upper(trim(r.letra_aplicada))
        WHERE p.codigo='ALITERACAO' AND (v.acertou IS DISTINCT FROM (o.codigo='SIM') OR v.origem<>'LEGADO')`)
      assert.equal(invalid.rowCount, 0)
      const siblings = await db.query(`SELECT v.* FROM public.avaliacao_aplicador_vogais v
        JOIN public.avaliacao_aplicador_respostas r USING(id_aplicacao,id_pergunta)
        JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
        WHERE p.codigo='ALITERACAO' AND v.vogal<>upper(trim(r.letra_aplicada)) AND v.acertou IS NOT NULL`)
      assert.equal(siblings.rowCount, 0)
    })
    pool.getPgPool = () => ({ query: (...args) => db.query(...args), connect: async () => ({
      query: (sql, values) => db.query(sql === 'BEGIN' ? 'SAVEPOINT vogal_http'
        : sql === 'COMMIT' ? 'RELEASE SAVEPOINT vogal_http'
        : sql === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT vogal_http' : sql, values), release() {}
    }) })
    process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex')
    const app = express(); app.use(express.json())
    app.use('/api/aplicador', require('../dist/routes/aplicador').default)
    app.use('/api/superadmin', require('../dist/routes/superadmin').default)
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
    const base = (await db.query(`SELECT a.id_aluno,a.id_turma,a.cpf_aplicador AS cpf
      FROM public.avaliacao_aplicador_aplicacoes a JOIN public.usuarios_acessos u
      ON u.cpf_usuario=a.cpf_aplicador AND u.perfil='APLICADOR' AND u.ativo=true LIMIT 1`)).rows[0]
    assert.ok(base)
    const sid = crypto.randomUUID()
    await require('../dist/services/sessions').registerSession(sid, base.cpf, new Date(Date.now()+3600000))
    const token = jwt.sign({ cpf: base.cpf, sid, permissoes: { aplicador: true, superadmin: true } }, process.env.JWT_SECRET, { expiresIn: '1h' })
    const request = async (suffix, body, bearer = token, method = 'PUT') => {
      const r = await fetch(`http://127.0.0.1:${server.address().port}${suffix}`, {
        method, headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
      return { status: r.status, body: await r.json() }
    }
    const fixture = async (versao = 2) => {
      const fase = (await db.query(`INSERT INTO public.avaliacao_fases(nome,data_inicio,data_fim,ativo,ordem)
        VALUES ('TESTE vogais rollback',CURRENT_DATE,CURRENT_DATE+1,true,1) RETURNING id_fase`)).rows[0].id_fase
      const values = [fase,base.id_turma,base.id_aluno,base.cpf]
      if (versao === 1) values.push(1)
      const row = (await db.query(`INSERT INTO public.avaliacao_aplicador_aplicacoes
        (id_fase,id_turma,id_aluno,cpf_aplicador,status${versao === 1 ? ',versao_instrumento' : ''})
        VALUES ($1,$2,$3,$4,'PENDENTE'${versao === 1 ? ',$5' : ''}) RETURNING id_aplicacao,versao_instrumento`, values)).rows[0]
      assert.equal(row.versao_instrumento, versao)
      return row.id_aplicacao
    }
    const save = (id, vogal, acertou, bearer) => request(`/api/aplicador/aplicacoes/${id}/vogais/${vogal}`, { acertou }, bearer)
    const finish = id => request(`/api/aplicador/aplicacoes/${id}/finalizar`, undefined, token, 'POST')
    const rest = async id => {
      await db.query(`INSERT INTO public.avaliacao_aplicador_respostas(id_aplicacao,id_pergunta,id_opcao,letra_aplicada)
        SELECT $1,p.id_pergunta,(SELECT o.id_opcao FROM public.avaliacao_aplicador_opcoes o WHERE o.id_pergunta=p.id_pergunta AND o.ativo ORDER BY CASE WHEN p.ordem=7 AND o.codigo='NAO_ESCREVE' THEN 0 ELSE 1 END,o.ordem LIMIT 1),
          CASE WHEN p.ordem=5 THEN 'B' END FROM public.avaliacao_aplicador_perguntas p WHERE p.ativo AND p.ordem NOT IN (2,8)`, [id])
      await db.query(`INSERT INTO public.avaliacao_aplicador_leitura_respostas(id_aplicacao,id_palavra,classificacao)
        SELECT $1,id_palavra,'NAO_RESPONDEU' FROM public.avaliacao_aplicador_leitura_palavras WHERE ativo`, [id])
    }
    await t.test('Q7 exige detalhamento válido, grava e recupera sem alterar o tipo de apoio', async () => {
      const id = await fixture()
      const options = (await db.query(`SELECT o.id_pergunta,o.id_opcao,o.codigo FROM public.avaliacao_aplicador_opcoes o
        JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta) WHERE p.ordem=7 AND o.ativo`)).rows
      const answer = async (codigo,nomeEscrito) => {
        const o=options.find(o=>o.codigo===codigo)
        return request(`/api/aplicador/aplicacoes/${id}/respostas`,{respostas:[{idPergunta:o.id_pergunta,idOpcao:o.id_opcao,nomeEscrito}]})
      }
      for (const [codigo,nome] of [['COM_APOIO','NOME'],['COM_APOIO','NOME_COMPOSTO'],['COM_APOIO','NOME_COMPLETO'],['SEM_APOIO','NOME'],['SEM_APOIO','NOME_COMPOSTO'],['SEM_APOIO','NOME_COMPLETO'],['NAO_ESCREVE',null]]) {
        assert.equal((await answer(codigo,nome)).status,200)
        const r=await request(`/api/aplicador/aplicacoes/${id}/questionario`,undefined,token,'GET')
        assert.equal(r.body.exigeDetalheNome,true)
        const q=r.body.perguntas.find(p=>p.ordem===7)
        assert.equal(q.nomeEscrito,nome)
        assert.equal(q.respostaIdOpcao,String(options.find(o=>o.codigo===codigo).id_opcao))
      }
      for (const [codigo,nome] of [['COM_APOIO',null],['SEM_APOIO',null],['COM_APOIO',['NOME']],['COM_APOIO','INVALIDO'],['NAO_ESCREVE','NOME']]) {
        assert.equal((await answer(codigo,nome)).status,400)
      }
      assert.equal((await db.query('SELECT nome_escrito FROM public.avaliacao_aplicador_respostas WHERE id_aplicacao=$1',[id])).rows[0].nome_escrito,null)
    })
    await t.test('Q8 oferece NÃO ESCREVEU e salva essa opção', async () => {
      const id=await fixture()
      const r=await request(`/api/aplicador/aplicacoes/${id}/questionario`,undefined,token,'GET')
      const q=r.body.perguntas.find(p=>p.ordem===8)
      const o=q.opcoes.find(o=>o.codigo==='NAO_ESCREVEU')
      assert.equal(o.descricao,'NÃO ESCREVEU')
      assert.equal((await request(`/api/aplicador/aplicacoes/${id}/respostas`,{respostas:[{idPergunta:q.idPergunta,idOpcao:o.idOpcao}]})).status,200)
    })
    await t.test('nova aplicação não finaliza Q7 sem detalhe; aplicação histórica mantém a regra anterior', async () => {
      const id=await fixture()
      await rest(id)
      for(const v of ['A','E','I','O','U']) await save(id,v,true)
      await db.query(`UPDATE public.avaliacao_aplicador_respostas SET id_opcao=(SELECT id_opcao FROM public.avaliacao_aplicador_opcoes o JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta) WHERE p.ordem=7 AND o.codigo='COM_APOIO') WHERE id_aplicacao=$1 AND id_pergunta=(SELECT id_pergunta FROM public.avaliacao_aplicador_perguntas WHERE ordem=7)`,[id])
      const missing=await finish(id);assert.equal(missing.status,409);assert.match(missing.body.error,/Questão 7/)
      await db.query('UPDATE public.avaliacao_aplicador_aplicacoes SET exige_detalhe_nome=false WHERE id_aplicacao=$1',[id])
      assert.equal((await finish(id)).status,200)
    })
    await t.test('Q5 grava a consoante junto com a opção SIM/NÃO e recupera o mesmo par', async () => {
      const id = await fixture()
      const options = (await db.query(`SELECT o.id_pergunta,o.id_opcao,o.codigo
        FROM public.avaliacao_aplicador_opcoes o JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
        WHERE p.ordem=5 AND o.ativo`)).rows
      for (const [codigo, letra] of [['SIM','B'],['NAO','Z']]) {
        const option = options.find(o=>o.codigo===codigo)
        assert.ok(option)
        const saved = await request(`/api/aplicador/aplicacoes/${id}/respostas`, {
          respostas: [{ idPergunta: option.id_pergunta, idOpcao: option.id_opcao, letraAplicada: letra }]
        })
        assert.equal(saved.status,200)
        const result = await request(`/api/aplicador/aplicacoes/${id}/questionario`,undefined,token,'GET')
        const q5 = result.body.perguntas.find(p=>p.ordem===5)
        assert.equal(q5.letraAplicada,letra)
        assert.equal(q5.respostaIdOpcao,String(option.id_opcao))
      }
      assert.equal((await db.query(`SELECT count(*)::int AS total FROM public.avaliacao_aplicador_respostas r
        JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta) WHERE r.id_aplicacao=$1 AND p.ordem=5`,[id])).rows[0].total,1)
    })
    await t.test('sem vogais respondidas não há desempenho; cliente antigo não grava a Q2 genérica', async () => {
      const id = await fixture()
      const result = await request(`/api/aplicador/aplicacoes/${id}/questionario`,undefined,token,'GET')
      assert.deepEqual(result.body.resumoVogais,{avaliadas:0,acertos:0,erros:0,cobertura:0,desempenho:null})
      const option = (await db.query(`SELECT o.id_pergunta,o.id_opcao FROM public.avaliacao_aplicador_opcoes o
        JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta) WHERE p.codigo='ALITERACAO' AND o.ativo LIMIT 1`)).rows[0]
      const r = await request(`/api/aplicador/aplicacoes/${id}/respostas`, { respostas: [{ idPergunta: option.id_pergunta, idOpcao: option.id_opcao, letraAplicada: 'A' }] })
      assert.equal(r.status,409)
      assert.equal((await db.query('SELECT status FROM public.avaliacao_aplicador_aplicacoes WHERE id_aplicacao=$1',[id])).rows[0].status,'PENDENTE')
    })
    await t.test('NULL não é erro: 1 SIM, 1 NÃO, 3 NULL = 50% de desempenho, 40% de cobertura', async () => {
      const id = await fixture()
      assert.equal((await save(id,'A',true)).status,200)
      assert.equal((await save(id,'E',false)).status,200)
      const result = await request(`/api/aplicador/aplicacoes/${id}/questionario`,undefined,token,'GET')
      assert.equal(result.status,200)
      assert.equal(result.body.versaoInstrumento,2)
      assert.equal(result.body.vogais.filter(v=>v.acertou===null).length,3)
      assert.deepEqual(result.body.resumoVogais,{avaliadas:2,acertos:1,erros:1,cobertura:0.4,desempenho:0.5})
      const sql = (await db.query('SELECT desempenho,cobertura FROM public.avaliacao_aplicador_vogais_resumo WHERE id_aplicacao=$1',[id])).rows[0]
      assert.equal(Number(sql.desempenho),0.5); assert.equal(Number(sql.cobertura),0.4)
      assert.equal((await db.query('SELECT * FROM public.avaliacao_aplicador_respostas WHERE id_aplicacao=$1',[id])).rowCount,0)
      assert.equal((await request(`/api/superadmin/aplicador/aplicacoes/${id}/liberar-reserva`,undefined,token,'POST')).status,409)
      await db.query(migration)
      assert.equal((await db.query('SELECT origem FROM public.avaliacao_aplicador_vogais WHERE id_aplicacao=$1 AND vogal=\'A\'',[id])).rows[0].origem,'NOVO')
    })
    await t.test('aplicação nova exige cinco; avaliação antiga pode finalizar com uma', async () => {
      const id = await fixture()
      await rest(id); await save(id,'A',false)
      assert.equal((await finish(id)).status,409)
      for (const v of ['E','I','O','U']) assert.equal((await save(id,v,true)).status,200)
      assert.equal((await finish(id)).status,200)
      assert.equal((await save(id,'A',true)).status,409)
      const legacy = await fixture(1)
      await rest(legacy); await save(legacy,'O',true)
      assert.equal((await finish(legacy)).status,200)
    })
    await t.test('autorização e validação: rejeita sem sessão, outro dono, vogal e valor inválidos', async () => {
      const id = await fixture()
      assert.equal((await save(id,'A',true,null)).status,401)
      assert.equal((await save(id,'B',true)).status,400)
      assert.equal((await save(id,'A','SIM')).status,400)
      const outro = (await db.query("SELECT profissional_cpf::text AS cpf FROM public.professores WHERE profissional_cpf::text ~ '^[0-9]{11}$' AND profissional_cpf::text<>$1 LIMIT 1",[base.cpf])).rows[0].cpf
      await db.query('UPDATE public.avaliacao_aplicador_aplicacoes SET cpf_aplicador=$2 WHERE id_aplicacao=$1',[id,outro])
      assert.equal((await save(id,'A',true)).status,404)
    })
    await t.test('resposta exige SIM ou NÃO; NULL não apaga a resposta existente', async () => {
      const id = await fixture()
      await save(id,'A',false)
      assert.equal((await save(id,'A',null)).status,400)
      const r = (await db.query('SELECT acertou,origem,respondido_em FROM public.avaliacao_aplicador_vogais WHERE id_aplicacao=$1',[id])).rows[0]
      assert.equal(r.acertou,false)
      assert.equal(r.origem,'NOVO')
      assert.ok(r.respondido_em)
      assert.equal((await request(`/api/superadmin/aplicador/aplicacoes/${id}/liberar-reserva`,undefined,token,'POST')).status,409)
    })
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve))
    pool.getPgPool=originalPool
    await db.query('ROLLBACK'); await db.end()
  }
})
