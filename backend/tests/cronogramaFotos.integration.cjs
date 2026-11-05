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
  const token=async(cpf,admin=false,superadmin=false)=>{
   const sid=crypto.randomUUID()
   await require('../dist/services/sessions').registerSession(sid,cpf,new Date(Date.now()+3600000))
   return jwt.sign({cpf,sid,permissoes:{administrador:admin,superadmin}},process.env.JWT_SECRET,{expiresIn:'1h'})
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
  await t.test('administrador e superadmin consultam galeria e binário sem atribuição de professor',async()=>{
   const galeria=`http://127.0.0.1:${server.address().port}/api/cronogramas/administracao/fotos`
   const consultar=(bearer,query='',headers={})=>fetch(galeria+query,{headers:{...(bearer?{Authorization:`Bearer ${bearer}`} : {}),...headers}})
   assert.equal((await consultar()).status,401)
   assert.equal((await consultar(outsider)).status,403)
   const superadmin=await token('98765432100',false,true)
   const filtro=`?turmaId=${base.id_turma}&conteudoId=${base.item}`
   for(const bearer of [admin,superadmin]){
    const r=await consultar(bearer,filtro);assert.equal(r.status,200)
    assert.equal(r.headers.get('cache-control'),'private, no-store')
    const d=await r.json();assert.equal(d.total,1);assert.equal(d.fotos[0].id,foto.id)
    assert.ok(d.fotos[0].escolaNome);assert.ok(d.fotos[0].turmaNome);assert.ok(d.fotos[0].tema)
    assert.ok(d.filtros.turmas.some(t=>t.id===String(base.id_turma)))
    const arquivo=await request('GET',`/${foto.id}/arquivo`,bearer);assert.equal(arquivo.status,200)
    assert.deepEqual(Buffer.from(await arquivo.arrayBuffer()),png)
   }
   assert.equal((await consultar(admin,filtro,{'X-View-As-Cpf':base.cpf})).status,403)
   assert.equal((await consultar(admin,'?turmaId=invalid')).status,400)
   assert.equal((await consultar(admin,'?pagina=0')).status,400)
   assert.equal((await consultar(admin,'?turmaId=2147483647').then(r=>r.json())).total,0)
   const escola=(await db.query('SELECT id_escola FROM public.turmas WHERE id_turma=$1',[base.id_turma])).rows[0].id_escola
   assert.equal((await consultar(admin,filtro+'&escolaId='+escola).then(r=>r.json())).total,1)
   assert.equal((await consultar(admin,filtro+'&escolaId=2147483647').then(r=>r.json())).total,0)
   assert.equal((await consultar(admin,'?conteudoId=2147483647').then(r=>r.json())).total,0)
   const extras=[]
   try{
    for(let i=0;i<12;i++){
     const id=crypto.randomUUID();extras.push(id)
     await db.query(`INSERT INTO public.cronograma_fotos (id_foto,id_turma,id_cronograma_aplicacao,cpf_professor,arquivo,nome_original,mime_type,tamanho)
      VALUES ($1,$2,$3,$4,$5,'legado.png','image/png',1)`,[id,base.id_turma,base.item,base.cpf,id+'.png'])
    }
    const um=await consultar(admin,filtro).then(r=>r.json()),dois=await consultar(admin,filtro+'&pagina=2').then(r=>r.json())
    assert.equal(um.total,13);assert.equal(um.totalPaginas,2);assert.equal(um.fotos.length,12);assert.equal(dois.fotos.length,1)
    assert.equal(new Set([...um.fotos,...dois.fotos].map(f=>f.id)).size,13)
   }finally{await db.query('DELETE FROM public.cronograma_fotos WHERE id_foto=ANY($1::uuid[])',[extras])}
  })
  await t.test('segunda foto é rejeitada sem substituir o registro ou criar outro arquivo',async()=>{
   await db.query('UPDATE public.cronograma_fotos SET cpf_professor=$1 WHERE id_foto=$2',[base.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4'),foto.id])
   const r=await request('POST','',professor,form());assert.equal(r.status,409)
   assert.match((await r.json()).error,/já anexou uma foto/)
   const fotos=(await request().then(r=>r.json())).fotos
   assert.equal(fotos.length,1);assert.equal(fotos[0].id,foto.id)
   assert.equal((await fs.readdir(dir)).length,1)
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
  await t.test('dois professores da mesma turma podem anexar uma foto cada e filtrar pelo autor',async()=>{
   const novo=(await db.query(`SELECT regexp_replace(profissional_cpf::text,'\\D','','g') AS cpf FROM public.professores
    WHERE regexp_replace(profissional_cpf::text,'\\D','','g')<>$1 AND length(regexp_replace(profissional_cpf::text,'\\D','','g'))=11 LIMIT 1`,[base.cpf])).rows[0];assert.ok(novo)
   await db.query('INSERT INTO public.atribuicao_professor(cpf_professor,id_turma) SELECT $1::varchar,$2::integer WHERE NOT EXISTS(SELECT 1 FROM public.atribuicao_professor WHERE cpf_professor=$1::varchar AND id_turma=$2::integer)',[novo.cpf,base.id_turma])
   const outro=await token(novo.cpf)
   const r=await request('POST','',outro,form());assert.equal(r.status,201);const segunda=await r.json()
   assert.equal(segunda.minhaFoto,true);assert.ok(segunda.professorNome)
   assert.equal((await request('POST','',outro,form())).status,409)
   const lista=(await request().then(r=>r.json())).fotos;assert.equal(lista.length,2)
   assert.equal(lista.find(f=>f.id===foto.id).minhaFoto,true);assert.equal(lista.find(f=>f.id===segunda.id).minhaFoto,false)
   assert.equal((await request('DELETE',`/${foto.id}`,outro)).status,404)
   const api=`http://127.0.0.1:${server.address().port}/api/cronogramas/administracao/fotos?turmaId=${base.id_turma}&conteudoId=${base.item}`
   const todos=await fetch(api,{headers:{Authorization:`Bearer ${admin}`}}).then(r=>r.json())
   assert.equal(todos.total,2);assert.ok(todos.filtros.professores.length>=2)
   const autor=todos.fotos.find(f=>f.id===segunda.id);assert.ok(autor.professorNome)
   const filtrado=await fetch(api+'&professorId='+autor.professorId,{headers:{Authorization:`Bearer ${admin}`}}).then(r=>r.json())
   assert.equal(filtrado.total,1);assert.equal(filtrado.fotos[0].id,segunda.id)
   assert.equal((await request('DELETE',`/${segunda.id}`,outro)).status,200)
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
  await t.test('desmarcar conteúdo preserva evidência; excluir remove vínculo e binário',async()=>{
   await db.query('DELETE FROM public.turma_cronograma_aplicacao WHERE id_turma=$1 AND id_cronograma_aplicacao=$2',[base.id_turma,base.item])
   assert.equal((await request('GET',`/${foto.id}/arquivo`)).status,200)
   assert.equal((await request('DELETE',`/${foto.id}`)).status,200)
   assert.equal((await request('GET',`/${foto.id}/arquivo`)).status,404)
   assert.equal((await fs.readdir(dir)).length,0)
  })
  await t.test('excluir a foto libera novo envio',async()=>{
   const r=await request('POST','',professor,form());assert.equal(r.status,201)
   const nova=await r.json();assert.notEqual(nova.id,foto.id)
   assert.equal((await request('DELETE',`/${nova.id}`)).status,200)
  })
  await t.test('falha de gravação no banco limpa o arquivo e não anuncia sucesso',async()=>{
   const savedPool=pool.getPgPool
   pool.getPgPool=()=>({...savedPool(),connect:async()=>{
    const client=await savedPool().connect()
    return {...client,query:(sql,values)=>{if(sql.includes('INSERT INTO public.cronograma_fotos'))throw Error('TESTE falha simulada');return client.query(sql,values)}}
   }})
   try{assert.equal((await request('POST','',professor,form())).status,500)}finally{pool.getPgPool=savedPool}
   assert.equal((await fs.readdir(dir)).length,0)
  })
  await t.test('DEV consulta e abre fotos de Produção sem copiar metadados ou permitir escrita',async()=>{
   const root=await fs.mkdtemp(path.join(os.tmpdir(),'fotos-producao-ro-')),anterior=process.env.AUDIO_READONLY_STORAGE_PATH
   process.env.AUDIO_READONLY_STORAGE_PATH=root
   const id=crypto.randomUUID(),arquivo=id+'.png',autorId=crypto.createHash('md5').update('autor-producao-teste').digest('hex')
   await fs.mkdir(path.join(root,'.monitoramento'));await fs.mkdir(path.join(root,'cronograma-fotos'))
   await fs.writeFile(path.join(root,'cronograma-fotos',arquivo),png)
   const catalogo={versao:1,servidor:'192.168.0.121',coletadoEm:new Date().toISOString(),fotos:[{id,nome:'producao.png',criadoEm:new Date().toISOString(),arquivo,mimeType:'image/png',escolaId:'90000001',turmaId:'90000002',conteudoId:'90000003',escolaNome:'Escola teste Produção',turmaNome:'Integral',tema:'Atividade',ordem:1,professorId:autorId,professorNome:'Professora teste Produção'}]}
   await fs.writeFile(path.join(root,'.monitoramento/cronograma-fotos.json'),JSON.stringify(catalogo))
   await fs.chmod(path.join(root,'cronograma-fotos'),0o555)
   try{
    const api=`http://127.0.0.1:${server.address().port}/api/cronogramas/administracao/fotos?origem=producao&professorId=${autorId}`
    assert.equal((await fetch(api,{headers:{Authorization:`Bearer ${outsider}`}})).status,403)
    const r=await fetch(api,{headers:{Authorization:`Bearer ${admin}`}});assert.equal(r.status,200);const d=await r.json()
    assert.equal(d.total,1);assert.equal(d.origem,'producao');assert.equal(d.fotos[0].professorNome,'Professora teste Produção')
    assert.equal(d.fotos[0].arquivo,undefined)
    const caminho=`http://127.0.0.1:${server.address().port}/api${d.fotos[0].arquivoUrl}`
    const imagem=await fetch(caminho,{headers:{Authorization:`Bearer ${admin}`}});assert.equal(imagem.status,200);assert.deepEqual(Buffer.from(await imagem.arrayBuffer()),png)
    assert.equal((await fetch(caminho,{headers:{Authorization:`Bearer ${outsider}`}})).status,403)
    for(const method of ['POST','DELETE'])assert.equal((await fetch(caminho,{method,headers:{Authorization:`Bearer ${admin}`}})).status,404)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.cronograma_fotos WHERE id_foto=$1',[id])).rows[0].n,0)
    assert.equal(await require('../dist/services/cronogramaFotos').localizarFoto(arquivo),path.join(root,'cronograma-fotos',arquivo))
    assert.deepEqual(await fs.readFile(path.join(root,'cronograma-fotos',arquivo)),png)
   }finally{
    if(anterior===undefined)delete process.env.AUDIO_READONLY_STORAGE_PATH;else process.env.AUDIO_READONLY_STORAGE_PATH=anterior
    await fs.chmod(path.join(root,'cronograma-fotos'),0o755);await fs.rm(root,{recursive:true,force:true})
   }
  })
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve))
  pool.getPgPool=original
  await db.query('ROLLBACK');await db.end();await fs.rm(dir,{recursive:true,force:true})
 }
})
