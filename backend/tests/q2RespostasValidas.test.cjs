const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs')
const {resumirVogais}=require('../dist/services/vogais'),{calcularIndiceQ1Q5}=require('../dist/services/indiceTarefasQ1Q5'),{calcularIndiceAlfabetico}=require('../dist/services/indiceAlfabetico')
test('todos os exemplos do CSV aprovado para desempenho Q2',()=>{
 const linhas=fs.readFileSync(__dirname+'/fixtures/q2-exemplos-desempenho.csv','utf8').trim().split(/\r?\n/).slice(1)
 assert.equal(linhas.length,13)
 for(const linha of linhas){const campos=linha.match(/("[^"]*"|[^,]+)/g),valores=campos.slice(0,5).map(v=>({acertou:v==='TRUE'?true:v==='FALSE'?false:null})),esperado=Number(campos[5].replace(/["%]/g,'').replace(',','.'))
 const r=resumirVogais(valores);assert.ok(Math.abs(r.desempenho*100-esperado)<.0051,linha)
 const geral=calcularIndiceAlfabetico([{notas:[100,r.desempenho*100,100,100,100,100,100,100,100]}]);assert.equal(geral.completas,1)
 }
})
test('nenhuma resposta válida é sem dados; FALSE permanece válida e vale zero',()=>{
 assert.equal(resumirVogais(Array(5).fill({acertou:null})).desempenho,null)
 assert.equal(resumirVogais([{acertou:false},{acertou:null}]).desempenho,0)
 assert.equal(resumirVogais([{acertou:true},{acertou:null}]).desempenho,1)
 assert.equal(calcularIndiceQ1Q5([{q1:1,q2:1,q3:1,q4:1,q5:1,n:1}]).media,100)
})
