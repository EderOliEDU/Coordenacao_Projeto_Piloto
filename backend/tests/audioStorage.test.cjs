// Executar após npm run build: node --test tests/audioStorage.test.cjs
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { findReadableAudioPath, resolveAudioPath } = require('../dist/services/audioStorage')

test('áudio de produção é consultado apenas quando não há gravação local', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fonica-audio-test-'))
  const local = path.join(root, 'dev')
  const production = path.join(root, 'prod')
  const relative = 'fase-3/aplicacao-1/palavra-1.webm'
  const source = resolveAudioPath(production, relative)
  try {
    await fs.mkdir(path.dirname(source), { recursive: true })
    await fs.writeFile(source, 'audio-original-producao')
    await t.test('reprodução usa a referência de produção sem copiá-la para o DEV', async () => {
      assert.equal(await findReadableAudioPath(relative, local, production), source)
      await assert.rejects(fs.stat(resolveAudioPath(local, relative)), { code: 'ENOENT' })
    })
    await t.test('novas gravações locais prevalecem e não modificam produção', async () => {
      const target = resolveAudioPath(local, relative)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, 'audio-teste-dev')
      assert.equal(await findReadableAudioPath(relative, local, production), target)
      assert.equal(await fs.readFile(source, 'utf8'), 'audio-original-producao')
      await fs.unlink(target)
      assert.equal(await findReadableAudioPath(relative, local, production), source)
    })
    await t.test('arquivo ausente retorna null e a configuração sem referência continua funcionando', async () => {
      assert.equal(await findReadableAudioPath(relative, local), null)
      assert.equal(await findReadableAudioPath('inexistente.webm', local, production), null)
    })
    await t.test('caminhos que escapam dos diretórios são rejeitados', async () => {
      for (const relative of ['../segredo', '/etc/passwd', 'fase-3/../../../etc/passwd', '']) {
        assert.throws(() => resolveAudioPath(local, relative), /Caminho de áudio inválido/)
        await assert.rejects(findReadableAudioPath(relative, local, production), /Caminho de áudio inválido/)
      }
    })
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
