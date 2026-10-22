const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs/promises')
const os=require('node:os')
const path=require('node:path')
const crypto=require('node:crypto')
const {Client}=require('pg')
const dotenv=require('dotenv')
const express=require('express')
const jwt=require('jsonwebtoken')

test('Fotos por conteúdo: persistência, armazenamento e autorização com rollback no DEV',async t=>{
 const env=dotenv.parse(await fs.readFile(__dirname+'/../.env_dev'))
 assert.equal(env.PILOTO_PG_HOST,'172.17.2.42');assert.equal(env.PILOTO_PG_DB,'dbsemecel')
 const db=new Client({host:env.PILOTO_PG_HOST,database:env.PILOTO_PG_DB,user:env.PILOTO_PG_USER,password:env.PILOTO_PG_PASSWORD})
 await db.connect()
 const pool=require('../dist/services/pgPool'),original=pool.getPgPool
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cronograma-fotos-'))
 process.env.CRONOGRAMA_FOTOS_STORAGE_PATH=dir
 process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex')
 let server
 try{
  await db.query('BEGIN')
  pool.getPgPool=()=>({query:(...args)=>db.query(...args),connect:async()=>({query:(sql,values)=>db.query(sql==='BEGIN'?'SAVEPOINT fotos':sql==='COMMIT'?'RELEASE SAVEPOINT fotos':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT fotos':sql,values),release(){}})})
  const base=(await db.query(`SELECT t.id_turma,ca.id_cronograma_aplicacao AS item,regexp_replace(ap.cpf_professor,'\\D','','g') AS cpf
   FROM public.atribuicao_professor ap JOIN public.turmas t USING(id_turma)
   JOIN public.escolas e USING(id_escola) JOIN public.etapas et ON et.id_etapa=t.id_etapa
   JOIN public.cronograma_aplicacao ca ON ca.id_etapa=t.id_etapa
   WHERE e.projeto='PJINSTFONI' AND et.projeto='PJINSTFONI' AND ca.ordem IS NOT NULL LIMIT 1`)).rows[0]
  assert.ok(base,'Professor com conteúdo atribuído no DEV')
  const token=async(cpf,admin=false)=>{
   const sid=crypto.randomUUID()
   await require('../dist/services/sessions').registerSession(sid,cpf,new Date(Date.now()+3600000))
   return jwt.sign({cpf,sid,permissoes:{administrador:admin}},process.env.JWT_SECRET,{expiresIn:'1h'})
  }
  const professor=await token(base.cpf),outsider=await token('98765432100'),admin=await token('98765432100',true)
  const app=express();app.use(express.json());app.use('/api/cronogramas',require('../dist/routes/cronogramas').default)
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
  const url=`http://127.0.0.1:${server.address().port}/api/cronogramas/${base.id_turma}/itens/${base.item}/fotos`
  const request=(method='GET',suffix='',bearer=professor,body,headers={})=>fetch(url+suffix,{method,headers:{...(bearer?{Authorization:`Bearer ${bearer}`} : {}),...headers},...(body?{body}: {})})
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPe0AAAAASUVORK5CYII=','base64')
  const form=(bytes=png,name='atividade.png')=>{const f=new FormData();f.append('foto',new Blob([bytes],{type:'image/png'}),name);return f}
  let foto
  await t.test('exige autenticação e vínculo com turma antes de aceitar upload',async()=>{
   assert.equal((await request('GET','',null)).status,401)
   assert.equal((await request('POST','',outsider,form())).status,403)
   const wrong=await fetch(url.replace(`/itens/${base.item}/`,'/itens/2147483647/'),{headers:{Authorization:`Bearer ${professor}`}})
   assert.equal(wrong.status,403)
  })
  await t.test('grava foto real, lista e devolve o mesmo binário com acesso privado',async()=>{
   assert.equal((await request()).status,200)
   const saved=await request('POST','',professor,form());assert.equal(saved.status,201);foto=await saved.json()
   assert.equal(foto.nome,'atividade.png');assert.equal(foto.podeExcluir,true)
   const rows=(await request().then(r=>r.json())).fotos
   assert.ok(rows.some(f=>f.id===foto.id))
   const file=await request('GET',`/${foto.id}/arquivo`)
   assert.equal(file.status,200);assert.equal(file.headers.get('content-type'),'image/png')
   assert.equal(file.headers.get('cache-control'),'private, no-store')
   assert.deepEqual(Buffer.from(await file.arrayBuffer()),png)
   assert.equal((await fs.readdir(dir)).length,1)
   assert.notEqual((await fs.readdir(dir))[0],'atividade.png')
  })
  await t.test('outro professor não acessa nem exclui; conferência pode ler e não alterar',async()=>{
   assert.equal((await request('GET',`/${foto.id}/arquivo`,outsider)).status,403)
   assert.equal((await request('DELETE',`/${foto.id}`,outsider)).status,403)
   const headers={'X-View-As-Cpf':base.cpf}
   const view=await request('GET','',admin,undefined,headers)
   assert.equal(view.status,200);assert.equal((await view.json()).fotos.find(f=>f.id===foto.id).podeExcluir,false)
   assert.equal((await request('POST','',admin,form(),headers)).status,403)
   assert.equal((await request('DELETE',`/${foto.id}`,admin,undefined,headers)).status,403)
  })
  await t.test('rejeita arquivo disfarçado, vazio, múltiplos e acima de 8 MB',async()=>{
   assert.equal((await request('POST','',professor,form(Buffer.from('<svg>nao foto</svg>')))).status,400)
   assert.equal((await request('POST','',professor,new FormData())).status,400)
   const multiple=form();multiple.append('foto',new Blob([png]),'outra.png')
   assert.equal((await request('POST','',professor,multiple)).status,400)
   assert.equal((await request('POST','',professor,form(Buffer.alloc(8*1024*1024+1)))).status,400)
   assert.equal((await fs.readdir(dir)).length,1)
   assert.throws(()=>require('../dist/services/cronogramaFotos').caminhoFoto('../../arquivo'))
  })
  await t.test('falha de gravação no banco limpa o arquivo e não anuncia sucesso',async()=>{
   const savedPool=pool.getPgPool
   pool.getPgPool=()=>({query:(sql,values)=>{if(sql.includes('INSERT INTO public.cronograma_fotos'))throw Error('TESTE falha simulada');return db.query(sql,values)}})
   try{assert.equal((await request('POST','',professor,form())).status,500)}finally{pool.getPgPool=savedPool}
   assert.equal((await fs.readdir(dir)).length,1)
  })
  await t.test('desmarcar conteúdo preserva evidência; excluir remove vínculo e binário',async()=>{
   await db.query('DELETE FROM public.turma_cronograma_aplicacao WHERE id_turma=$1 AND id_cronograma_aplicacao=$2',[base.id_turma,base.item])
   assert.equal((await request('GET',`/${foto.id}/arquivo`)).status,200)
   assert.equal((await request('DELETE',`/${foto.id}`)).status,200)
   assert.equal((await request('GET',`/${foto.id}/arquivo`)).status,404)
   assert.equal((await fs.readdir(dir)).length,0)
  })
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve))
  pool.getPgPool=original
  await db.query('ROLLBACK');await db.end();await fs.rm(dir,{recursive:true,force:true})
 }
})
