const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
const {renderToStaticMarkup}=require('react-dom/server')
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/components/QuestaoNome.tsx'),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}
}).outputText
function screen(extra={}){
  let state
  const calls=[],out={}
  vm.runInNewContext(code,{exports:out,require:n=>n==='react'?{useState:initial=>{
    if(state===undefined)state=initial
    return [state,value=>{state=value}]
  }}:require(n)})
  const props={opcoes:[{idOpcao:'1',codigo:'COM_APOIO',descricao:'Com apoio'},{idOpcao:'2',codigo:'SEM_APOIO',descricao:'Sem apoio'},{idOpcao:'3',codigo:'NAO_ESCREVE',descricao:'Não escreve'}],nomeEscrito:null,disabled:false,salvando:false,
    onPendente:()=>calls.push('pendente'),onSalvar:(...args)=>calls.push(args),...extra}
  const tree=()=>out.default(props)
  const html=()=>renderToStaticMarkup(tree())
  function button(label){let found;function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n?.props)return;if(n.type==='button'&&n.props.children===label)found=n;walk(n.props.children)}walk(tree());assert.ok(found,label);return found}
  return {html,button,calls}
}
test('com e sem apoio oferecem os mesmos três complementos antes de salvar',()=>{
  const s=screen();assert.doesNotMatch(s.html(),/Quanto do nome/)
  s.button('Com apoio').props.onClick();assert.deepEqual(s.calls,['pendente'])
  for(const label of ['Só o nome','Nome composto','Nome completo'])assert.ok(s.button(label))
  s.button('Nome completo').props.onClick();assert.deepEqual(s.calls[1],['1','NOME_COMPLETO'])
  s.button('Sem apoio').props.onClick();assert.ok(s.button('Só o nome'))
  s.button('Só o nome').props.onClick();assert.deepEqual(s.calls.at(-1),['2','NOME'])
  s.button('Nome composto').props.onClick();assert.deepEqual(s.calls.at(-1),['2','NOME_COMPOSTO'])
})
test('não escreve salva sem detalhe; histórico não recebe complemento inventado',()=>{
  const s=screen();s.button('Não escreve').props.onClick();assert.deepEqual(s.calls,['pendente',['3',null]])
  const old=screen({respostaId:'1',disabled:true});assert.match(old.html(),/Detalhamento não registrado/);assert.match(old.html(),/disabled=""/)
})
