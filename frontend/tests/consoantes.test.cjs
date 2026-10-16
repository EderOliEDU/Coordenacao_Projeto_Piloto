const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const component = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/QuestaoConsoantes.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 }
}).outputText, { exports: component, require })
const props = { letra: '', resposta: undefined, opcoes: [{ idOpcao: 'sim', codigo: 'SIM' }, { idOpcao: 'nao', codigo: 'NAO' }],
  disabled: false, salvando: false, onSelecionar() {}, onResponder() {} }
const render = extra => renderToStaticMarkup(React.createElement(component.default, { ...props, ...extra }))

test('cada consoante apresenta sua página do PDF e os limiares exatos de SIM/NÃO', () => {
  for (const letra of component.CONSOANTES) {
    const html = render({ letra })
    assert.match(html, new RegExp(`src="/questao5-consoantes/${letra}.jpg"`))
    assert.equal((html.match(/<img /g) || []).length, 1)
    assert.match(html, /Acertou 3 ou mais figuras/)
    assert.match(html, /Acertou 2 ou menos figuras/)
    assert.ok(fs.statSync(path.join(__dirname, `../public/questao5-consoantes/${letra}.jpg`)).size > 0)
  }
})
test('antes de escolher não apresenta imagem e bloqueia a resposta; salvamento e conferência bloqueiam edição', () => {
  const html = render({})
  assert.doesNotMatch(html, /<img /)
  assert.match(html, /<fieldset disabled=""/)
  assert.equal((render({ letra: 'B', salvando: true }).match(/<fieldset disabled=""/g) || []).length, 2)
  assert.equal((render({ letra: 'B', disabled: true }).match(/<fieldset disabled=""/g) || []).length, 2)
})
test('SIM e NÃO são ligados aos IDs corretos das opções cadastradas', () => {
  const calls = []
  const tree = component.default({ ...props, letra: 'Z', onResponder: id => calls.push(id) })
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node?.props) return
    if (node.type === 'button' && typeof node.props['aria-pressed'] === 'boolean'
      && node.props.children?.[0]?.type === 'strong') node.props.onClick()
    visit(node.props.children)
  }
  visit(tree)
  assert.deepEqual(calls, ['sim', 'nao'])
})
