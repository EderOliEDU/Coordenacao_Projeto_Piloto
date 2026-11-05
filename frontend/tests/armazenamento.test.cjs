const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/components/GraficoArmazenamento.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
const out={};vm.runInNewContext(code,{exports:out,require});
const GiB=1024**3,d={discos:[{nome:'Mídias',total:100*GiB,disponivel:40*GiB,ocupado:60*GiB,nivel:'normal'}],historico:[]};
const html=dados=>renderToStaticMarkup(React.createElement(out.default,{dados}));
test('gráfico usa só o disco de mídias, sem somar montagens do mesmo filesystem',()=>{
 const s=html({...d,discos:[...d.discos,...d.discos,...d.discos]});assert.match(s,/60%/);assert.match(s,/40 GiB disponíveis/);assert.doesNotMatch(s,/300 GiB/);assert.match(s,/Não há dados anteriores registrados/);
});
test('histórico de um ponto é exibido sem datas ou valores artificiais e sem coordenadas inválidas',()=>{
 const s=html({...d,historico:[{coletadoEm:new Date().toISOString(),total:100*GiB,disponivel:40*GiB,audiosBytes:GiB,fotosBytes:GiB/2,audiosQuantidade:10,fotosQuantidade:2}]});assert.match(s,/polyline/);assert.doesNotMatch(s,/NaN|Infinity/);assert.match(s,/Consultar os dados do gráfico/);
});
