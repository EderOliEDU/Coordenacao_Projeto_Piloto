const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const modulo={exports:{}}
const fonte=fs.readFileSync(path.join(__dirname,'../src/relatorioTerceira.ts'),'utf8')
new Function('exports','module',ts.transpileModule(fonte,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(modulo.exports,modulo)
const {compilarResultados,compilarConscienciaFonologica}=modulo.exports
const linha=(item,sim,nao,base=4)=>({item,habilidade:item,base,avaliadas:sim+nao,ausentes:base-sim-nao,interpretacao:'',limite:'',resultados:[{codigo:'SIM',descricao:'Demonstrou',n:sim,percentual:null},{codigo:'NAO',descricao:'Não demonstrou',n:nao,percentual:null}]})
test('compilação Q1–Q5 soma vogais e exclui a dupla contagem dos detalhes da consoante',()=>{
 const dados=[linha('Q1',2,1),linha('Q2-A',1,1),linha('Q2-E',2,1),linha('Q2-I',0,1),linha('Q2-O',1,0),linha('Q2-U',1,0),linha('Q3',1,2),linha('Q4',3,1),linha('Q5',2,2),linha('Q5-B',1,1,2),linha('Q5-F',1,1,2),linha('Q6',4,0)]
 const copia=JSON.stringify(dados),r=compilarConscienciaFonologica(dados)
 assert.deepEqual(r.map(l=>l.item),['Q1','Q2','Q3','Q4','Q5'])
 assert.equal(r[1].base,20);assert.equal(r[1].avaliadas,8);assert.equal(r[1].ausentes,12)
 assert.equal(r[1].resultados.find(r=>r.codigo==='SIM').n,5)
 assert.equal(r[4].base,4);assert.equal(r[4].avaliadas,4)
 assert.equal(JSON.stringify(dados),copia)
})
test('Q9 reúne palavras preservando não respondeu e ausência como situações diferentes',()=>{
 const criar=(item,rs)=>({item,base:4,avaliadas:rs.reduce((s,r)=>s+r.n,0),ausentes:4-rs.reduce((s,r)=>s+r.n,0),resultados:rs.map(r=>({...r,descricao:r.codigo,percentual:null}))})
 const r=compilarResultados([criar('Q9-UVA',[{codigo:'DECODIFICA',n:2},{codigo:'NAO_RESPONDEU',n:1}]),criar('Q9-PATO',[{codigo:'DECODIFICA',n:1},{codigo:'LE_AUTONOMIA',n:1}])],'Q9','Leitura por palavra')
 assert.equal(r.base,8);assert.equal(r.avaliadas,5);assert.equal(r.ausentes,3)
 assert.equal(r.resultados.find(r=>r.codigo==='DECODIFICA').percentual,60)
 assert.equal(r.resultados.find(r=>r.codigo==='NAO_RESPONDEU').n,1)
})
test('sem respostas não inventa percentuais e não transforma ausência em erro',()=>{
 const r=compilarResultados([linha('Q2-A',0,0)],'Q2','Vogais')
 assert.equal(r.avaliadas,0);assert.equal(r.ausentes,4);assert.ok(r.resultados.every(r=>r.percentual===null))
 assert.deepEqual(compilarResultados([],'Q9','Leitura').resultados,[])
})

test('índice mostra cobertura e distingue zero de ausência de avaliações completas',()=>{
 const {textoIndiceQ1Q5:f}=modulo.exports
 assert.match(f({media:72,completas:18,base:22}),/72\/100.*18 de 22/)
 assert.match(f({media:0,completas:1,base:2}),/0\/100/)
 assert.match(f({media:null,completas:0,base:2}),/sem avaliações completas.*0 de 2/)
})

test('referência pondera crianças completas, ignora ausências e preserva zero',()=>{
 const {referenciasEscolas:f}=modulo.exports
 assert.deepEqual(f([{media:80,completas:3},{media:40,completas:1},{media:null,completas:0}]),{media:70,maior:80,menor:40})
 assert.deepEqual(f([{media:0,completas:1}]),{media:0,maior:0,menor:0})
 assert.equal(f([{media:null,completas:0}]),null)
 assert.equal(f([{media:72.3,mediaExata:72.25,completas:2}]).media,72.25)
})

test('paginação mostra cinco por painel e mantém todos os grupos sem duplicação',()=>{
 const {paginarGrupos:p}=modulo.exports,escolas=Array.from({length:11},(_,i)=>i)
 assert.deepEqual(p(escolas,0).itens,[0,1,2,3,4])
 assert.deepEqual(p(escolas,1).itens,[5,6,7,8,9])
 assert.deepEqual(p(escolas,2).itens,[10])
 assert.equal(p(escolas,99).atual,2)
 assert.deepEqual(p([],0).itens,[])
})
