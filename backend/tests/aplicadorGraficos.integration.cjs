// Integração DEV somente leitura; não cria fixtures nem modifica o banco.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { Pool } = require('pg')
const dotenv = require('dotenv')
const poolModule = require('../dist/services/pgPool')
const { carregarGraficosAplicador } = require('../dist/services/aplicadorGraficos')
const { carregarRelatorioTerceiraAvaliacao } = require('../dist/services/relatorioTerceiraAvaliacao')

test('Gráficos com PostgreSQL real: totais, versões, Q2 sem duplicação e filtros', async () => {
  const env = dotenv.parse(fs.readFileSync(__dirname + '/../.env_dev'))
  const pool = new Pool({ host: env.PILOTO_PG_HOST, port: Number(env.PILOTO_PG_PORT) || 5432,
    database: env.PILOTO_PG_DB || env.PILOTO_PG_DATABASE, user: env.PILOTO_PG_USER,
    password: env.PILOTO_PG_PASSWORD, connectionTimeoutMillis: 5000,
    options: '-c default_transaction_read_only=on' })
  const saved = poolModule.getPgPool
  poolModule.getPgPool = () => pool
  try {
    const d = await carregarGraficosAplicador({})
    const expected = await pool.query(`SELECT count(*)::int AS n FROM public.avaliacao_aplicador_aplicacoes
      WHERE id_fase=$1 AND status='CONCLUIDA'`, [d.filtros.faseId])
    assert.equal(d.resumo.concluidas, expected.rows[0].n)
    assert.equal(d.versoes.reduce((s, v) => s + v.total, 0), d.resumo.concluidas)
    assert.ok(d.perguntas.every(r => r.codigo !== 'ALITERACAO'))
    assert.equal(new Set(d.classificacaoTurmas.map(r => `${r.versao}/${r.turmaId}`)).size, d.classificacaoTurmas.length)
    for (const turma of d.classificacaoTurmas) {
      assert.ok(Array.isArray(turma.professoras))
      const referencia = await pool.query(`WITH unicas AS (SELECT DISTINCT ON (id_aluno,versao_instrumento) *
        FROM public.avaliacao_aplicador_aplicacoes WHERE id_fase=$1 AND status='CONCLUIDA'
        ORDER BY id_aluno,versao_instrumento,concluido_em DESC NULLS LAST,id_aplicacao DESC)
        SELECT count(*)::int AS n FROM unicas WHERE id_turma=$2 AND versao_instrumento=$3`, [d.filtros.faseId,turma.turmaId,turma.versao])
      assert.equal(turma.criancas, referencia.rows[0].n)
      assert.equal(turma.resultados.length,8)
      const escrita = await pool.query(`WITH unicas AS (SELECT DISTINCT ON (id_aluno,versao_instrumento) *
        FROM public.avaliacao_aplicador_aplicacoes WHERE id_fase=$1 AND status='CONCLUIDA'
        ORDER BY id_aluno,versao_instrumento,concluido_em DESC NULLS LAST,id_aplicacao DESC)
        SELECT p.codigo,count(*)::int AS avaliadas,count(*) FILTER (WHERE
          (p.codigo='ESCRITA_NOME' AND o.codigo='SEM_APOIO') OR
          (p.codigo='NIVEL_ESCRITA' AND o.codigo IN ('ALFABETICA_COMPLETA','ALFABETICA_CONSOLIDADA')))::int AS positivas
        FROM unicas a JOIN public.avaliacao_aplicador_respostas r USING(id_aplicacao)
        JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
        JOIN public.avaliacao_aplicador_opcoes o ON o.id_opcao=r.id_opcao AND o.id_pergunta=r.id_pergunta
        WHERE a.id_turma=$2 AND a.versao_instrumento=$3 AND p.codigo IN ('ESCRITA_NOME','NIVEL_ESCRITA')
        GROUP BY p.codigo`, [d.filtros.faseId,turma.turmaId,turma.versao])
      for (const codigo of ['ESCRITA_NOME','NIVEL_ESCRITA']) {
        const q = turma.resultados.find(q => q.codigo===codigo)
        const ref = escrita.rows.find(r => r.codigo===codigo)
        assert.equal(q.avaliadas,ref?.avaliadas || 0);assert.equal(q.sim,ref?.positivas || 0)
        assert.equal(q.ausentes,turma.criancas-q.avaliadas)
        assert.equal(q.categorias.reduce((s,r)=>s+r.n,0),q.avaliadas)
        if(!q.avaliadas) assert.equal(q.percentual,null)
      }
      const q7 = turma.resultados.find(q=>q.codigo==='ESCRITA_NOME')
      assert.equal(q7.detalhesNome.reduce((s,r)=>s+r.n,0),q7.categorias.filter(r=>r.codigo!=='NAO_ESCREVE').reduce((s,r)=>s+r.n,0))

      assert.ok(turma.indice === null || turma.indice >= 0 && turma.indice <= 100)
    }

    assert.ok(d.vogais.every(r => !Object.hasOwn(r, 'origem')))
    assert.equal(new Set(d.vogais.map(r => `${r.versao}/${r.vogal}/${r.acertou}`)).size, d.vogais.length)
    const vogaisEsperadas = await pool.query(`SELECT a.versao_instrumento AS versao,v.vogal,v.acertou,count(*)::int AS n
      FROM public.avaliacao_aplicador_vogais v JOIN public.avaliacao_aplicador_aplicacoes a USING(id_aplicacao)
      JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
      WHERE a.id_fase=$1 AND a.status='CONCLUIDA' AND p.codigo='ALITERACAO' AND v.acertou IS NOT NULL
      GROUP BY 1,2,3 ORDER BY 1,2,3`, [d.filtros.faseId])
    assert.deepEqual(d.vogais.filter(r => r.acertou !== null), vogaisEsperadas.rows)

    for (const v of d.versoes) {
      for (const vogal of 'AEIOU') {
        assert.equal(d.vogais.filter(r => r.versao === v.versao && r.vogal === vogal).reduce((s, r) => s + r.n, 0), v.total)
      }
      const selected = await carregarGraficosAplicador({ faseId: d.filtros.faseId, versao: v.versao })
      assert.equal(selected.resumo.concluidas, v.total)
      assert.ok(selected.classificacaoTurmas.every(t => t.versao === v.versao))
      assert.ok(selected.leitura.every(r => r.versao === v.versao && r.comMetadadosAudio <= r.n))
    }
    const relatorio = await carregarRelatorioTerceiraAvaliacao()
    const unicas = await pool.query(`SELECT count(DISTINCT id_aluno)::int AS n FROM public.avaliacao_aplicador_aplicacoes
      WHERE id_fase=$1 AND status='CONCLUIDA'`, [relatorio.filtros.faseId])
    assert.equal(relatorio.base, unicas.rows[0].n)
    const indice = relatorio.indiceQ1Q5
    assert.equal(indice.base,relatorio.base)
    const turmasProjeto=await pool.query(`SELECT t.id_turma,e.id_escola FROM public.turmas t
      JOIN public.escolas e USING(id_escola) JOIN public.etapas et USING(id_etapa)
      WHERE e.projeto='PJINSTFONI' AND et.projeto='PJINSTFONI'`)
    const idsTurmasProjeto=new Set(turmasProjeto.rows.map(t=>t.id_turma)),idsEscolasProjeto=new Set(turmasProjeto.rows.map(t=>t.id_escola))
    assert.ok(relatorio.pontuacaoTurmasProjeto.every(t=>idsTurmasProjeto.has(t.turmaId)&&idsEscolasProjeto.has(t.escolaId)))
    assert.ok(relatorio.distribuicoesTurmasProjeto.every(r=>idsTurmasProjeto.has(r.turmaId)))
    assert.ok(relatorio.filtros.escolas.every(e=>idsEscolasProjeto.has(e.id)))

    for(const id of [4,5]){
      const resumo=relatorio.resumosAgrupamento.find(r=>r.agrupamentoId===id)
      const cadastro=await pool.query(`SELECT count(DISTINCT ea.id_aluno)::int AS total,
        count(DISTINCT t.id_escola)::int AS escolas,
        count(DISTINCT ea.id_aluno) FILTER(WHERE EXISTS(
          SELECT 1 FROM public.avaliacao_aplicador_aplicacoes a JOIN public.turmas ta ON ta.id_turma=a.id_turma
          WHERE a.id_aluno=ea.id_aluno AND a.id_fase=$1 AND a.status='CONCLUIDA' AND ta.id_etapa=$2
        ))::int AS avaliadas
        FROM public.enturmacao_aluno ea JOIN public.alunos al USING(id_aluno)
        JOIN public.turmas t USING(id_turma) JOIN public.escolas e USING(id_escola) JOIN public.etapas et USING(id_etapa)
        WHERE e.projeto='PJINSTFONI' AND et.projeto='PJINSTFONI' AND t.id_etapa=$2`,[relatorio.filtros.faseId,id])
      assert.deepEqual([resumo.total,resumo.avaliadas,resumo.escolas],[cadastro.rows[0].total,cadastro.rows[0].avaliadas,cadastro.rows[0].escolas])
      assert.equal(resumo.naoAvaliadas,resumo.total-resumo.avaliadas)
      const esperado=await pool.query(`WITH ultimas AS (SELECT DISTINCT ON(id_aluno) * FROM public.avaliacao_aplicador_aplicacoes WHERE id_fase=$1 AND status='CONCLUIDA' ORDER BY id_aluno,concluido_em DESC NULLS LAST,id_aplicacao DESC)
        SELECT count(*)::int AS n FROM ultimas a JOIN public.turmas t USING(id_turma) JOIN public.escolas e USING(id_escola) JOIN public.etapas et USING(id_etapa)
        WHERE e.projeto='PJINSTFONI' AND et.projeto='PJINSTFONI' AND t.id_etapa=$2`,[relatorio.filtros.faseId,id])
      assert.equal(relatorio.pontuacaoTurmasProjeto.filter(t=>t.agrupamentoId===id).reduce((s,t)=>s+t.base,0),esperado.rows[0].n)
    }
    assert.ok(relatorio.pontuacaoTurmasProjeto.every(t=>[4,5].includes(t.agrupamentoId)))
    const rp=relatorio.resumoProjeto
    assert.equal(rp.total,rp.avaliadas+rp.naoAvaliadas)
    assert.ok(rp.avaliadas>=0&&rp.avaliadas<=rp.total)
    assert.equal(rp.cobertura,rp.total?rp.avaliadas/rp.total*100:null)
    const cadastro=await pool.query(`SELECT count(DISTINCT ea.id_aluno)::int AS total,count(DISTINCT t.id_escola)::int AS escolas,
      count(DISTINCT ea.id_aluno) FILTER (WHERE a.id_aluno IS NOT NULL)::int AS avaliadas
      FROM public.enturmacao_aluno ea JOIN public.alunos al USING(id_aluno)
      JOIN public.turmas t USING(id_turma) JOIN public.escolas e USING(id_escola) JOIN public.etapas et USING(id_etapa)
      LEFT JOIN (SELECT DISTINCT id_aluno FROM public.avaliacao_aplicador_aplicacoes WHERE id_fase=$1 AND status='CONCLUIDA') a ON a.id_aluno=ea.id_aluno
      WHERE e.projeto='PJINSTFONI' AND et.projeto='PJINSTFONI'`,[relatorio.filtros.faseId])
    assert.deepEqual([rp.total,rp.avaliadas,rp.escolas],[cadastro.rows[0].total,cadastro.rows[0].avaliadas,cadastro.rows[0].escolas])

    const conferirPizzas=report=>{
      const ids=new Set(report.pontuacaoTurmasProjeto.filter(t=>(!report.filtros.escolaId||t.escolaId===report.filtros.escolaId)&&(!report.filtros.turmaId||t.turmaId===report.filtros.turmaId)).map(t=>t.turmaId))
      for(const [item,q] of [['RIMAS','Q1'],['CONSCIENCIA_PALAVRAS','Q3'],['CONSCIENCIA_SILABICA','Q4'],['RELACAO_LETRA_SOM','Q5'],['NIVEL_ESCRITA','Q8'],['ESCRITA_NOME','Q7'],['LETRAS_NUMEROS','Q6']]){
        const rs=report.distribuicoesTurmasProjeto.filter(r=>ids.has(r.turmaId)&&r.item===item),linha=report.linhas.find(l=>l.item===q)
        assert.equal(rs.reduce((s,r)=>s+r.n,0),linha.avaliadas)
        for(const categoria of linha.resultados)assert.equal(rs.filter(r=>r.categoria===categoria.codigo).reduce((s,r)=>s+r.n,0),categoria.n)
      }
      const nome=report.distribuicoesTurmasProjeto.filter(r=>ids.has(r.turmaId)&&r.item==='NOME_COMPLETO_SEM_APOIO')
      const q7=report.linhas.find(l=>l.item==='Q7')
      const completo=q7.detalhesNome.find(r=>r.tipo==='Nome completo')
      const semTipo=q7.detalhesNome.find(r=>r.tipo==='Tipo de nome não informado')
      assert.equal(nome.filter(r=>r.categoria==='COMPLETO_SEM_APOIO').reduce((s,r)=>s+r.n,0),completo.semApoio)
      assert.equal(nome.reduce((s,r)=>s+r.n,0),q7.avaliadas-semTipo.total)
      const q2=report.distribuicoesTurmasProjeto.filter(r=>ids.has(r.turmaId)&&r.item==='ALITERACAO')
      assert.equal(q2.reduce((s,r)=>s+r.n,0),report.linhas.filter(l=>/^Q2-[AEIOU]$/.test(l.item)).reduce((s,l)=>s+l.avaliadas,0))
    }
    conferirPizzas(relatorio)

    for(const [item,questao] of [['NIVEL_ESCRITA','Q8'],['ESCRITA_NOME','Q7'],['LETRAS_NUMEROS','Q6']]){
      const linha=relatorio.linhas.find(l=>l.item===questao)
      const rs=relatorio.distribuicoesTurmasProjeto.filter(r=>r.item===item)
      assert.equal(rs.reduce((s,r)=>s+r.n,0),linha.avaliadas)
      for(const cat of linha.resultados)assert.equal(rs.filter(r=>r.categoria===cat.codigo).reduce((s,r)=>s+r.n,0),cat.n)
    }
    assert.equal(relatorio.distribuicoesTurmasProjeto.filter(r=>r.item==='LEITURA').reduce((s,r)=>s+r.n,0),
      relatorio.linhas.filter(l=>l.item.startsWith('Q9-')).reduce((s,l)=>s+l.avaliadas,0))

    assert.equal(relatorio.pontuacaoTurmasProjeto.reduce((s,t)=>s+t.base,0),relatorio.base)
    assert.equal(relatorio.pontuacaoTurmasProjeto.reduce((s,t)=>s+t.completas,0),indice.completas)
    assert.equal(new Set(relatorio.pontuacaoTurmasProjeto.map(t=>t.turmaId)).size,relatorio.pontuacaoTurmasProjeto.length)
    let anterior=Infinity
    for(const t of relatorio.pontuacaoTurmasProjeto){
      const valor=t.mediaExata??-Infinity
      assert.ok(valor<=anterior);anterior=valor
      assert.ok(Array.isArray(t.professoras));assert.ok(!t.turma.includes(' · '))
      const local=relatorio.indiceQ1Q5Turmas.find(l=>l.turmaId===t.turmaId)
      assert.equal(t.mediaExata,local.mediaExata)
    }

    const conferirGrupos=(report,grupos)=>{
      assert.equal(grupos.reduce((s,g)=>s+g.base,0),report.base)
      assert.equal(grupos.reduce((s,g)=>s+g.completas,0),report.indiceQ1Q5.completas)
      const n=grupos.reduce((s,g)=>s+g.completas,0)
      const soma=grupos.reduce((s,g)=>s+(g.mediaExata||0)*g.completas,0)
      if(n)assert.ok(Math.abs(soma/n-report.indiceQ1Q5.mediaExata)<1e-9)
      else assert.equal(report.indiceQ1Q5.mediaExata,null)
    }
    conferirGrupos(relatorio,relatorio.indiceQ1Q5Escolas)
    conferirGrupos(relatorio,relatorio.indiceQ1Q5Turmas)

    assert.equal(relatorio.indiceQ1Q5Escolas.reduce((s,e)=>s+e.base,0),relatorio.base)
    assert.equal(relatorio.indiceQ1Q5Escolas.reduce((s,e)=>s+e.completas,0),indice.completas)
    assert.equal(new Set(relatorio.indiceQ1Q5Escolas.map(e=>e.escolaId)).size,relatorio.indiceQ1Q5Escolas.length)

    assert.equal(indice.completas + indice.incompletas,indice.base)
    // Referência independente: respostas individuais, sem imprimir identidades.
    const individuais = await pool.query(`WITH ultimas AS (
      SELECT DISTINCT ON (id_aluno) * FROM public.avaliacao_aplicador_aplicacoes
      WHERE id_fase=$1 AND status='CONCLUIDA'
      ORDER BY id_aluno,concluido_em DESC NULLS LAST,id_aplicacao DESC)
      SELECT a.id_turma,(SELECT t.id_escola FROM public.turmas t WHERE t.id_turma=a.id_turma) AS escola_id,
        (SELECT jsonb_agg(jsonb_build_object('questao',p.codigo,'resposta',o.codigo))
         FROM public.avaliacao_aplicador_respostas r
         JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
         LEFT JOIN public.avaliacao_aplicador_opcoes o ON o.id_opcao=r.id_opcao AND o.id_pergunta=r.id_pergunta
         WHERE r.id_aplicacao=a.id_aplicacao) AS respostas,
        (SELECT jsonb_agg(jsonb_build_object('vogal',v.vogal,'acertou',v.acertou))
         FROM public.avaliacao_aplicador_vogais v JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
         WHERE v.id_aplicacao=a.id_aplicacao AND p.codigo='ALITERACAO') AS vogais
      FROM ultimas a`,[relatorio.filtros.faseId])
    const escores=[], referenciaPorTurma=new Map(), referenciaPorEscola=new Map()
    for(const row of individuais.rows){
      const pontos=['RIMAS','CONSCIENCIA_PALAVRAS','CONSCIENCIA_SILABICA','RELACAO_LETRA_SOM'].map(c=>{
        const rs=(row.respostas||[]).filter(r=>r.questao===c)
        return rs.length===1 && ['SIM','NAO'].includes(rs[0].resposta) ? Number(rs[0].resposta==='SIM') : null
      })
      const vs=(row.vogais||[]).filter(v=>'AEIOU'.split('').includes(v.vogal))
      if(pontos.some(v=>v===null)||vs.length!==5||new Set(vs.map(v=>v.vogal)).size!==5||vs.some(v=>typeof v.acertou!=='boolean'))continue
      const score=(pontos.reduce((a,b)=>a+b,0)+vs.filter(v=>v.acertou).length/5)/5*100
      escores.push(score)
      for(const [mapa,id] of [[referenciaPorTurma,row.id_turma],[referenciaPorEscola,row.escola_id]]){
        if(!mapa.has(id))mapa.set(id,[])
        mapa.get(id).push(score)
      }
    }
    assert.equal(indice.completas,escores.length)
    assert.equal(indice.media,escores.length?Math.round(escores.reduce((a,b)=>a+b,0)/escores.length*10)/10:null)
    console.log('Índice Q1–Q5 validado:',JSON.stringify(indice))

    assert.equal(relatorio.protocolo.codigo, 'TERCEIRA-AVALIACAO-V1')
    const q7 = relatorio.linhas.find(l => l.item === 'Q7')
    for (const [campo, codigo] of [['semApoio','SEM_APOIO'],['comApoio','COM_APOIO']]) {
      assert.equal(q7.detalhesNome.reduce((s,r) => s+r[campo],0), q7.resultados.find(r => r.codigo === codigo).n)
    }

    assert.ok(relatorio.linhas.every(l => l.avaliadas + l.ausentes === l.base))
    assert.ok(!JSON.stringify(relatorio).includes('LEGADO'))
    for (const escola of relatorio.filtros.escolas) {
      const escolaReport = await carregarRelatorioTerceiraAvaliacao(escola.id)
      assert.deepEqual(escolaReport.resumoProjeto,relatorio.resumoProjeto)
      conferirPizzas(escolaReport)
      assert.deepEqual(escolaReport.distribuicoesTurmasProjeto,relatorio.distribuicoesTurmasProjeto)

      assert.deepEqual(escolaReport.pontuacaoTurmasProjeto,relatorio.pontuacaoTurmasProjeto)

      assert.deepEqual(escolaReport.referenciasQ1Q5,relatorio.referenciasQ1Q5)

      conferirGrupos(escolaReport,escolaReport.indiceQ1Q5Turmas)
      const scoresEscola=referenciaPorEscola.get(escola.id)||[]
      assert.equal(escolaReport.indiceQ1Q5.completas,scoresEscola.length)
      if(scoresEscola.length)assert.ok(Math.abs(escolaReport.indiceQ1Q5.mediaExata-scoresEscola.reduce((a,b)=>a+b,0)/scoresEscola.length)<1e-9)


      const coluna=relatorio.indiceQ1Q5Escolas.find(e=>e.escolaId===escola.id)
      if(coluna) {
        assert.deepEqual([coluna.media,coluna.base,coluna.completas],[escolaReport.indiceQ1Q5.media,escolaReport.base,escolaReport.indiceQ1Q5.completas])
        assert.equal(escolaReport.indiceQ1Q5Escolas.length,1)
      }

      let somaTurmas = 0
      for (const turma of escolaReport.filtros.turmas) {
        const turmaReport = await carregarRelatorioTerceiraAvaliacao(escola.id, turma.id)
        assert.deepEqual(turmaReport.resumoProjeto,relatorio.resumoProjeto)
        conferirPizzas(turmaReport)
        assert.deepEqual(turmaReport.distribuicoesTurmasProjeto,relatorio.distribuicoesTurmasProjeto)

        assert.deepEqual(turmaReport.pontuacaoTurmasProjeto,relatorio.pontuacaoTurmasProjeto)

        assert.deepEqual(turmaReport.referenciasQ1Q5,relatorio.referenciasQ1Q5)
        assert.ok(Array.isArray(turmaReport.professorasTurma))
        assert.equal(new Set(turmaReport.professorasTurma).size,turmaReport.professorasTurma.length)

        const expectedTurma = await pool.query(`WITH unicas AS (
          SELECT DISTINCT ON (id_aluno) id_aluno,id_turma FROM public.avaliacao_aplicador_aplicacoes
          WHERE id_fase=$1 AND status='CONCLUIDA' ORDER BY id_aluno,concluido_em DESC NULLS LAST,id_aplicacao DESC)
          SELECT count(*)::int AS n FROM unicas WHERE id_turma=$2`, [relatorio.filtros.faseId, turma.id])
        assert.equal(turmaReport.base, expectedTurma.rows[0].n)
        conferirGrupos(turmaReport,turmaReport.indiceQ1Q5Turmas)
        const scoresTurma=referenciaPorTurma.get(turma.id)||[]
        assert.equal(turmaReport.indiceQ1Q5.completas,scoresTurma.length)
        if(scoresTurma.length)assert.ok(Math.abs(turmaReport.indiceQ1Q5.mediaExata-scoresTurma.reduce((a,b)=>a+b,0)/scoresTurma.length)<1e-9)

        const origemTurma=escolaReport.indiceQ1Q5Turmas.find(t=>t.turmaId===turma.id)
        if(origemTurma)assert.equal(origemTurma.mediaExata,turmaReport.indiceQ1Q5.mediaExata)

        assert.equal(turmaReport.indiceQ1Q5.base,turmaReport.base)
        assert.equal(turmaReport.indiceQ1Q5.completas+turmaReport.indiceQ1Q5.incompletas,turmaReport.base)

        assert.equal(turmaReport.filtros.turmaId, turma.id)
        assert.ok(turmaReport.linhas.every(l => l.base <= turmaReport.base))
        somaTurmas += turmaReport.base
      }
      assert.equal(somaTurmas, escolaReport.base)
      await assert.rejects(carregarRelatorioTerceiraAvaliacao(escola.id, 2147483647), e => e.status === 400)
    }
    await assert.rejects(carregarRelatorioTerceiraAvaliacao(undefined, 1), e => e.status === 400)
    const vazio = await carregarRelatorioTerceiraAvaliacao(2147483647)
    assert.equal(vazio.base, 0)
    const missing = await carregarGraficosAplicador({ faseId: d.filtros.faseId, escolaId: 2147483647 })
    assert.equal(missing.resumo.concluidas, 0)
    for (const key of ['versoes','perguntas','vogais','consoantes','leitura','classificacaoTurmas']) assert.deepEqual(missing[key], [])
    if (d.filtros.escolas.length) {
      const school = d.filtros.escolas[0].id
      const filtered = await carregarGraficosAplicador({ faseId: d.filtros.faseId, escolaId: school })
      const expectedSchool = await pool.query(`SELECT count(*)::int AS n FROM public.avaliacao_aplicador_aplicacoes a
        JOIN public.turmas t USING(id_turma) WHERE a.id_fase=$1 AND t.id_escola=$2 AND a.status='CONCLUIDA'`, [d.filtros.faseId, school])
      assert.equal(filtered.resumo.concluidas, expectedSchool.rows[0].n)
    }
    await assert.rejects(carregarGraficosAplicador({ faseId: 2147483647 }), e => e.status === 400)
    console.log(`Snapshot verificado: ${d.resumo.concluidas} aplicações concluídas; ${d.leitura.reduce((s,r)=>s+r.n,0)} marcações de leitura.`)
  } finally { poolModule.getPgPool = saved; await pool.end() }
})
