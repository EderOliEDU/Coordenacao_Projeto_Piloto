const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {Client}=require('pg'),dotenv=require('dotenv'),express=require('express'),jwt=require('jsonwebtoken');
test('Prazo do formulário: bloqueio de escrita e preservação dos dados (DEV com rollback)',async t=>{
 const env=dotenv.parse(fs.readFileSync(__dirname+'/../.env_dev'));assert.equal(env.PILOTO_PG_HOST,'172.17.2.42');assert.equal(env.PILOTO_PG_DB,'dbsemecel');
 const db=new Client({host:env.PILOTO_PG_HOST,database:env.PILOTO_PG_DB,user:env.PILOTO_PG_USER,password:env.PILOTO_PG_PASSWORD});await db.connect();
 const pool=require('../dist/services/pgPool'),original=pool.getPgPool;let server;
 try{
  await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='5s'");
  pool.getPgPool=()=>({query:(...args)=>db.query(...args),connect:async()=>({query:(sql,values)=>db.query(sql==='BEGIN'?'SAVEPOINT prazo_http':sql==='COMMIT'?'RELEASE SAVEPOINT prazo_http':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT prazo_http':sql,values),release(){}})});
  // Inicializa o legado apenas dentro da transação de teste, antes de simular fases fechadas.
  await require('../dist/services/avaliacaoFases').ensureAvaliacaoFasesStructure();
  const base=(await db.query(`SELECT ap.cpf_professor AS cpf,t.id_turma,ea.id_aluno
   FROM public.atribuicao_professor ap JOIN public.turmas t USING(id_turma) JOIN public.escolas e USING(id_escola)
   JOIN public.etapas et ON et.id_etapa=t.id_etapa JOIN public.enturmacao_aluno ea USING(id_turma)
   WHERE e.projeto='PJINSTFONI' AND et.projeto='PJINSTFONI' LIMIT 1`)).rows[0];assert.ok(base);
  await db.query('UPDATE public.avaliacao_fases SET ativo=false');
  const fase=(await db.query(`INSERT INTO public.avaliacao_fases(nome,data_inicio,data_fim,ativo,ordem)
   VALUES('TESTE prazo rollback',(statement_timestamp() AT TIME ZONE 'America/Cuiaba')::date,(statement_timestamp() AT TIME ZONE 'America/Cuiaba')::date,false,99) RETURNING id_fase`)).rows[0].id_fase;
  const sid=crypto.randomUUID();await require('../dist/services/sessions').registerSession(sid,base.cpf,new Date(Date.now()+3600000));process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
  const bearer=jwt.sign({cpf:base.cpf,sid,permissoes:{}},process.env.JWT_SECRET,{expiresIn:'1h'});
  const app=express();app.use(express.json());app.use('/api/submissoes',require('../dist/routes/submissoes').default);app.use('/api/formularios',require('../dist/routes/formularios').default);
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});const root=`http://127.0.0.1:${server.address().port}`;
  const payload={formularioId:'PG_V1',faseId:fase,turmaId:String(base.id_turma),alunoId:String(base.id_aluno),observacoes:'TESTE rollback',respostas:[]};
  const req=async(method,path,body)=>{const r=await fetch(root+path,{method,headers:{Authorization:`Bearer ${bearer}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()}};
  const salvar=(body={})=>req('POST','/api/submissoes/respostas',{...payload,...body});
  const snapshot=async()=> (await db.query(`SELECT json_build_object(
   'submissoes',(SELECT count(*) FROM public.submissoes_pg WHERE id_fase=$1),
   'respostas',(SELECT count(*) FROM public.avaliacao_respostas WHERE id_fase=$1),
   'necessidades',(SELECT count(*) FROM public.aluno_necessidades_contexto WHERE id_fase=$1)) AS dados`,[fase])).rows[0].dados;
  await t.test('sem fase ativa, rascunho e finalização são recusados sem qualquer gravação',async()=>{
   const antes=await snapshot();assert.equal((await req('GET','/api/formularios/periodo')).body.aberto,false);
   for(const status of ['RASCUNHO','FINALIZADO'])assert.equal((await salvar({status})).status,423);
   assert.deepEqual(await snapshot(),antes);
  });
  await t.test('fase futura e fase encerrada não liberam o formulário',async()=>{
   await db.query(`UPDATE public.avaliacao_fases SET ativo=true,data_inicio=(statement_timestamp() AT TIME ZONE 'America/Cuiaba')::date+1,data_fim=(statement_timestamp() AT TIME ZONE 'America/Cuiaba')::date+2 WHERE id_fase=$1`,[fase]);assert.equal((await salvar()).status,423);
   await db.query(`UPDATE public.avaliacao_fases SET data_inicio=(statement_timestamp() AT TIME ZONE 'America/Cuiaba')::date-2,data_fim=(statement_timestamp() AT TIME ZONE 'America/Cuiaba')::date-1 WHERE id_fase=$1`,[fase]);assert.equal((await salvar()).status,423);
  });
  await t.test('início e fim inclusivos liberam somente a fase correta, identificada no envio',async()=>{
   await db.query(`UPDATE public.avaliacao_fases SET data_inicio=(statement_timestamp() AT TIME ZONE 'America/Cuiaba')::date,data_fim=(statement_timestamp() AT TIME ZONE 'America/Cuiaba')::date WHERE id_fase=$1`,[fase]);
   const periodo=(await req('GET','/api/formularios/periodo')).body;assert.equal(periodo.aberto,true);assert.equal(periodo.fase.id,fase);
   const form=await req('GET','/api/formularios/ativo');assert.equal(form.status,200);assert.equal(form.body.periodoPreenchimento.aberto,true);
   assert.equal((await salvar({faseId:fase+1})).status,409);assert.equal((await salvar({faseId:undefined})).status,400);
   assert.equal((await salvar({status:'RASCUNHO'})).status,200);assert.equal((await salvar({status:'FINALIZADO'})).status,200);
  });
  await t.test('fechar a fase bloqueia alterações de um formulário já aberto e preserva a consulta',async()=>{
   await db.query('UPDATE public.avaliacao_fases SET ativo=false WHERE id_fase=$1',[fase]);
   const antes=(await db.query('SELECT status,observacoes FROM public.submissoes_pg WHERE id_fase=$1',[fase])).rows;
   assert.equal((await salvar({observacoes:'NAO DEVE GRAVAR'})).status,423);
   assert.deepEqual((await db.query('SELECT status,observacoes FROM public.submissoes_pg WHERE id_fase=$1',[fase])).rows,antes);
   const consulta=await req('GET',`/api/submissoes?turmaId=${base.id_turma}&alunoId=${base.id_aluno}&faseId=${fase}`);assert.equal(consulta.status,200);assert.ok(consulta.body.length);
  });
  await t.test('falha nas necessidades desfaz a submissão inteira, inclusive metadados',async()=>{
   await db.query(`UPDATE public.avaliacao_fases SET ativo=true,data_inicio=(statement_timestamp() AT TIME ZONE 'America/Cuiaba')::date,data_fim=(statement_timestamp() AT TIME ZONE 'America/Cuiaba')::date WHERE id_fase=$1`,[fase]);
   const antes=await snapshot(),obs=(await db.query('SELECT observacoes FROM public.submissoes_pg WHERE id_fase=$1',[fase])).rows;
   assert.equal((await salvar({observacoes:'NAO GRAVAR',necessidadesEspecificas:{paee:true,tipo:'PAEE',selecionadas:['id-invalido']}})).status,500);
   assert.deepEqual(await snapshot(),antes);assert.deepEqual((await db.query('SELECT observacoes FROM public.submissoes_pg WHERE id_fase=$1',[fase])).rows,obs);
  });
  await t.test('dia de Cuiabá muda às 04:00 UTC, sem depender do timezone da conexão',async()=>{
   await db.query("UPDATE public.avaliacao_fases SET ativo=true,data_inicio=DATE '2026-11-03',data_fim=DATE '2026-11-03' WHERE id_fase=$1",[fase]);
   const consultar=require('../dist/services/periodoFormulario').consultarPeriodoFormulario;
   for(const [instante,aberto] of [['2026-11-04 03:59:59+00',true],['2026-11-04 04:00:00+00',false]]){
    const r=await consultar({query:(sql,values)=>db.query(sql.replaceAll('statement_timestamp()',`TIMESTAMPTZ '${instante}'`),values)});assert.equal(r.aberto,aberto);
   }
  });
  await t.test('requisição atravessando o encerramento é revertida antes do commit',async()=>{
   const salvo=pool.getPgPool;let consultas=0;
   pool.getPgPool=()=>({...salvo(),connect:async()=>{
    const client=await salvo().connect();return {...client,query:(sql,values)=>{
     if(sql.includes('statement_timestamp()')&&sql.includes('FROM public.avaliacao_fases')){
      consultas++;sql=sql.replaceAll('statement_timestamp()',`TIMESTAMPTZ '${consultas===1?'2026-11-04 03:59:59+00':'2026-11-04 04:00:00+00'}'`)
     }
     return client.query(sql,values)
    }}
   }})
   const antes=(await db.query('SELECT observacoes FROM public.submissoes_pg WHERE id_fase=$1',[fase])).rows;
   try{assert.equal((await salvar({observacoes:'NAO GRAVAR APOS PRAZO'})).status,423);assert.equal(consultas,2)}finally{pool.getPgPool=salvo}
   assert.deepEqual((await db.query('SELECT observacoes FROM public.submissoes_pg WHERE id_fase=$1',[fase])).rows,antes);
  });
 }finally{if(server)await new Promise(resolve=>server.close(resolve));pool.getPgPool=original;await db.query('ROLLBACK');await db.end()}
});
