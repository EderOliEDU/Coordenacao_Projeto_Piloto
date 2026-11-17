const {test}=require('node:test'),assert=require('node:assert/strict')
const {calcularIndiceAlfabetico:f,PESOS_QUESTOES}=require('../dist/services/indiceAlfabetico')
test('pesos aprovados e exemplo de 79,91 pontos',()=>{
 assert.ok(Math.abs(PESOS_QUESTOES.reduce((a,b)=>a+b,0)-1)<1e-12)
 assert.ok(Math.abs(f([{notas:[100,60,100,100,100,100,100,67,70]}]).mediaExata-79.91)<1e-9)
})
test('coorte comum exclui incompletas sem transformar ausências em erro',()=>{
 const notas=Array(9).fill(100),faltante=[...notas];faltante[7]=null
 const r=f([{notas},{notas:faltante},{notas:Array(9).fill(0)}])
 assert.equal(r.mediaExata,50);assert.equal(r.completas,2);assert.equal(r.incompletas,1)
 assert.deepEqual(r.notas,Array(9).fill(50));assert.equal(r.validasPorQuestao[7],2);assert.equal(r.validasPorQuestao[0],3)
 for(const valor of [null,NaN,Infinity,-1,101]){const x=[...notas];x[4]=valor;assert.equal(f([{notas:x}]).mediaExata,null)}
 assert.equal(f([]).mediaExata,null)
})
