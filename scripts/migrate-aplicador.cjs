// Executar dentro do contêiner backend, com o repositório montado em /release.
// Cria estruturas e insere somente parâmetros ausentes. Não copia dados de alunos.
const fs = require('fs');
const path = require('path');
const { getPgPool } = require('/app/dist/services/pgPool');
const root = path.resolve(__dirname, '..');
const pool = getPgPool();
const dryRun = process.argv.includes('--dry-run');

(async () => {
  const client = await pool.connect();
  try {
    const needed = ['alunos', 'turmas', 'professores', 'usuarios_acessos', 'avaliacao_fases'];
    for (const name of needed) {
      const r = await client.query('SELECT to_regclass($1) AS tabela', ['public.' + name]);
      if (!r.rows[0].tabela) throw new Error('Pré-requisito ausente: public.' + name);
    }
    const config = JSON.parse(fs.readFileSync(path.join(root, 'docs/migracoes-prod/2026-10-13-parametros-aplicador.json'), 'utf8'));
    const sql = fs.readFileSync(path.join(root, 'docs/migracoes-prod/2026-10-13-avaliacao-aplicador.sql'), 'utf8')
      .replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '');
    await client.query('BEGIN');
    await client.query(sql);
    let perguntas = 0, opcoes = 0, palavras = 0;
    for (const q of config.perguntas) {
      const r = await client.query(`INSERT INTO public.avaliacao_aplicador_perguntas (codigo,ordem,habilidade,pergunta,ativo)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT (codigo) DO NOTHING`, [q.codigo,q.ordem,q.habilidade,q.pergunta,q.ativo]);
      perguntas += r.rowCount;
    }
    for (const o of config.opcoes) {
      const q = await client.query('SELECT id_pergunta FROM public.avaliacao_aplicador_perguntas WHERE codigo=$1', [o.pergunta_codigo]);
      const r = await client.query(`INSERT INTO public.avaliacao_aplicador_opcoes (id_pergunta,codigo,descricao,detalhamento,ordem,ativo)
        VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id_pergunta,codigo) DO NOTHING`, [q.rows[0].id_pergunta,o.codigo,o.descricao,o.detalhamento,o.ordem,o.ativo]);
      opcoes += r.rowCount;
    }
    for (const word of config.palavras) {
      const r = await client.query(`INSERT INTO public.avaliacao_aplicador_leitura_palavras (palavra,ordem,ativo)
        VALUES ($1,$2,$3) ON CONFLICT (palavra) DO NOTHING`, [word.palavra,word.ordem,word.ativo]);
      palavras += r.rowCount;
    }
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    console.log(JSON.stringify({ dryRun, perguntasInseridas: perguntas, opcoesInseridas: opcoes, palavrasInseridas: palavras }));
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
