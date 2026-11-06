// PostgreSQL DEV real; todas as escritas são revertidas.
const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),crypto=require('node:crypto')
const {Client}=require('pg'),dotenv=require('dotenv'),express=require('express'),jwt=require('jsonwebtoken')
test('superadmin: confirmação, correção de terceiros e preservação de responsável (DEV)',async t=>{
 const env=dotenv.parse(fs.readFileSync(__dirname+'/../.env_dev'));assert.equal(env.PILOTO_PG_HOST,'172.17.2.42')
 const audioDir=fs.mkdtempSync(require('node:path').join(require('node:os').tmpdir(),'auditoria-audio-'))
 process.env.AUDIO_STORAGE_PATH=audioDir
 const db=new Client({host:env.PILOTO_PG_HOST,database:env.PILOTO_PG_DB,user:env.PILOTO_PG_USER,password:env.PILOTO_PG_PASSWORD,connectionTimeoutMillis:5000})
 await db.connect()
 const pool=require('../dist/services/pgPool'),original=pool.getPgPool;let server
 try {
  await db.query('BEGIN');await db.query(fs.readFileSync(__dirname+'/../../docs/migracoes-prod/2026-11-06-auditoria-atividades.sql','utf8').replace(/^BEGIN(?: ISOLATION LEVEL REPEATABLE READ)?;\s*/,'').replace(/COMMIT;\s*$/,''));await db.query("SET LOCAL lock_timeout='5s'")
  pool.getPgPool=()=>({query:(...args)=>db.query(...args),connect:async()=>({query:(sql,values)=>db.query(sql==='BEGIN'?'SAVEPOINT atividade_http':sql==='COMMIT'?'RELEASE SAVEPOINT atividade_http':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT atividade_http':sql,values),release(){}})})
  await require('../dist/services/avaliacaoFases').ensureAvaliacaoFasesStructure()
  const base=(await db.query(`SELECT ap.cpf_professor AS cpf,t.id_turma,ea.id_aluno FROM public.atribuicao_professor ap
   JOIN public.turmas t USING(id_turma) JOIN public.escolas e USING(id_escola) JOIN public.etapas et ON et.id_etapa=t.id_etapa
   JOIN public.enturmacao_aluno ea USING(id_turma) WHERE e.projeto='PJINSTFONI' AND et.projeto='PJINSTFONI' LIMIT 1`)).rows[0];assert.ok(base)
  const fase=(await db.query(`INSERT INTO public.avaliacao_fases(nome,data_inicio,data_fim,ativo,ordem)
   VALUES('TESTE admin rollback',DATE '2020-01-01',DATE '2020-01-02',false,99) RETURNING id_fase`)).rows[0].id_fase
  const ator=base.cpf==='00000000000'?'00000000001':'00000000000'
  const sid=crypto.randomUUID();await require('../dist/services/sessions').registerSession(sid,ator,new Date(Date.now()+3600000))
  process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex')
  const token=permissoes=>jwt.sign({cpf:ator,sid,permissoes},process.env.JWT_SECRET,{expiresIn:'1h'})
  const admin=token({superadmin:true}),comum=token({administrador:true})
  const app=express();app.use(express.json())
  for(const [url,file] of [['submissoes','submissoes'],['formularios','formularios'],['necessidades-especificas','necessidades'],['superadmin','superadmin'],['aplicador','aplicador']])app.use('/api/'+url,require('../dist/routes/'+file).default)
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
  const root=`http://127.0.0.1:${server.address().port}`
  const headers={'X-Atividade-Cpf':base.cpf,'X-Atividade-Fase':String(fase),'X-Atividade-Confirmada':'sim'}
  const req=async(method,path,body,h=headers,bearer=admin)=>{
   const r=await fetch(root+'/api/'+path,{method,headers:{Authorization:`Bearer ${bearer}`,'Content-Type':'application/json',...h},...(body?{body:JSON.stringify(body)}:{})})
   return {status:r.status,body:await r.json()}
  }
  const payload={formularioId:'PG_V1',faseId:fase,turmaId:String(base.id_turma),alunoId:String(base.id_aluno),respostas:[],observacoes:'Registro original',status:'FINALIZADO'}
  await t.test('administrador não pode usar a exceção; superadmin precisa confirmar',async()=>{
   assert.equal((await req('POST','submissoes/respostas',payload,headers,comum)).status,403)
   assert.equal((await req('POST','submissoes/respostas',payload,{...headers,'X-Atividade-Confirmada':''})).status,409)
   assert.equal((await db.query('SELECT count(*)::int AS n FROM public.submissoes_pg WHERE id_fase=$1',[fase])).rows[0].n,0)
  })
  await t.test('confirmação fica registrada antes de abrir a edição',async()=>{
   const confirmar={tipo:'FORMULARIO',turmaId:base.id_turma,alunoId:base.id_aluno}
   assert.equal((await req('POST','superadmin/atividades/confirmar',confirmar)).status,200)
   const log=(await db.query("SELECT * FROM public.auditoria_atividades WHERE fase_id=$1 AND evento='CONFIRMACAO'",[fase])).rows
   assert.equal(log.length,1);assert.equal(log[0].autor_cpf,ator);assert.equal(log[0].responsavel_cpf,base.cpf)
   assert.equal(log[0].antes,null);assert.deepEqual(log[0].depois,{confirmado:true});assert.ok(log[0].ocorrido_em)
   assert.equal((await req('POST','superadmin/atividades/confirmar',confirmar,headers,comum)).status,403)
  })
  await t.test('fase encerrada permite correção no registro original, sem duplicação',async()=>{
   assert.equal((await req('GET','formularios/periodo')).body.fase.id,fase)
   assert.equal((await req('POST','submissoes/respostas',payload)).status,200)
   assert.equal((await req('POST','submissoes/respostas',{...payload,observacoes:'Corrigido pelo superadmin'})).status,200)
   const rows=(await db.query('SELECT cpf_professor,status,observacoes FROM public.submissoes_pg WHERE id_fase=$1',[fase])).rows
   assert.deepEqual(rows,[{cpf_professor:base.cpf,status:'FINALIZADO',observacoes:'Corrigido pelo superadmin'}])
   const list=await req('GET',`submissoes?turmaId=${base.id_turma}&alunoId=${base.id_aluno}`)
   assert.equal(list.status,200);assert.equal(list.body.length,1)
   assert.equal((await req('GET','submissoes/'+list.body[0].id)).body.observacoes,'Corrigido pelo superadmin')
   assert.equal((await req('GET',`necessidades-especificas/aluno/${base.id_aluno}?turmaId=${base.id_turma}`)).status,200)
  })
  await t.test('catálogo lista formulário e verificação de terceiros',async()=>{
   for(const tipo of ['formulario','verificacao']) {
    const list=await req('GET',`superadmin/atividades?turmaId=${base.id_turma}&faseId=${fase}&tipo=${tipo}`,null,{})
    assert.equal(list.status,200);assert.ok(list.body.some(a=>a.alunoId===String(base.id_aluno)))
   }
  })
  let id
  await t.test('iniciar em nome do designado mantém o autor real da criação',async()=>{
   const result=await req('POST','aplicador/aplicacoes/iniciar',{idFase:fase,idTurma:base.id_turma,idAluno:base.id_aluno})
   assert.equal(result.status,201,JSON.stringify(result.body));id=result.body.aplicacao.idAplicacao
   const row=(await db.query('SELECT cpf_aplicador,criado_por FROM public.avaliacao_aplicador_aplicacoes WHERE id_aplicacao=$1',[id])).rows[0]
   assert.equal(row.cpf_aplicador,base.cpf);assert.equal(row.criado_por,ator)
  })
  await t.test('corrigir verificação concluída preserva situação e responsável',async()=>{
   assert.ok(id)
   await db.query("UPDATE public.avaliacao_aplicador_aplicacoes SET status='CONCLUIDA',concluido_em=CURRENT_TIMESTAMP WHERE id_aplicacao=$1",[id])
   const before=(await db.query('SELECT cpf_aplicador,status,concluido_em FROM public.avaliacao_aplicador_aplicacoes WHERE id_aplicacao=$1',[id])).rows[0]
   assert.equal((await req('GET',`aplicador/aplicacoes/${id}/questionario`)).status,200)
   assert.equal((await req('PUT',`aplicador/aplicacoes/${id}/observacao`,{observacao:'Correção do superadmin'})).status,200)
   assert.equal((await req('PUT',`aplicador/aplicacoes/${id}/vogais/A`,{acertou:true})).status,200)
   const opcao=(await db.query(`SELECT o.id_pergunta,o.id_opcao FROM public.avaliacao_aplicador_opcoes o
    JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta) WHERE o.ativo AND p.ativo AND p.ordem NOT IN(2,5,7) LIMIT 1`)).rows[0]
   assert.ok(opcao)
   assert.equal((await req('PUT',`aplicador/aplicacoes/${id}/respostas`,{respostas:[{idPergunta:opcao.id_pergunta,idOpcao:opcao.id_opcao}]})).status,200)
   const palavra=(await db.query('SELECT id_palavra FROM public.avaliacao_aplicador_leitura_palavras LIMIT 1')).rows[0]
   assert.ok(palavra)
   assert.equal((await req('PUT',`aplicador/aplicacoes/${id}/leitura/${palavra.id_palavra}`,{classificacao:'NAO_RESPONDEU'})).status,200)
   const after=(await db.query('SELECT cpf_aplicador,status,concluido_em FROM public.avaliacao_aplicador_aplicacoes WHERE id_aplicacao=$1',[id])).rows[0]
   assert.deepEqual(after,before)
   assert.equal((await req('GET',`aplicador/aplicacoes/${id}/questionario`,null,{...headers,'X-Atividade-Cpf':ator})).status,404)
  })
  await t.test('histórico identifica autor e conteúdo antes/depois, com consulta restrita',async()=>{
   const logs=(await db.query("SELECT * FROM public.auditoria_atividades WHERE fase_id=$1 AND tipo='FORMULARIO' AND evento='ALTERACAO' ORDER BY id",[fase])).rows
   assert.equal(logs.length,2)
   assert.deepEqual(logs[0].antes.submissoes_pg,[])
   assert.equal(logs[1].antes.submissoes_pg[0].observacoes,'Registro original')
   assert.equal(logs[1].depois.submissoes_pg[0].observacoes,'Corrigido pelo superadmin')
   assert.equal(logs[1].autor_cpf,ator);assert.equal(logs[1].responsavel_cpf,base.cpf)
   const apps=(await db.query("SELECT * FROM public.auditoria_atividades WHERE fase_id=$1 AND tipo='VERIFICACAO' AND evento='ALTERACAO' ORDER BY id",[fase])).rows
   assert.equal(apps.length,5);assert.ok(apps.every(a=>String(a.aplicacao_id)===id))
   const caminho=`superadmin/atividades/auditoria?faseId=${fase}&turmaId=${base.id_turma}`
   assert.equal((await req('GET',caminho,null,{},comum)).status,403)
   const consulta=await req('GET',caminho,null,{})
   assert.equal(consulta.status,200);assert.equal(consulta.body.length,8)
  })
  await t.test('troca de áudio preserva arquivo anterior e audita metadados; falha desfaz upload',async()=>{
   const palavra=(await db.query('SELECT id_palavra FROM public.avaliacao_aplicador_leitura_palavras LIMIT 1')).rows[0].id_palavra
   const caminho=`aplicador/aplicacoes/${id}/leitura/${palavra}/audio`
   const enviar=async(conteudo)=>{
    const r=await fetch(root+'/api/'+caminho,{method:'POST',headers:{Authorization:`Bearer ${admin}`,...headers,'Content-Type':'audio/webm'},body:Buffer.from(conteudo)})
    return {status:r.status,body:await r.json()}
   }
   const primeiro=await enviar('audio original de teste');assert.equal(primeiro.status,200)
   const segundo=await enviar('audio corrigido de teste');assert.equal(segundo.status,200)
   const path1=primeiro.body.audio.audioArquivo,path2=segundo.body.audio.audioArquivo
   assert.notEqual(path1,path2)
   assert.equal(fs.readFileSync(require('node:path').join(audioDir,path1),'utf8'),'audio original de teste')
   assert.equal(fs.readFileSync(require('node:path').join(audioDir,path2),'utf8'),'audio corrigido de teste')
   const log=(await db.query("SELECT antes,depois FROM public.auditoria_atividades WHERE fase_id=$1 AND rota LIKE '%/audio' ORDER BY id DESC LIMIT 1",[fase])).rows[0]
   assert.equal(log.antes.avaliacao_aplicador_leitura_respostas[0].audio_arquivo,path1)
   assert.equal(log.depois.avaliacao_aplicador_leitura_respostas[0].audio_arquivo,path2)
   const anteriorPool=pool.getPgPool
   pool.getPgPool=()=>({...anteriorPool(),connect:async()=>{
    const client=await anteriorPool().connect()
    return {...client,query:(sql,values)=>{
     if(sql.includes('INSERT INTO public.auditoria_atividades')) throw new Error('Falha de auditoria simulada no teste')
     return client.query(sql,values)
    }}
   }})
   try{assert.equal((await enviar('audio que nao deve persistir')).status,500)}finally{pool.getPgPool=anteriorPool}
   assert.equal((await db.query('SELECT audio_arquivo FROM public.avaliacao_aplicador_leitura_respostas WHERE id_aplicacao=$1 AND id_palavra=$2',[id,palavra])).rows[0].audio_arquivo,path2)
   assert.equal(fs.readdirSync(require('node:path').dirname(require('node:path').join(audioDir,path2))).length,2)
  })
  await t.test('falha de auditoria reverte a alteração e não cria histórico de sucesso',async()=>{
   const antes=(await db.query('SELECT count(*)::int AS n FROM public.auditoria_atividades WHERE fase_id=$1',[fase])).rows[0].n
   await db.query(`ALTER TABLE public.auditoria_atividades ADD CONSTRAINT teste_falha_auditoria
    CHECK (depois #>> '{submissoes_pg,0,observacoes}' IS DISTINCT FROM 'FALHA AUDITORIA TESTE')`)
   const falha=await req('POST','submissoes/respostas',{...payload,observacoes:'FALHA AUDITORIA TESTE'})
   assert.equal(falha.status,500)
   assert.equal((await db.query('SELECT observacoes FROM public.submissoes_pg WHERE id_fase=$1',[fase])).rows[0].observacoes,'Corrigido pelo superadmin')
   assert.equal((await db.query('SELECT count(*)::int AS n FROM public.auditoria_atividades WHERE fase_id=$1',[fase])).rows[0].n,antes)
   await db.query('ALTER TABLE public.auditoria_atividades DROP CONSTRAINT teste_falha_auditoria')
  })
  await t.test('histórico não permite edição, exclusão ou limpeza por truncate',async()=>{
   for(const sql of ['UPDATE public.auditoria_atividades SET autor_nome=autor_nome','DELETE FROM public.auditoria_atividades','TRUNCATE public.auditoria_atividades']) {
    await db.query('SAVEPOINT imutabilidade')
    await assert.rejects(db.query(sql),/histórico de auditoria/)
    await db.query('ROLLBACK TO SAVEPOINT imutabilidade')
   }
  })
 } finally {if(server)await new Promise(resolve=>server.close(resolve));pool.getPgPool=original;await db.query('ROLLBACK');await db.end();fs.rmSync(audioDir,{recursive:true,force:true})}
})
