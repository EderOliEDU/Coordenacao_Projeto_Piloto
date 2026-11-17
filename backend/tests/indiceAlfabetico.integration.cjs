const {test}=require('node:test'),assert=require('node:assert/strict')
const dotenv=require('dotenv'),fs=require('node:fs'),{Pool}=require('pg')
const pm=require('../dist/services/pgPool'),{carregarRelatorioTerceiraAvaliacao:carregar}=require('../dist/services/relatorioTerceiraAvaliacao')
test('Q1–Q9 real: coorte comum, contribuições, cobertura e agregados sem identidades',async()=>{
 const env=dotenv.parse(fs.readFileSync(__dirname+'/../.env_dev'))
 const pool=new Pool({host:env.PILOTO_PG_HOST,port:Number(env.PILOTO_PG_PORT)||5432,database:env.PILOTO_PG_DB||env.PILOTO_PG_DATABASE,user:env.PILOTO_PG_USER,password:env.PILOTO_PG_PASSWORD,options:'-c default_transaction_read_only=on'})
 const anterior=pm.getPgPool;pm.getPgPool=()=>pool
 try{
  const d=await carregar(),rs=d.indicesAlfabeticosTurmasProjeto,ws=[.05,.05,.05,.05,.10,.02,.10,.23,.35]
  assert.equal(rs.length,d.pontuacaoTurmasProjeto.length)
  const ids=[10081,10291,10127,10279,10269]
  for(const id of ids){const t=rs.find(t=>t.turmaId===id);assert.ok(t);assert.equal(t.validasPorQuestao[1],t.base);assert.ok(t.completas>0);assert.ok(t.notas[1]!==null)}
  console.log('EMEI Elaine: Q2 válida nas cinco turmas e índices calculados')

  assert.ok(rs.every(t=>t.versao==='APRENDIZAGEM-ALFABETICA-Q1Q9-V2'))
  assert.equal(d.conscienciaParticipantesTurmas.reduce((s,t)=>s+t.participantes,0),d.pontuacaoTurmasProjeto.reduce((s,t)=>s+t.base,0))
  assert.ok(d.conscienciaParticipantesTurmas.every(t=>t.mediaExata>=0&&t.mediaExata<=100))
  console.log('Consciência: '+d.conscienciaParticipantesTurmas.reduce((s,t)=>s+t.participantes,0)+' participantes; índice geral V2 preservado')
  assert.equal(rs.reduce((s,t)=>s+t.base,0),d.pontuacaoTurmasProjeto.reduce((s,t)=>s+t.base,0))
  for(const t of rs){
   assert.equal(t.completas+t.incompletas,t.base);assert.equal(t.notas.length,9)
   assert.ok(t.validasPorQuestao.every(n=>n>=t.completas&&n<=t.base))
   if(t.completas){assert.ok(t.mediaExata>=0&&t.mediaExata<=100);assert.ok(Math.abs(t.notas.reduce((s,n,i)=>s+n*ws[i],0)-t.mediaExata)<1e-8)}else assert.equal(t.mediaExata,null)
   assert.equal(t.id_aluno,undefined);assert.equal(t.id_aplicacao,undefined)
  }
  console.log(JSON.stringify({turmas:rs.length,base:rs.reduce((s,t)=>s+t.base,0),completas:rs.reduce((s,t)=>s+t.completas,0),classificadas:rs.filter(t=>t.completas).length}))
 }finally{pm.getPgPool=anterior;await pool.end()}
})
