const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {Client}=require('pg'),dotenv=require('dotenv'),express=require('express'),jwt=require('jsonwebtoken');
test('Monitoramento restrito ao superadmin, origem Produção e falhas explícitas',async()=>{
 const env=dotenv.parse(await fs.readFile(__dirname+'/../.env_dev'));assert.equal(env.PILOTO_PG_HOST,'172.17.2.42');assert.equal(env.PILOTO_PG_DB,'dbsemecel');
 const db=new Client({host:env.PILOTO_PG_HOST,database:env.PILOTO_PG_DB,user:env.PILOTO_PG_USER,password:env.PILOTO_PG_PASSWORD});await db.connect();
 const pool=require('../dist/services/pgPool'),original=pool.getPgPool;let server;
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'armazenamento-api-'));process.env.AUDIO_READONLY_STORAGE_PATH=dir;process.env.AUDIO_STORAGE_PATH='/nao-usar-dados-do-dev';process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
 try{
  await db.query('BEGIN');pool.getPgPool=()=>({query:(...args)=>db.query(...args)});
  const sid=crypto.randomUUID(),cpf='98765432100';await require('../dist/services/sessions').registerSession(sid,cpf,new Date(Date.now()+3600000));
  const token=permissoes=>jwt.sign({cpf,sid,permissoes},process.env.JWT_SECRET,{expiresIn:'1h'});
  const app=express();app.use('/api/superadmin',require('../dist/routes/superadmin').default);
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
  const request=bearer=>fetch(`http://127.0.0.1:${server.address().port}/api/superadmin/armazenamento`,{headers:bearer?{Authorization:'Bearer '+bearer}:{}});
  assert.equal((await request()).status,401);assert.equal((await request(token({}))).status,403);assert.equal((await request(token({administrador:true}))).status,403);
  const superadmin=token({superadmin:true});assert.equal((await request(superadmin)).status,503);
  const arquivo=path.join(dir,'.monitoramento/armazenamento.json');await fs.mkdir(path.dirname(arquivo));
  const snapshot={versao:1,ambiente:'producao',servidor:'192.168.0.121',coletadoEm:new Date().toISOString(),completo:true,falhas:0,audios:{quantidade:27,bytes:456},fotos:{quantidade:3,bytes:123},outros:{quantidade:0,bytes:0},discos:[{nome:'Mídias',caminho:'/midias',total:100*1024**3,disponivel:50*1024**3,ocupado:50*1024**3,inodesTotal:100,inodesLivres:90}]};
  await fs.writeFile(arquivo,JSON.stringify(snapshot));const r=await request(superadmin);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');const dados=await r.json();assert.equal(dados.audios.quantidade,27);assert.equal(dados.fotos.quantidade,3);assert.equal(dados.servidor,'192.168.0.121');assert.equal(dados.nivel,'normal');
  await fs.writeFile(arquivo,'{invalido');assert.equal((await request(superadmin)).status,503);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));pool.getPgPool=original;await db.query('ROLLBACK');await db.end();await fs.rm(dir,{recursive:true,force:true})}
});
