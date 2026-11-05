const {test}=require('node:test'),assert=require('node:assert/strict')
const {classificarTurmas}=require('../dist/services/classificacaoTurmas')
const codigos=['RIMAS','ALITERACAO_A','CONSCIENCIA_PALAVRAS','CONSCIENCIA_SILABICA','RELACAO_LETRA_SOM','LETRAS_NUMEROS','ESCRITA_NOME','NIVEL_ESCRITA']
const grupo=(id,versao,ns)=>codigos.flatMap((codigo,i)=>{
 const sim=ns?.[i]?.[0]??5,avaliadas=ns?.[i]?.[1]??10
 const base={turmaId:id,turma:`Turma ${id}`,escola:'Escola',professoras:['Professora'],versao,criancas:10}
 if(i>=6)return [{...base,codigo:`${codigo}_${i===6?'SEM_APOIO':'ALFABETICA_COMPLETA'}`,avaliadas:sim,sim:0},
  {...base,codigo:`${codigo}_${i===6?'COM_APOIO':'PRE_ALFABETICA'}`,avaliadas:avaliadas-sim,sim:0}]
 return [{...base,codigo,avaliadas,sim}]
})
test('Oito questões têm peso igual; ausência não vira zero e versões não se misturam',()=>{
 const rs=classificarTurmas([...grupo(1,1,[[10,10],[0,50],[10,10],[10,10],[10,10],[10,10]]),...grupo(2,1),...grupo(3,1,[[0,0]]),...grupo(1,2)])
 assert.equal(rs.find(r=>r.turmaId===1&&r.versao===1).indice,75)
 assert.equal(rs.find(r=>r.turmaId===1&&r.versao===2).indice,50)
 assert.equal(rs.find(r=>r.turmaId===3).indice,null);assert.equal(rs.find(r=>r.turmaId===3).posicao,null)
 assert.deepEqual(rs.find(r=>r.turmaId===1).professoras,['Professora'])
})
test('Empates têm a mesma posição; zero observado é válido',()=>{
 const rs=classificarTurmas([...grupo(2,1),...grupo(1,1),...grupo(3,1,codigos.map(()=>[0,10]))])
 assert.deepEqual(rs.map(r=>[r.turmaId,r.posicao,r.indice]),[[1,1,50],[2,1,50],[3,2,0]])
 assert.deepEqual(classificarTurmas([]),[])
})
test('Q2 é média por vogal e mantém peso de uma questão',()=>{
 const rs=grupo(1,1,codigos.map(()=>[10,10]));rs[1]={...rs[1],sim:1,avaliadas:1}
 rs.push({...rs[1],codigo:'ALITERACAO_E',sim:0,avaliadas:9})
 const t=classificarTurmas(rs)[0],q2=t.resultados.find(r=>r.codigo==='ALITERACAO')
 assert.equal(q2.percentual,50);assert.equal(q2.vogais.length,5);assert.equal(q2.vogais.find(v=>v.vogal==='I').percentual,null)
 assert.equal(t.indice,93.8)
})
test('Q7 conta somente sem apoio e preserva não escreve; Q8 soma completa e consolidada e separa ausência',()=>{
 const rs=grupo(1,1).filter(r=>!r.codigo.startsWith('ESCRITA_NOME_')&&!r.codigo.startsWith('NIVEL_ESCRITA_'))
 const base=rs[0]
 for(const [codigo,avaliadas] of [['ESCRITA_NOME_SEM_APOIO',3],['ESCRITA_NOME_COM_APOIO',2],['ESCRITA_NOME_NAO_ESCREVE',1],['NIVEL_ESCRITA_ALFABETICA_COMPLETA',2],['NIVEL_ESCRITA_ALFABETICA_CONSOLIDADA',1],['NIVEL_ESCRITA_ALFABETICA_PARCIAL',1],['NIVEL_ESCRITA_NAO_ESCREVEU',1]])rs.push({...base,codigo,avaliadas,sim:0})
 rs.push({...base,codigo:'DETALHE_NOME_NOME_COMPLETO',avaliadas:2,sim:0},{...base,codigo:'DETALHE_NOME_NAO_INFORMADO',avaliadas:3,sim:0})
 const t=classificarTurmas(rs)[0],q7=t.resultados[6],q8=t.resultados[7]
 assert.deepEqual([q7.avaliadas,q7.sim,q7.percentual,q7.ausentes,q7.cobertura],[6,3,50,4,60])
 assert.deepEqual([q8.avaliadas,q8.sim,q8.percentual,q8.ausentes,q8.cobertura],[5,3,60,5,50])
 assert.equal(q8.categorias.find(c=>c.codigo==='NAO_ESCREVEU').n,1)
 assert.equal(q7.detalhesNome.find(c=>c.codigo==='NOME_COMPLETO').n,2)
 assert.equal(q7.detalhesNome.find(c=>c.codigo==='NAO_INFORMADO').n,3)
 assert.equal(t.indice,51.3)
})
test('Q8 não avaliada deixa bloco incompleto; sem apoio zero é diferente de ausência',()=>{
 const rs=grupo(1,1).filter(r=>!r.codigo.startsWith('NIVEL_ESCRITA_'))
 const t=classificarTurmas(rs)[0];assert.equal(t.indice,null);assert.equal(t.posicao,null)
 assert.equal(t.resultados[7].percentual,null);assert.equal(t.resultados[7].ausentes,10)
 const outro=classificarTurmas(grupo(2,1,codigos.map(()=>[0,10])))[0]
 assert.equal(outro.resultados[6].percentual,0)
})
