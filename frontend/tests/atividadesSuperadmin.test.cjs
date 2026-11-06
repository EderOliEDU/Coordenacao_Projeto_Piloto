const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const modulo={exports:{}}
const fonte=fs.readFileSync(path.join(__dirname,'../src/atividadesSuperadmin.ts'),'utf8')
const js=ts.transpileModule(fonte,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
new Function('exports','module',js)(modulo.exports,modulo)
const {agruparAtividades,chaveRegistro}=modulo.exports
const item=(extra={})=>({alunoId:'10',alunoNome:'Aluno teste',cpf:'11111111111',status:'NÃO INICIADO',aplicacaoId:null,...extra})

test('dois responsáveis geram uma linha por aluno sem perder o formulário preenchido',()=>{
 const preenchido=item({cpf:'22222222222',status:'FINALIZADO'})
 const grupos=agruparAtividades([item(),preenchido,item({alunoId:'20',alunoNome:'Outro aluno'})])
 assert.equal(grupos.length,2)
 assert.equal(grupos[0].registros.length,2)
 assert.equal(grupos[0].registros.find(r=>chaveRegistro(r)===chaveRegistro(preenchido)),preenchido)
})
test('preserva verificações diferentes do mesmo aluno, inclusive cancelada e concluída',()=>{
 const grupos=agruparAtividades([item({status:'CANCELADA',aplicacaoId:'30'}),item({status:'CONCLUIDA',aplicacaoId:'31'})])
 assert.equal(grupos.length,1)
 assert.deepEqual(grupos[0].registros.map(r=>r.aplicacaoId),['30','31'])
})
test('elimina repetição do mesmo vínculo, sem juntar alunos homônimos',()=>{
 const grupos=agruparAtividades([item(),item({cpf:'111.111.111-11'}),item({alunoId:'20'})])
 assert.equal(grupos.length,2)
 assert.equal(grupos[0].registros.length,1)
})
test('identifica registros com segurança e aceita turma sem alunos',()=>{
 assert.deepEqual(agruparAtividades([]),[])
 assert.notEqual(chaveRegistro(item()),chaveRegistro(item({aplicacaoId:'30'})))
 assert.notEqual(chaveRegistro(item()),chaveRegistro(item({cpf:'22222222222'})))
})
