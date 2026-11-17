const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const modulo={exports:{}}
const fonte=fs.readFileSync(path.join(__dirname,'../src/terceiraDashboard.ts'),'utf8')
new Function('exports','module',ts.transpileModule(fonte,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(modulo.exports,modulo)
const {gruposDashboard:g,referenciasDashboard:r,recorteDashboard:c}=modulo.exports
const d=()=>({linhas:[{item:'Q9-UVA'},{item:'Q9-PATO'}],pontuacaoTurmasProjeto:[
 {turmaId:1,turma:'Turma A',escolaId:10,escola:'Escola A',base:4,completas:3,media:80,mediaExata:80,professoras:['Professora A']},
 {turmaId:2,turma:'Turma B',escolaId:10,escola:'Escola A',base:2,completas:1,media:40,mediaExata:40},
 {turmaId:3,turma:'Turma C',escolaId:20,escola:'Escola B',base:2,completas:0,media:null,mediaExata:null},
],distribuicoesTurmasProjeto:[]})
test('consciência usa peso por criança, mantém zero e separa turma sem dados',()=>{
 const x=d(),es=g(x,'Q1Q5','INDICE','escola'),ts=g(x,'Q1Q5','INDICE','turma')
 assert.equal(es[0].valor,70);assert.equal(ts[2].valor,null)
 assert.equal(r(es,true).media,70);assert.deepEqual([r(ts,true).maior,r(ts,true).menor],[80,40])
 assert.equal(c(ts,10,2,'turma')[0].valor,40)
})
test('cada categoria usa seu denominador válido sem transformar ausência em erro',()=>{
 const x=d();x.distribuicoesTurmasProjeto=[
 {turmaId:1,item:'NIVEL_ESCRITA',categoria:'ALFABETICA_COMPLETA',n:1},
 {turmaId:1,item:'NIVEL_ESCRITA',categoria:'NAO_ESCREVEU',n:1},
 {turmaId:2,item:'NIVEL_ESCRITA',categoria:'ALFABETICA_COMPLETA',n:1}]
 const es=g(x,'NIVEL_ESCRITA','ALFABETICA_COMPLETA','escola')
 assert.equal(es[0].base,6);assert.equal(es[0].avaliadas,3);assert.equal(es[0].n,2)
 assert.ok(Math.abs(es[0].valor-200/3)<1e-9)
 const ts=g(x,'NIVEL_ESCRITA','NAO_ESCREVEU','turma')
 assert.equal(ts.find(t=>t.id===2).valor,0)
 assert.equal(ts.find(t=>t.id===3).valor,null)
})
test('leitura conta registros por palavra e não crianças; referências não dependem do recorte',()=>{
 const x=d();x.distribuicoesTurmasProjeto=[
 {turmaId:1,item:'LEITURA',categoria:'DECODIFICA',n:4},
 {turmaId:1,item:'LEITURA',categoria:'NAO_RESPONDEU',n:2},
 {turmaId:2,item:'LEITURA',categoria:'DECODIFICA',n:1}]
 const ts=g(x,'LEITURA','DECODIFICA','turma'),refs=r(ts,false),local=c(ts,10,1,'turma')
 assert.equal(local[0].base,8);assert.equal(local[0].avaliadas,6)
 assert.equal(refs.media,500/7);assert.equal(refs.maior,100)
 assert.equal(g(x,'LEITURA','DECODIFICA','escola')[0].avaliadas,7)
 assert.equal(r([],false),null)
 assert.equal(c(ts,999,null,'turma').length,0)
})
test('rota antiga preserva o componente anterior e ambas exigem administrador',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../src/App.tsx'),'utf8')
 assert.match(app,/relatorio-terceira-old" element={<RequireAdministrador><AplicadorRelatorioPage/)
 assert.match(app,/relatorio-terceira" element={<RequireAdministrador><TerceiraDashboardPage/)
})

test('pizza apresenta todas as categorias do recorte e preserva ausência separada',()=>{
 const x=d();x.distribuicoesTurmasProjeto=[
 {turmaId:1,item:'NIVEL_ESCRITA',categoria:'ALFABETICA_COMPLETA',n:2},
 {turmaId:1,item:'NIVEL_ESCRITA',categoria:'NAO_ESCREVEU',n:1},
 {turmaId:2,item:'NIVEL_ESCRITA',categoria:'PRE_ALFABETICA',n:1},
 {turmaId:3,item:'NIVEL_ESCRITA',categoria:'ALFABETICA_PARCIAL',n:1}]
 const {pizzaDashboard:p}=modulo.exports,rs=p(x,'NIVEL_ESCRITA',{escola:10,turma:null})
 assert.deepEqual([rs.base,rs.avaliadas,rs.ausentes],[6,4,2])
 assert.equal(rs.resultados.find(r=>r.codigo==='ALFABETICA_COMPLETA').percentual,50)
 assert.equal(rs.resultados.find(r=>r.codigo==='ALFABETICA_PARCIAL').n,0)
 assert.equal(p(x,'NIVEL_ESCRITA',{escola:10,turma:1}).avaliadas,3)
})
test('pizza Q2 usa respostas por vogal e leitura usa registros por palavra',()=>{
 const x=d();x.distribuicoesTurmasProjeto=[
 {turmaId:1,item:'ALITERACAO',categoria:'SIM',n:3},
 {turmaId:1,item:'ALITERACAO',categoria:'NAO',n:1},
 {turmaId:1,item:'LEITURA',categoria:'DECODIFICA',n:4},
 {turmaId:1,item:'LEITURA',categoria:'NAO_RESPONDEU',n:2}]
 const {pizzaDashboard:p}=modulo.exports,s={escola:10,turma:1}
 assert.deepEqual([p(x,'ALITERACAO',s).base,p(x,'ALITERACAO',s).avaliadas,p(x,'ALITERACAO',s).ausentes],[20,4,16])
 assert.equal(p(x,'ALITERACAO',s).resultados[0].percentual,75)
 assert.deepEqual([p(x,'LEITURA',s).base,p(x,'LEITURA',s).avaliadas,p(x,'LEITURA',s).ausentes],[8,6,2])
 const vazio=p(x,'RIMAS',s)
 assert.equal(vazio.avaliadas,0);assert.ok(vazio.resultados.every(r=>r.percentual===null))
})

test('Nome exige completo sem apoio e não transforma o grupo atingido em 100%',()=>{
 const x=d();x.distribuicoesTurmasProjeto=[
 {turmaId:1,item:'NOME_COMPLETO_SEM_APOIO',categoria:'COMPLETO_SEM_APOIO',n:1},
 {turmaId:1,item:'NOME_COMPLETO_SEM_APOIO',categoria:'OUTROS_RESULTADOS_NOME',n:2},
 {turmaId:2,item:'NOME_COMPLETO_SEM_APOIO',categoria:'OUTROS_RESULTADOS_NOME',n:1}]
 const config=modulo.exports.PAINEIS.find(p=>p.id==='nome')
 assert.equal(config.item,'NOME_COMPLETO_SEM_APOIO')
 assert.equal(config.padrao,'COMPLETO_SEM_APOIO')
 const ts=g(x,config.item,config.padrao,'turma')
 assert.ok(Math.abs(ts.find(t=>t.id===1).valor-100/3)<1e-9)
 assert.equal(ts.find(t=>t.id===2).valor,0)
 assert.equal(ts.find(t=>t.id===3).valor,null)
 const p=modulo.exports.pizzaDashboard(x,config.item,{escola:10,turma:1})
 assert.deepEqual([p.base,p.avaliadas,p.ausentes],[4,3,1])
 assert.deepEqual(p.resultados.map(r=>r.n),[1,2])
 assert.equal(p.resultados[0].percentual,33.3)
})

test('Nome compara 15/17 e 17/22 por percentual, mantendo totais 32/39',()=>{
 const x=d();x.pontuacaoTurmasProjeto=x.pontuacaoTurmasProjeto.slice(0,2)
 x.pontuacaoTurmasProjeto[0]={...x.pontuacaoTurmasProjeto[0],base:17}
 x.pontuacaoTurmasProjeto[1]={...x.pontuacaoTurmasProjeto[1],base:22}
 x.distribuicoesTurmasProjeto=[
 {turmaId:1,item:'NOME_COMPLETO_SEM_APOIO',categoria:'COMPLETO_SEM_APOIO',n:15},
 {turmaId:1,item:'NOME_COMPLETO_SEM_APOIO',categoria:'OUTROS_RESULTADOS_NOME',n:2},
 {turmaId:2,item:'NOME_COMPLETO_SEM_APOIO',categoria:'COMPLETO_SEM_APOIO',n:17},
 {turmaId:2,item:'NOME_COMPLETO_SEM_APOIO',categoria:'OUTROS_RESULTADOS_NOME',n:5}]
 const ts=g(x,'NOME_COMPLETO_SEM_APOIO','COMPLETO_SEM_APOIO','turma')
 assert.deepEqual(ts.map(t=>t.id),[1,2])
 assert.equal(Math.round(ts[0].valor*10)/10,88.2);assert.equal(Math.round(ts[1].valor*10)/10,77.3)
 assert.deepEqual(ts.map(t=>[t.n,t.avaliadas]),[[15,17],[17,22]])
 assert.equal(Math.round(r(ts,false).media*10)/10,82.1)
 const pizza=modulo.exports.pizzaDashboard(x,'NOME_COMPLETO_SEM_APOIO',{escola:null,turma:null})
 assert.equal(pizza.resultados[0].n,32);assert.equal(pizza.avaliadas,39)
})
test('rótulos de leitura mudam sem converter ou substituir os códigos registrados',()=>{
 const c=modulo.exports.PAINEIS.find(p=>p.id==='leitura').categorias
 assert.deepEqual(c.slice(0,4),[['NAO_UTILIZA_SONS','Pré-alfabética'],['UTILIZA_ALGUNS_SONS','Alfabética parcial'],['DECODIFICA','Alfabética completa'],['LE_AUTONOMIA','Alfabética consolidada']])
 assert.deepEqual(c[4],['NAO_RESPONDEU','Não respondeu'])
})


test('V2 exige cálculo individual do servidor, mantém zero e rejeita versão antiga',()=>{
 const x=d(),f=modulo.exports.desempenhoAlfabetico
 assert.ok(f(x).every(t=>t.valor===null))
 x.indicesAlfabeticosTurmasProjeto=[{turmaId:1,versao:'APRENDIZAGEM-ALFABETICA-Q1Q9-V2',base:4,completas:2,notas:[100,60,100,100,100,100,100,67,70],mediaExata:79.91,validasPorQuestao:[4,3,4,4,4,4,3,2,4]}]
 const t=f(x)[0]
 assert.equal(t.valor,79.91);assert.equal(t.componentes.length,9)
 assert.ok(Math.abs(t.componentes.reduce((s,c)=>s+c.contribuicao,0)-79.91)<1e-9)
 assert.equal(t.componentes[8].validas,2);assert.equal(t.componentes[8].disponiveis,4)
 x.indicesAlfabeticosTurmasProjeto[0].versao='V1';assert.equal(f(x)[0].valor,null)
 assert.deepEqual(modulo.exports.PESOS_ALFABETICOS.map(p=>p.peso),[.05,.05,.05,.05,.10,.02,.10,.23,.35])
})

test('agrupamento restringe todos os dados e referências, sem modificar o original',()=>{
 const x=d();x.pontuacaoTurmasProjeto.forEach((t,i)=>t.agrupamentoId=i===1?5:4)
 x.distribuicoesTurmasProjeto=[{turmaId:1,item:'LEITURA',categoria:'DECODIFICA',n:4},{turmaId:2,item:'LEITURA',categoria:'DECODIFICA',n:20}]
 x.resumosAgrupamento=[{agrupamentoId:4,total:10,avaliadas:6,naoAvaliadas:4,escolas:2,cobertura:60},{agrupamentoId:5,total:8,avaliadas:2,naoAvaliadas:6,escolas:1,cobertura:25}]
 const {filtrarAgrupamento:f}=modulo.exports,a=f(x,4),b=f(x,5)
 assert.deepEqual(a.pontuacaoTurmasProjeto.map(t=>t.turmaId),[1,3])
 assert.deepEqual(b.pontuacaoTurmasProjeto.map(t=>t.turmaId),[2])
 assert.equal(a.distribuicoesTurmasProjeto.length,1)
 assert.equal(a.resumoProjeto.total,10);assert.equal(b.resumoProjeto.cobertura,25)
 assert.equal(r(g(a,'Q1Q5','INDICE','turma'),true).media,80)
 assert.equal(r(g(b,'Q1Q5','INDICE','turma'),true).media,40)
 assert.equal(modulo.exports.pizzaDashboard(a,'LEITURA',{escola:null,turma:null}).avaliadas,4)
 assert.equal(f(x,null),x);assert.equal(x.pontuacaoTurmasProjeto.length,3)
 assert.equal(f(x,999).pontuacaoTurmasProjeto.length,0)
})
test('colunas do índice preservam ordenação e média entre turmas classificadas',()=>{
 const x=d()
 x.indicesAlfabeticosTurmasProjeto=[80,40].map((v,i)=>({turmaId:i+1,versao:'APRENDIZAGEM-ALFABETICA-Q1Q9-V2',base:4,completas:2,notas:Array(9).fill(v),mediaExata:v,validasPorQuestao:Array(9).fill(2)}))
 const grupos=modulo.exports.gruposDesempenho(x),refs=r(grupos,true)
 assert.deepEqual(grupos.map(t=>t.id),[1,2,3])
 assert.equal(grupos[2].valor,null)
 assert.equal(refs.grupos,2);assert.ok(Math.abs(refs.media-(grupos[0].valor+grupos[1].valor)/2)<1e-9)
 assert.equal(refs.maior,grupos[0].valor);assert.equal(refs.menor,grupos[1].valor)
})

test('cinco painéis: consciência inclui participantes parciais proporcionalmente, sem mudar índice V2',()=>{
 const x=d();x.conscienciaParticipantesTurmas=[{turmaId:1,participantes:4,mediaExata:75},{turmaId:2,participantes:2,mediaExata:0},{turmaId:3,participantes:0,mediaExata:null}]
 const grupos=g(x,'Q1Q5','INDICE','escola')
 assert.equal(grupos[0].avaliadas,6);assert.equal(grupos[0].valor,50)
 assert.equal(r(g(x,'Q1Q5','INDICE','turma'),true).media,50)
 assert.equal(modulo.exports.desempenhoAlfabetico(x)[0].valor,null)
})
