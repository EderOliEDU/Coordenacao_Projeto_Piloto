const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const exportsComponent = {}
const code = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/components/QuestaoVogais.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 }
}).outputText
vm.runInNewContext(code, { exports: exportsComponent, require })
const Component = exportsComponent.default
const respostas = valores => ['A','E','I','O','U'].map((vogal, i) => ({ vogal, acertou: valores[i] ?? null, origem: 'NOVO' }))
const render = (valores, options = {}) => renderToStaticMarkup(React.createElement(Component, {
  respostas: respostas(valores), versao: 2, disabled: false, salvando: false, onResponder() {}, ...options
}))
const visiveis = html => [...html.matchAll(/<legend[^>]*>Vogal ([AEIOU])<\/legend>/g)].map(m => m[1])

test('inicia com A e libera a próxima somente após SIM ou NÃO salvo', () => {
  assert.deepEqual(visiveis(render([])), ['A'])
  assert.deepEqual(visiveis(render([false])), ['A','E'])
  assert.deepEqual(visiveis(render([false,true])), ['A','E','I'])
  assert.deepEqual(visiveis(render([false,true,false,true])), ['A','E','I','O','U'])
  assert.deepEqual(visiveis(render([true,true,true,true,true])), ['A','E','I','O','U'])
})
test('oferece somente SIM e NÃO e bloqueia os botões enquanto salva', () => {
  const html = render([], { salvando: true })
  assert.equal((html.match(/<button /g) || []).length, 2)
  assert.match(html, /<fieldset[^>]*disabled/)
  assert.doesNotMatch(html, /Não avaliada|Vogais não avaliadas não contam como erro/)
})
test('conferência de avaliação antiga mostra a vogal registrada sem exigir as outras', () => {
  const html = render([null,null,null,false], { disabled: true, versao: 1 })
  assert.deepEqual(visiveis(html), ['O'])
  assert.match(html, /aria-pressed="true"/)
  assert.match(html, /<fieldset[^>]*disabled/)
})
