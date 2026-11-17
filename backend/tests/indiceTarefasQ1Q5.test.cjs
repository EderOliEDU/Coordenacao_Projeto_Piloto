const {test}=require('node:test'),assert=require('node:assert/strict')
const {calcularIndiceQ1Q5:f}=require('../dist/services/indiceTarefasQ1Q5')
const p=(extra={})=>({q1:1,q2:0.6,q3:1,q4:0,q5:1,n:1,...extra})
test('exemplo solicitado: 72/100; Q2 tem o mesmo peso das demais',()=>{
 assert.equal(f([p()]).media,72)
 assert.equal(f([p({q1:0,q2:1,q3:0,q4:0,q5:0})]).media,20)
})
test('média por criança respeita multiplicidade, sem arredondar antes da média',()=>{
 assert.equal(f([p({n:2}),p({q1:0,q2:0,q3:0,q4:0,q5:0})]).media,48)
})
test('incompletas não são zero, nem médias parciais',()=>{
 for(const campo of ['q1','q2','q3','q4','q5']){
  const r=f([p(),p({[campo]:null,n:3})])
  assert.deepEqual([r.media,r.completas,r.incompletas,r.base],[72,1,3,4])
 }
 assert.equal(f([p({q2:null})]).media,null)
})
test('zero observado é válido; base vazia é indefinida; resposta inválida é incompleta',()=>{
 assert.equal(f([p({q1:0,q2:0,q3:0,q4:0,q5:0})]).media,0)
 assert.deepEqual([f([]).media,f([]).base],[null,0])
 assert.equal(f([p({q1:2})]).completas,0)
})

test('referências globais usam extremos dos grupos e média por criança',()=>{
 const {referenciasGlobaisQ1Q5:g}=require('../dist/services/indiceTarefasQ1Q5')
 const dados=[p({grupo:1,n:3}),p({grupo:2,q1:0,q2:0,q3:0,q4:0,q5:0}),p({grupo:3,q2:null})]
 assert.deepEqual(g(dados,p=>p.grupo),{media:54,maior:72,menor:0,grupos:2})
 assert.equal(g([],p=>p.grupo),null)
})
