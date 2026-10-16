const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const code = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/session.ts'),'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText
function storage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return { getItem: key => data.get(key) ?? null, setItem: (key,value) => data.set(key,String(value)), removeItem: key => data.delete(key) }
}
function browser(options = {}) {
  let now = 1000000
  const local = storage({token:'legado',professor:'{}',menuRecolhido:'true'})
  const session = options.session || storage()
  const events = {}, calls = [], redirects = []
  let timer
  const window = {
    fetch: async (input,init={}) => {
      calls.push({input:String(input),init})
      const status = String(input).includes('/protected') ? 401 : 200
      return new Response(JSON.stringify({idleTimeoutSeconds:1800}),{status,headers:{'Content-Type':'application/json'}})
    },
    location:{origin:'https://dev.example',replace: path=>redirects.push(path)},
    setInterval: callback=>{timer=callback},
    addEventListener: (name,callback)=>{events[name]=callback}
  }
  const exports = {}
  vm.runInNewContext(code,{exports,window,sessionStorage:session,localStorage:local,
    document:{hidden:false,addEventListener(){}},Date:class extends Date {static now(){return now}},
    Headers,Request,Response,URL})
  exports.initializeSession()
  return {exports,session,local,events,calls,redirects,window,
    advance: milliseconds=>{now+=milliseconds}, tick:()=>timer(),flush:()=>new Promise(resolve=>setImmediate(resolve))}
}
const login = b => b.exports.startSession({token:'novo-token',professor:{nome:'Teste'},session:{idleTimeoutSeconds:1800}})

test('token usa armazenamento da aba; dados de login antigos são descartados',()=>{
  const b=browser();login(b)
  assert.equal(b.local.getItem('token'),null)
  assert.equal(b.local.getItem('professor'),null)
  assert.equal(b.local.getItem('menuRecolhido'),'true')
  assert.equal(b.session.getItem('token'),'novo-token')
  const closed=browser()
  assert.equal(closed.session.getItem('token'),null)
})
test('sinal periódico não renova atividade; 30 minutos ociosos encerram e revogam',async()=>{
  const b=browser();login(b)
  const start=b.session.getItem('sessionActivity')
  b.advance(15000);b.tick();await b.flush()
  b.advance(60000);b.tick();await b.flush()
  const heartbeats=b.calls.filter(c=>c.input.includes('/heartbeat'))
  assert.equal(JSON.parse(heartbeats[0].init.body).activity,true)
  assert.equal(JSON.parse(heartbeats[1].init.body).activity,false)
  assert.equal(b.session.getItem('sessionActivity'),start)
  b.advance(30*60000);b.tick();await b.flush()
  assert.equal(b.session.getItem('token'),null)
  assert.equal(b.redirects.length,1)
  assert.ok(b.calls.some(c=>c.input.includes('/logout')&&c.init.keepalive===true))
})
test('interação real renova o prazo; interação depois do prazo não recupera a sessão',()=>{
  const b=browser();login(b)
  b.advance(10*60000);b.events.keydown({isTrusted:true})
  const activity=b.session.getItem('sessionActivity')
  b.advance(1000);b.events.keydown({isTrusted:false})
  assert.equal(b.session.getItem('sessionActivity'),activity)
  b.advance(30*60000);b.events.pointerdown({isTrusted:true})
  assert.equal(b.session.getItem('token'),null)
})
test('atualizar a página conserva a sessão válida sem simular atividade',async()=>{
  const b=browser();login(b)
  const refreshed=browser({session:b.session});await refreshed.flush()
  assert.equal(refreshed.session.getItem('token'),'novo-token')
  assert.equal(JSON.parse(refreshed.calls.find(c=>c.input.includes('/heartbeat')).init.body).activity,false)
})
test('401 de uma requisição autenticada encerra a sessão em páginas que usam fetch',async()=>{
  const b=browser();login(b)
  await b.window.fetch('/api/protected',{headers:{Authorization:'Bearer novo-token'}})
  assert.equal(b.session.getItem('token'),null)
  assert.equal(b.redirects.length,1)
})
