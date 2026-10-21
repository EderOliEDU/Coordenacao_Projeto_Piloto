const {test}=require('node:test')
const assert=require('node:assert/strict')
const {avaliarTerceiraAvaliacao}=require('../dist/services/relatorioTerceiraAvaliacao')
const base=()=>({resumo:{concluidas:4},perguntas:[],vogais:[],consoantes:[],leitura:[],palavras:[{palavra:'UVA',ordem:1}]})
test('Protocolo fixa denominador válido e separa ausências, sem percentual zero para ausência de dados',()=>{
 const d=base();d.perguntas=[{codigo:'RIMAS',resposta:'SIM',n:2},{codigo:'RIMAS',resposta:'NAO',n:1}]
 const r=avaliarTerceiraAvaliacao(d);const q1=r.linhas.find(l=>l.item==='Q1');const q3=r.linhas.find(l=>l.item==='Q3')
 assert.deepEqual([q1.base,q1.avaliadas,q1.ausentes],[4,3,1]);assert.equal(q1.resultados[0].percentual,66.7)
 assert.equal(q3.avaliadas,0);assert.equal(q3.resultados[0].percentual,null)
 assert.equal(q3.interpretacao,'Não há evidência registrada suficiente para esta habilidade.')
 assert.equal(r.protocolo.codigo,'TERCEIRA-AVALIACAO-V1')
 assert.deepEqual(r,avaliarTerceiraAvaliacao(d))
})
test('Q2 agrega versões e Q9 não respondeu permanece uma categoria válida distinta de registro ausente',()=>{
 const d=base();d.vogais=[{versao:1,vogal:'A',acertou:true,n:1},{versao:2,vogal:'A',acertou:true,n:1},{versao:2,vogal:'A',acertou:false,n:1}]
 d.leitura=[{palavra:'UVA',classificacao:'NAO_RESPONDEU',n:1},{palavra:'UVA',classificacao:'DECODIFICA',n:2}]
 const r=avaliarTerceiraAvaliacao(d);const a=r.linhas.find(l=>l.item==='Q2-A');const q9=r.linhas.find(l=>l.item==='Q9-UVA')
 assert.deepEqual([a.avaliadas,a.ausentes,a.resultados[0].n],[3,1,2]);assert.equal(a.resultados[0].percentual,66.7)
 assert.equal(q9.avaliadas,3);assert.equal(q9.ausentes,1);assert.equal(q9.resultados.find(r=>r.codigo==='NAO_RESPONDEU').n,1)
 assert.ok(!JSON.stringify(r).includes('LEGADO'))
})
test('Q5 detalhe usa grupo da letra; categorias de nome e escrita preservadas',()=>{
 const d=base();d.consoantes=[{letra:'B',resposta:'SIM',n:1},{letra:'B',resposta:'NAO',n:1},{letra:'F',resposta:'NAO',n:1}]
 d.perguntas=[{codigo:'ESCRITA_NOME',resposta:'COM_APOIO',n:2},{codigo:'NIVEL_ESCRITA',resposta:'ALFABETICA_PARCIAL',n:1}]
 const r=avaliarTerceiraAvaliacao(d);const b=r.linhas.find(l=>l.item==='Q5-B')
 assert.equal(b.base,2);assert.equal(b.ausentes,0);assert.equal(b.resultados[0].percentual,50)
 assert.equal(r.linhas.find(l=>l.item==='Q8').ausentes,3)
 assert.ok(r.sintese.demonstradas.some(s=>s.includes('com apoio')))
 assert.ok(r.linhas.find(l=>l.item==='Q8').interpretacao.includes('Classificação registrada'))
})
test('Base vazia e contagem incompatível não geram conclusões fabricadas',()=>{
 const d=base();d.resumo.concluidas=0
 const r=avaliarTerceiraAvaliacao(d);assert.deepEqual(r.sintese.demonstradas,[]);assert.match(r.conclusao,/Não há aplicações/)
 d.perguntas=[{codigo:'RIMAS',resposta:'SIM',n:1}];assert.throws(()=>avaliarTerceiraAvaliacao(d),/incompatíveis/)
})
