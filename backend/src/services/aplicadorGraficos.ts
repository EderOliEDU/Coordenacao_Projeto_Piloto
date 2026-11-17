import {calcularIndiceAlfabetico} from './indiceAlfabetico'
import { getPgPool } from './pgPool'
import { classificarTurmas } from './classificacaoTurmas'
import { calcularIndiceQ1Q5, referenciasGlobaisQ1Q5, PadraoQ1Q5 } from './indiceTarefasQ1Q5'

export interface FiltrosGraficosAplicador { faseId?: number; escolaId?: number; turmaId?: number; versao?: number; unicaConcluidaPorAluno?: boolean }

/** Um snapshot por resposta; somente agregados saem desta consulta. */
export async function carregarGraficosAplicador(filtros: FiltrosGraficosAplicador) {
  const client = await getPgPool().connect()
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const fases = (await client.query(`SELECT f.id_fase AS id, f.nome,
      EXISTS (SELECT 1 FROM public.avaliacao_aplicador_aplicacoes a WHERE a.id_fase=f.id_fase) AS "temAplicacoes"
      FROM public.avaliacao_fases f ORDER BY f.data_inicio DESC,f.ordem DESC,f.id_fase DESC`)).rows
    const faseId = filtros.faseId ?? fases.find(f => f.temAplicacoes)?.id ?? fases[0]?.id ?? null
    if (filtros.faseId && !fases.some(f => f.id === filtros.faseId)) {
      const error = new Error('Período de avaliação não encontrado.') as Error & { status: number }
      error.status = 400
      throw error
    }
    const escolas = (await client.query(`SELECT DISTINCT e.id_escola AS id,e.nome_escola AS nome
      FROM public.avaliacao_aplicador_aplicacoes a JOIN public.turmas t USING(id_turma)
      JOIN public.escolas e ON e.id_escola=t.id_escola JOIN public.etapas et ON et.id_etapa=t.id_etapa
      WHERE a.id_fase=$1 AND e.projeto='PJINSTFONI' AND et.projeto='PJINSTFONI' ORDER BY e.nome_escola,e.id_escola`, [faseId])).rows
    const turmas = filtros.escolaId ? (await client.query(`SELECT t.id_turma AS id,
      ('Turma ' || coalesce(nullif(et.descricao::text,''),'Etapa não informada') || ' ' ||
        coalesce(nullif(t.letra_turma::text,''),t.id_turma::text) ||
        coalesce(' · ' || nullif(t.turno::text,''),'')) AS nome
      FROM public.turmas t JOIN public.etapas et ON et.id_etapa=t.id_etapa JOIN public.escolas e ON e.id_escola=t.id_escola
      WHERE t.id_escola=$1 AND e.projeto='PJINSTFONI' AND et.projeto='PJINSTFONI' AND EXISTS (SELECT 1 FROM public.avaliacao_aplicador_aplicacoes a
        WHERE a.id_turma=t.id_turma AND a.id_fase=$2)
      ORDER BY et.descricao,t.letra_turma,t.turno,t.id_turma`, [filtros.escolaId, faseId])).rows : []
    if (filtros.turmaId && (!filtros.escolaId || !turmas.some(t => t.id === filtros.turmaId))) {
      const error = new Error('Selecione uma turma pertencente à escola informada.') as Error & { status: number }
      error.status = 400
      throw error
    }
    const params = [faseId, filtros.escolaId ?? null, filtros.versao ?? null, filtros.turmaId ?? null]
    const origem = filtros.unicaConcluidaPorAluno
      ? `(SELECT DISTINCT ON (id_aluno) * FROM public.avaliacao_aplicador_aplicacoes
          WHERE id_fase=$1 AND status='CONCLUIDA'
          ORDER BY id_aluno,concluido_em DESC NULLS LAST,id_aplicacao DESC)`
      : 'public.avaliacao_aplicador_aplicacoes'
    const scope = `WITH base AS (SELECT a.* FROM ${origem} a
      JOIN public.turmas t USING(id_turma)
      JOIN public.escolas escola_projeto ON escola_projeto.id_escola=t.id_escola
      JOIN public.etapas etapa_projeto ON etapa_projeto.id_etapa=t.id_etapa
      WHERE a.id_fase=$1 AND escola_projeto.projeto='PJINSTFONI' AND etapa_projeto.projeto='PJINSTFONI'
      AND ($2::integer IS NULL OR t.id_escola=$2)
      AND ($3::integer IS NULL OR a.versao_instrumento=$3)
      AND ($4::integer IS NULL OR a.id_turma=$4))`
    // Consultas sequenciais usam a mesma conexão e o mesmo snapshot.
    const query = async (sql: string) => (await client.query(scope + sql, params)).rows
    const resumo = (await query(`SELECT count(*) FILTER (WHERE status='CONCLUIDA')::int AS concluidas,
      count(*) FILTER (WHERE status='EM_ANDAMENTO')::int AS "emAndamento",
      count(*) FILTER (WHERE status='PENDENTE')::int AS pendentes,
      count(*) FILTER (WHERE status='CANCELADA')::int AS canceladas,
      count(DISTINCT id_aluno) FILTER (WHERE status='CONCLUIDA')::int AS alunos,
      count(DISTINCT id_turma) FILTER (WHERE status='CONCLUIDA')::int AS turmas,
      count(DISTINCT cpf_aplicador) FILTER (WHERE status='CONCLUIDA')::int AS aplicadores FROM base`))[0]
    const versoes = await query(`SELECT versao_instrumento AS versao,count(*)::int AS total
      FROM base WHERE status='CONCLUIDA' GROUP BY 1 ORDER BY 1`)
    const perguntas = await query(`SELECT a.versao_instrumento AS versao,p.ordem,p.codigo,p.pergunta,
      o.codigo AS resposta,o.descricao,count(r.id_resposta)::int AS n
      FROM base a CROSS JOIN public.avaliacao_aplicador_perguntas p
      JOIN public.avaliacao_aplicador_opcoes o ON o.id_pergunta=p.id_pergunta
      LEFT JOIN public.avaliacao_aplicador_respostas r ON r.id_aplicacao=a.id_aplicacao
        AND r.id_pergunta=p.id_pergunta AND r.id_opcao=o.id_opcao
      WHERE a.status='CONCLUIDA' AND p.codigo<>'ALITERACAO'
        AND (p.ativo OR EXISTS (SELECT 1 FROM public.avaliacao_aplicador_respostas h
          JOIN base b ON b.id_aplicacao=h.id_aplicacao WHERE b.status='CONCLUIDA' AND h.id_pergunta=p.id_pergunta))
        AND (o.ativo OR EXISTS (SELECT 1 FROM public.avaliacao_aplicador_respostas h
          JOIN base b ON b.id_aplicacao=h.id_aplicacao WHERE b.status='CONCLUIDA' AND h.id_opcao=o.id_opcao))
      GROUP BY 1,2,3,4,5,6 ORDER BY 1,2,o.codigo`)
    const vogais = await query(`SELECT a.versao_instrumento AS versao,v.vogal,
      r.acertou,count(*)::int AS n
      FROM base a CROSS JOIN (VALUES ('A'),('E'),('I'),('O'),('U')) v(vogal)
      LEFT JOIN public.avaliacao_aplicador_vogais r ON r.id_aplicacao=a.id_aplicacao AND r.vogal=v.vogal
        AND r.id_pergunta=(SELECT id_pergunta FROM public.avaliacao_aplicador_perguntas WHERE codigo='ALITERACAO')
      WHERE a.status='CONCLUIDA' GROUP BY 1,2,3 ORDER BY 1,2,3`)
    const consoantes = await query(`SELECT a.versao_instrumento AS versao,
      coalesce(nullif(upper(trim(r.letra_aplicada)),''),'Não registrada') AS letra,
      o.codigo AS resposta,count(*)::int AS n FROM base a
      JOIN public.avaliacao_aplicador_respostas r USING(id_aplicacao)
      JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
      JOIN public.avaliacao_aplicador_opcoes o ON o.id_opcao=r.id_opcao AND o.id_pergunta=r.id_pergunta
      WHERE a.status='CONCLUIDA' AND p.codigo='RELACAO_LETRA_SOM' GROUP BY 1,2,3 ORDER BY 1,2,3`)
    // Calcula por criança antes de agregar; nenhuma identidade sai da consulta.
    // A origem do relatório já seleciona a última concluída por criança antes dos filtros.
    const queryGlobal = async (sql: string) => (await client.query(scope + sql, [faseId, null, filtros.versao ?? null, null])).rows
    const padroesGlobaisQ1Q5 = filtros.unicaConcluidaPorAluno ? await queryGlobal(`
      , escores AS (
        SELECT
          t.id_escola, a.id_turma, b.q1, v.q2, b.q3, b.q4, b.q5
        FROM base a JOIN public.turmas t USING(id_turma)
        LEFT JOIN LATERAL (
          SELECT
            CASE WHEN count(*) FILTER (WHERE p.codigo='RIMAS')=1
              THEN max(CASE WHEN p.codigo='RIMAS' THEN CASE o.codigo WHEN 'SIM' THEN 1 WHEN 'NAO' THEN 0 END END) END AS q1,
            CASE WHEN count(*) FILTER (WHERE p.codigo='CONSCIENCIA_PALAVRAS')=1
              THEN max(CASE WHEN p.codigo='CONSCIENCIA_PALAVRAS' THEN CASE o.codigo WHEN 'SIM' THEN 1 WHEN 'NAO' THEN 0 END END) END AS q3,
            CASE WHEN count(*) FILTER (WHERE p.codigo='CONSCIENCIA_SILABICA')=1
              THEN max(CASE WHEN p.codigo='CONSCIENCIA_SILABICA' THEN CASE o.codigo WHEN 'SIM' THEN 1 WHEN 'NAO' THEN 0 END END) END AS q4,
            CASE WHEN count(*) FILTER (WHERE p.codigo='RELACAO_LETRA_SOM')=1
              THEN max(CASE WHEN p.codigo='RELACAO_LETRA_SOM' THEN CASE o.codigo WHEN 'SIM' THEN 1 WHEN 'NAO' THEN 0 END END) END AS q5
          FROM public.avaliacao_aplicador_respostas r
          JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
          LEFT JOIN public.avaliacao_aplicador_opcoes o ON o.id_opcao=r.id_opcao AND o.id_pergunta=r.id_pergunta
          WHERE r.id_aplicacao=a.id_aplicacao
        ) b ON true
        LEFT JOIN LATERAL (
          SELECT CASE WHEN count(r.acertou)>0 AND count(DISTINCT r.vogal)=count(*)
            THEN count(*) FILTER (WHERE r.acertou IS TRUE)::float8 / count(r.acertou) END AS q2
          FROM public.avaliacao_aplicador_vogais r
          JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
          WHERE r.id_aplicacao=a.id_aplicacao AND p.codigo='ALITERACAO' AND r.vogal IN ('A','E','I','O','U')
        ) v ON true
        WHERE a.status='CONCLUIDA'
      )
      SELECT id_escola,id_turma,q1,q2,q3,q4,q5,count(*)::int AS n FROM escores GROUP BY id_escola,id_turma,q1,q2,q3,q4,q5
    `) as (PadraoQ1Q5 & { id_escola: number; id_turma: number })[] : []
    const padroesParticipantesQ1Q5 = filtros.unicaConcluidaPorAluno ? await queryGlobal(`
      , escores AS (
        SELECT
          t.id_escola, a.id_turma, b.q1, v.q2, b.q3, b.q4, b.q5
        FROM base a JOIN public.turmas t USING(id_turma)
        LEFT JOIN LATERAL (
          SELECT
            CASE WHEN count(*) FILTER (WHERE p.codigo='RIMAS')=1
              THEN max(CASE WHEN p.codigo='RIMAS' THEN CASE o.codigo WHEN 'SIM' THEN 1 WHEN 'NAO' THEN 0 END END) END AS q1,
            CASE WHEN count(*) FILTER (WHERE p.codigo='CONSCIENCIA_PALAVRAS')=1
              THEN max(CASE WHEN p.codigo='CONSCIENCIA_PALAVRAS' THEN CASE o.codigo WHEN 'SIM' THEN 1 WHEN 'NAO' THEN 0 END END) END AS q3,
            CASE WHEN count(*) FILTER (WHERE p.codigo='CONSCIENCIA_SILABICA')=1
              THEN max(CASE WHEN p.codigo='CONSCIENCIA_SILABICA' THEN CASE o.codigo WHEN 'SIM' THEN 1 WHEN 'NAO' THEN 0 END END) END AS q4,
            CASE WHEN count(*) FILTER (WHERE p.codigo='RELACAO_LETRA_SOM')=1
              THEN max(CASE WHEN p.codigo='RELACAO_LETRA_SOM' THEN CASE o.codigo WHEN 'SIM' THEN 1 WHEN 'NAO' THEN 0 END END) END AS q5
          FROM public.avaliacao_aplicador_respostas r
          JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
          LEFT JOIN public.avaliacao_aplicador_opcoes o ON o.id_opcao=r.id_opcao AND o.id_pergunta=r.id_pergunta
          WHERE r.id_aplicacao=a.id_aplicacao
        ) b ON true
        LEFT JOIN LATERAL (
          SELECT CASE WHEN count(r.acertou)>0 AND count(DISTINCT r.vogal)=count(*)
            THEN count(*) FILTER (WHERE r.acertou IS TRUE)::float8 / count(r.acertou) END AS q2
          FROM public.avaliacao_aplicador_vogais r
          JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
          WHERE r.id_aplicacao=a.id_aplicacao AND p.codigo='ALITERACAO' AND r.vogal IN ('A','E','I','O','U')
        ) v ON true
        WHERE a.status='CONCLUIDA'
      )
      SELECT id_escola,id_turma,q1,q2,q3,q4,q5,count(*)::int AS n FROM escores GROUP BY id_escola,id_turma,q1,q2,q3,q4,q5
    `) as (PadraoQ1Q5 & { id_escola: number; id_turma: number })[] : []

    const conscienciaParticipantesTurmas=[...new Set(padroesParticipantesQ1Q5.map(p=>p.id_turma))].map(turmaId=>{
      let participantes=0,soma=0
      for(const p of padroesParticipantesQ1Q5.filter(p=>p.id_turma===turmaId)) {
        const notas=[p.q1,p.q2,p.q3,p.q4,p.q5].filter((v):v is number=>v!==null&&Number.isFinite(v)&&v>=0&&v<=1)
        if(notas.length){participantes+=p.n;soma+=notas.reduce((a,v)=>a+v,0)/notas.length*100*p.n}
      }
      return {turmaId,participantes,mediaExata:participantes?soma/participantes:null}
    })
    const padroesQ1Q5 = padroesGlobaisQ1Q5.filter(p =>
      (!filtros.escolaId || p.id_escola === filtros.escolaId) && (!filtros.turmaId || p.id_turma === filtros.turmaId))
    const referenciasQ1Q5 = {
      escolas: referenciasGlobaisQ1Q5(padroesGlobaisQ1Q5, p => p.id_escola),
      turmas: referenciasGlobaisQ1Q5(padroesGlobaisQ1Q5, p => p.id_turma),
    }
    const indiceQ1Q5 = filtros.unicaConcluidaPorAluno ? calcularIndiceQ1Q5(padroesQ1Q5) : null
    const indiceQ1Q5Escolas = [...new Set(padroesQ1Q5.map(p => p.id_escola))].map(escolaId => ({
      escolaId, escola: escolas.find(e => e.id === escolaId)?.nome || `Escola ${escolaId}`,
      ...calcularIndiceQ1Q5(padroesQ1Q5.filter(p => p.id_escola === escolaId)),
    })).sort((a, b) => a.escola.localeCompare(b.escola, 'pt-BR'))

    const indiceQ1Q5Turmas = [...new Set(padroesQ1Q5.map(p => p.id_turma))].map(turmaId => ({
      turmaId, turma: turmas.find(t => t.id === turmaId)?.nome || `Turma ${turmaId}`,
      escolaId: padroesQ1Q5.find(p => p.id_turma === turmaId)!.id_escola,
      ...calcularIndiceQ1Q5(padroesQ1Q5.filter(p => p.id_turma === turmaId)),
    })).sort((a, b) => a.turma.localeCompare(b.turma, 'pt-BR'))
    const catalogoTurmasProjeto = filtros.unicaConcluidaPorAluno ? await queryGlobal(`
      SELECT DISTINCT t.id_turma AS "turmaId",t.id_escola AS "escolaId",e.nome_escola AS escola,t.id_etapa AS "agrupamentoId",
        ('Turma ' || coalesce(nullif(trim(et.descricao::text),''),'Etapa não informada') || ' ' ||
          coalesce(nullif(trim(t.letra_turma::text),''),t.id_turma::text)) AS turma,
        coalesce(n.professoras,ARRAY[]::text[]) AS professoras
      FROM (SELECT DISTINCT id_turma FROM base WHERE status='CONCLUIDA') a JOIN public.turmas t USING(id_turma)
      JOIN public.escolas e ON e.id_escola=t.id_escola LEFT JOIN public.etapas et ON et.id_etapa=t.id_etapa
      LEFT JOIN LATERAL (
        SELECT array_agg(DISTINCT coalesce(nullif(trim(p.profissional_nome_social::text),''),
          nullif(trim(p.profissional_nome::text),''))) FILTER (WHERE coalesce(nullif(trim(p.profissional_nome_social::text),''),
          nullif(trim(p.profissional_nome::text),'')) IS NOT NULL) AS professoras
        FROM public.atribuicao_professor ap JOIN public.professores p
          ON regexp_replace(p.profissional_cpf::text,'[^0-9]','','g')=regexp_replace(ap.cpf_professor::text,'[^0-9]','','g')
        WHERE ap.id_turma=t.id_turma
      ) n ON true
    `) : []
    const pontuacaoTurmasProjeto = catalogoTurmasProjeto.map(t => ({
      ...t, professoras: [...t.professoras].sort((a:string,b:string)=>a.localeCompare(b,'pt-BR')),
      ...calcularIndiceQ1Q5(padroesGlobaisQ1Q5.filter(p=>p.id_turma===t.turmaId)),
    })).sort((a,b)=>{
      const va=a.mediaExata,vb=b.mediaExata
      return va===null?(vb===null?a.escola.localeCompare(b.escola,'pt-BR')||a.turmaId-b.turmaId:1):
        vb===null?-1:vb-va||a.escola.localeCompare(b.escola,'pt-BR')||a.turmaId-b.turmaId
    })

    // V2: cohort comum Q1–Q9; somente médias anônimas por turma saem na resposta.
    const escoresAlfabeticos = filtros.unicaConcluidaPorAluno ? await queryGlobal(`
      SELECT a.id_turma,b.q1,v.q2,b.q3,b.q4,b.q5,b.q6,b.q7,b.q8,l.q9
      FROM base a
      LEFT JOIN LATERAL (SELECT CASE WHEN count(*) FILTER(WHERE p.codigo='RIMAS')=1 THEN max(CASE WHEN p.codigo='RIMAS' THEN CASE o.codigo WHEN 'SIM' THEN 100 WHEN 'NAO' THEN 0 END END) END AS q1,
CASE WHEN count(*) FILTER(WHERE p.codigo='CONSCIENCIA_PALAVRAS')=1 THEN max(CASE WHEN p.codigo='CONSCIENCIA_PALAVRAS' THEN CASE o.codigo WHEN 'SIM' THEN 100 WHEN 'NAO' THEN 0 END END) END AS q3,
CASE WHEN count(*) FILTER(WHERE p.codigo='CONSCIENCIA_SILABICA')=1 THEN max(CASE WHEN p.codigo='CONSCIENCIA_SILABICA' THEN CASE o.codigo WHEN 'SIM' THEN 100 WHEN 'NAO' THEN 0 END END) END AS q4,
CASE WHEN count(*) FILTER(WHERE p.codigo='RELACAO_LETRA_SOM')=1 THEN max(CASE WHEN p.codigo='RELACAO_LETRA_SOM' THEN CASE o.codigo WHEN 'SIM' THEN 100 WHEN 'NAO' THEN 0 END END) END AS q5,
CASE WHEN count(*) FILTER(WHERE p.codigo='LETRAS_NUMEROS')=1 THEN max(CASE WHEN p.codigo='LETRAS_NUMEROS' THEN CASE o.codigo WHEN 'SIM' THEN 100 WHEN 'NAO' THEN 0 END END) END AS q6,
CASE WHEN count(*) FILTER(WHERE p.codigo='ESCRITA_NOME')=1 THEN max(CASE WHEN p.codigo='ESCRITA_NOME' THEN CASE WHEN o.codigo='NAO_ESCREVE' THEN 0 WHEN o.codigo IN ('SEM_APOIO','COM_APOIO') AND r.nome_escrito IN ('NOME','NOME_COMPOSTO','NOME_COMPLETO') THEN CASE WHEN o.codigo='SEM_APOIO' AND r.nome_escrito='NOME_COMPLETO' THEN 100 ELSE 0 END END END) END AS q7,
CASE WHEN count(*) FILTER(WHERE p.codigo='NIVEL_ESCRITA')=1 THEN max(CASE WHEN p.codigo='NIVEL_ESCRITA' THEN CASE o.codigo WHEN 'NAO_ESCREVEU' THEN 0 WHEN 'PRE_ALFABETICA' THEN 0 WHEN 'ALFABETICA_PARCIAL' THEN 33 WHEN 'ALFABETICA_COMPLETA' THEN 67 WHEN 'ALFABETICA_CONSOLIDADA' THEN 100 END END) END AS q8
        FROM public.avaliacao_aplicador_respostas r
        JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
        LEFT JOIN public.avaliacao_aplicador_opcoes o ON o.id_opcao=r.id_opcao AND o.id_pergunta=r.id_pergunta
        WHERE r.id_aplicacao=a.id_aplicacao) b ON true
      LEFT JOIN LATERAL (SELECT CASE WHEN count(v.acertou)>0 AND count(DISTINCT v.vogal)=count(*)
        THEN count(*) FILTER(WHERE v.acertou IS TRUE)::float8/count(v.acertou)*100 END AS q2
        FROM public.avaliacao_aplicador_vogais v JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
        WHERE v.id_aplicacao=a.id_aplicacao AND p.codigo='ALITERACAO' AND v.vogal IN ('A','E','I','O','U')) v ON true
      LEFT JOIN LATERAL (SELECT CASE WHEN count(*)=10 AND count(DISTINCT lr.id_palavra)=10
        AND count(CASE lr.classificacao WHEN 'NAO_UTILIZA_SONS' THEN 0 WHEN 'UTILIZA_ALGUNS_SONS' THEN 33 WHEN 'DECODIFICA' THEN 67 WHEN 'LE_AUTONOMIA' THEN 100 WHEN 'NAO_RESPONDEU' THEN 0 END)=10
        THEN avg(CASE lr.classificacao WHEN 'NAO_UTILIZA_SONS' THEN 0 WHEN 'UTILIZA_ALGUNS_SONS' THEN 33 WHEN 'DECODIFICA' THEN 67 WHEN 'LE_AUTONOMIA' THEN 100 WHEN 'NAO_RESPONDEU' THEN 0 END)::float8 END AS q9
        FROM public.avaliacao_aplicador_leitura_respostas lr WHERE lr.id_aplicacao=a.id_aplicacao) l ON true
      WHERE a.status='CONCLUIDA'
    `) : []
    const indicesAlfabeticosTurmasProjeto=catalogoTurmasProjeto.map(t=>({turmaId:t.turmaId,
      ...calcularIndiceAlfabetico(escoresAlfabeticos.filter(e=>e.id_turma===t.turmaId).map(e=>({notas:Array.from({length:9},(_,i)=>e['q'+(i+1)]===null?null:Number(e['q'+(i+1)]))})))}))

    const distribuicoesTurmasProjeto = filtros.unicaConcluidaPorAluno ? await queryGlobal(`
      SELECT a.id_turma AS "turmaId",p.codigo AS item,o.codigo AS categoria,count(*)::int AS n
      FROM base a JOIN public.avaliacao_aplicador_respostas r USING(id_aplicacao)
      JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
      JOIN public.avaliacao_aplicador_opcoes o ON o.id_opcao=r.id_opcao AND o.id_pergunta=r.id_pergunta
      WHERE a.status='CONCLUIDA' AND (
        (p.codigo='NIVEL_ESCRITA' AND o.codigo IN ('NAO_ESCREVEU','PRE_ALFABETICA','ALFABETICA_PARCIAL','ALFABETICA_COMPLETA','ALFABETICA_CONSOLIDADA'))
        OR (p.codigo='ESCRITA_NOME' AND o.codigo IN ('SEM_APOIO','COM_APOIO','NAO_ESCREVE'))
        OR (p.codigo IN ('LETRAS_NUMEROS','RIMAS','CONSCIENCIA_PALAVRAS','CONSCIENCIA_SILABICA','RELACAO_LETRA_SOM') AND o.codigo IN ('SIM','NAO')))
      GROUP BY a.id_turma,p.codigo,o.codigo
      UNION ALL
      SELECT a.id_turma,'NOME_COMPLETO_SEM_APOIO',
        CASE WHEN o.codigo='SEM_APOIO' AND r.nome_escrito='NOME_COMPLETO'
          THEN 'COMPLETO_SEM_APOIO' ELSE 'OUTROS_RESULTADOS_NOME' END,count(*)::int
      FROM base a JOIN public.avaliacao_aplicador_respostas r USING(id_aplicacao)
      JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
      JOIN public.avaliacao_aplicador_opcoes o ON o.id_opcao=r.id_opcao AND o.id_pergunta=r.id_pergunta
      WHERE a.status='CONCLUIDA' AND p.codigo='ESCRITA_NOME'
        AND (o.codigo='NAO_ESCREVE' OR (o.codigo IN ('SEM_APOIO','COM_APOIO')
          AND r.nome_escrito IN ('NOME','NOME_COMPOSTO','NOME_COMPLETO')))
      GROUP BY 1,3
      UNION ALL
      SELECT a.id_turma,'ALITERACAO',CASE WHEN v.acertou THEN 'SIM' ELSE 'NAO' END,count(*)::int
      FROM base a JOIN public.avaliacao_aplicador_vogais v USING(id_aplicacao)
      JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
      WHERE a.status='CONCLUIDA' AND p.codigo='ALITERACAO' AND v.vogal IN ('A','E','I','O','U') AND v.acertou IS NOT NULL
      GROUP BY a.id_turma,v.acertou
      UNION ALL
      SELECT a.id_turma,'LEITURA',r.classificacao,count(*)::int
      FROM base a JOIN public.avaliacao_aplicador_leitura_respostas r USING(id_aplicacao)
      WHERE a.status='CONCLUIDA' AND r.classificacao IN ('NAO_UTILIZA_SONS','UTILIZA_ALGUNS_SONS','DECODIFICA','LE_AUTONOMIA','NAO_RESPONDEU')
      GROUP BY a.id_turma,r.classificacao
      ORDER BY 1,2,3
    `) : []
    const escritaNome = await query(`SELECT o.codigo AS apoio,r.nome_escrito AS tipo,count(*)::int AS n
      FROM base a JOIN public.avaliacao_aplicador_respostas r USING(id_aplicacao)
      JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
      JOIN public.avaliacao_aplicador_opcoes o ON o.id_opcao=r.id_opcao AND o.id_pergunta=r.id_pergunta
      WHERE a.status='CONCLUIDA' AND p.codigo='ESCRITA_NOME'
        AND o.codigo IN ('SEM_APOIO','COM_APOIO') GROUP BY 1,2 ORDER BY 1,2`)
    const leitura = await query(`SELECT a.versao_instrumento AS versao,p.ordem,p.palavra,
      r.classificacao,count(*)::int AS n,
      count(*) FILTER (WHERE nullif(trim(r.audio_arquivo),'') IS NOT NULL AND r.audio_tamanho>0)::int AS "comMetadadosAudio"
      FROM base a JOIN public.avaliacao_aplicador_leitura_respostas r USING(id_aplicacao)
      JOIN public.avaliacao_aplicador_leitura_palavras p USING(id_palavra)
      WHERE a.status='CONCLUIDA' GROUP BY 1,2,3,4 ORDER BY 1,2,4`)
    const indicadoresTurmas = await query(`, unicas AS (
      SELECT DISTINCT ON (id_aluno,versao_instrumento) * FROM base WHERE status='CONCLUIDA'
      ORDER BY id_aluno,versao_instrumento,concluido_em DESC NULLS LAST,id_aplicacao DESC
    ), indicadores AS (
      SELECT a.id_turma,a.versao_instrumento,p.codigo,count(*)::int AS avaliadas,
        count(*) FILTER (WHERE o.codigo='SIM')::int AS sim
      FROM unicas a JOIN public.avaliacao_aplicador_respostas r USING(id_aplicacao)
      JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
      JOIN public.avaliacao_aplicador_opcoes o ON o.id_opcao=r.id_opcao AND o.id_pergunta=r.id_pergunta
      WHERE p.codigo IN ('RIMAS','CONSCIENCIA_PALAVRAS','CONSCIENCIA_SILABICA','RELACAO_LETRA_SOM','LETRAS_NUMEROS')
        AND o.codigo IN ('SIM','NAO') GROUP BY 1,2,3
      UNION ALL
      SELECT a.id_turma,a.versao_instrumento,p.codigo || '_' || o.codigo,count(*)::int,0::int
      FROM unicas a JOIN public.avaliacao_aplicador_respostas r USING(id_aplicacao)
      JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
      JOIN public.avaliacao_aplicador_opcoes o ON o.id_opcao=r.id_opcao AND o.id_pergunta=r.id_pergunta
      WHERE (p.codigo='ESCRITA_NOME' AND o.codigo IN ('SEM_APOIO','COM_APOIO','NAO_ESCREVE'))
        OR (p.codigo='NIVEL_ESCRITA' AND o.codigo IN ('NAO_ESCREVEU','PRE_ALFABETICA','ALFABETICA_PARCIAL','ALFABETICA_COMPLETA','ALFABETICA_CONSOLIDADA'))
      GROUP BY 1,2,3
      UNION ALL
      SELECT a.id_turma,a.versao_instrumento,'DETALHE_NOME_' || coalesce(r.nome_escrito,'NAO_INFORMADO'),count(*)::int,0::int
      FROM unicas a JOIN public.avaliacao_aplicador_respostas r USING(id_aplicacao)
      JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
      JOIN public.avaliacao_aplicador_opcoes o ON o.id_opcao=r.id_opcao AND o.id_pergunta=r.id_pergunta
      WHERE p.codigo='ESCRITA_NOME' AND o.codigo IN ('SEM_APOIO','COM_APOIO') GROUP BY 1,2,3
      UNION ALL
      SELECT a.id_turma,a.versao_instrumento,'ALITERACAO_' || v.vogal,count(v.acertou)::int,
        count(*) FILTER (WHERE v.acertou IS TRUE)::int
      FROM unicas a JOIN public.avaliacao_aplicador_vogais v USING(id_aplicacao)
      JOIN public.avaliacao_aplicador_perguntas p USING(id_pergunta)
      WHERE p.codigo='ALITERACAO' GROUP BY 1,2,3
    ), grupos AS (SELECT id_turma,versao_instrumento,count(*)::int AS criancas FROM unicas GROUP BY 1,2)
    SELECT g.id_turma AS "turmaId",g.versao_instrumento AS versao,g.criancas,
      ('Turma ' || coalesce(nullif(trim(et.descricao::text),''),'Etapa não informada') || ' ' ||
       coalesce(nullif(trim(t.letra_turma::text),''),t.id_turma::text) || coalesce(' · ' || nullif(trim(t.turno::text),''),'')) AS turma,
      e.nome_escola AS escola,coalesce(n.professoras,ARRAY[]::text[]) AS professoras,
      coalesce(i.codigo,'') AS codigo,coalesce(i.avaliadas,0)::int AS avaliadas,coalesce(i.sim,0)::int AS sim
    FROM grupos g JOIN public.turmas t USING(id_turma) JOIN public.escolas e ON e.id_escola=t.id_escola
    LEFT JOIN public.etapas et ON et.id_etapa=t.id_etapa
    LEFT JOIN indicadores i ON i.id_turma=g.id_turma AND i.versao_instrumento=g.versao_instrumento
    LEFT JOIN LATERAL (
      SELECT array_agg(DISTINCT coalesce(nullif(trim(p.profissional_nome_social::text),''),
        nullif(trim(p.profissional_nome::text),''))) FILTER (WHERE coalesce(nullif(trim(p.profissional_nome_social::text),''),
        nullif(trim(p.profissional_nome::text),'')) IS NOT NULL) AS professoras
      FROM public.atribuicao_professor ap JOIN public.professores p
        ON regexp_replace(p.profissional_cpf::text,'[^0-9]','','g')=regexp_replace(ap.cpf_professor::text,'[^0-9]','','g')
      WHERE ap.id_turma=g.id_turma
    ) n ON true ORDER BY g.versao_instrumento,g.id_turma,i.codigo`)
    const classificacaoTurmas = classificarTurmas(indicadoresTurmas)
    const palavras = (await client.query(`SELECT palavra,ordem FROM public.avaliacao_aplicador_leitura_palavras
      WHERE ativo OR id_palavra IN (SELECT r.id_palavra FROM public.avaliacao_aplicador_leitura_respostas r
      JOIN public.avaliacao_aplicador_aplicacoes a USING(id_aplicacao)
      JOIN public.turmas t ON t.id_turma=a.id_turma JOIN public.escolas e ON e.id_escola=t.id_escola
      JOIN public.etapas et ON et.id_etapa=t.id_etapa
      WHERE a.id_fase=$1 AND e.projeto='PJINSTFONI' AND et.projeto='PJINSTFONI') ORDER BY ordem`, [faseId])).rows
    const resumoProjetoRow = filtros.unicaConcluidaPorAluno ? (await client.query(`
      WITH projeto AS (
        SELECT DISTINCT ea.id_aluno,t.id_escola
        FROM public.enturmacao_aluno ea JOIN public.alunos al USING(id_aluno)
        JOIN public.turmas t USING(id_turma) JOIN public.escolas e USING(id_escola)
        JOIN public.etapas et USING(id_etapa)
        WHERE e.projeto='PJINSTFONI' AND et.projeto='PJINSTFONI'
      ), criancas AS (SELECT DISTINCT id_aluno FROM projeto)
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM public.avaliacao_aplicador_aplicacoes a
          JOIN public.turmas turma_av ON turma_av.id_turma=a.id_turma
          JOIN public.escolas escola_av ON escola_av.id_escola=turma_av.id_escola
          JOIN public.etapas etapa_av ON etapa_av.id_etapa=turma_av.id_etapa
          WHERE a.id_aluno=c.id_aluno AND a.id_fase=$1 AND a.status='CONCLUIDA'
            AND escola_av.projeto='PJINSTFONI' AND etapa_av.projeto='PJINSTFONI'
        ))::int AS avaliadas,
        (SELECT count(DISTINCT id_escola)::int FROM projeto) AS escolas
      FROM criancas c
    `, [faseId])).rows[0] : null
    const resumoProjeto = resumoProjetoRow ? {
      total: resumoProjetoRow.total, avaliadas: resumoProjetoRow.avaliadas,
      naoAvaliadas: resumoProjetoRow.total - resumoProjetoRow.avaliadas,
      escolas: resumoProjetoRow.escolas,
      cobertura: resumoProjetoRow.total ? resumoProjetoRow.avaliadas / resumoProjetoRow.total * 100 : null,
    } : null
    const resumosAgrupamento = []
    for (const agrupamentoId of [4,5]) {
    const row = filtros.unicaConcluidaPorAluno ? (await client.query(`
      WITH projeto AS (
        SELECT DISTINCT ea.id_aluno,t.id_escola
        FROM public.enturmacao_aluno ea JOIN public.alunos al USING(id_aluno)
        JOIN public.turmas t USING(id_turma) JOIN public.escolas e USING(id_escola)
        JOIN public.etapas et USING(id_etapa)
        WHERE e.projeto='PJINSTFONI' AND et.projeto='PJINSTFONI' AND t.id_etapa=$2
      ), criancas AS (SELECT DISTINCT id_aluno FROM projeto)
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM public.avaliacao_aplicador_aplicacoes a
          JOIN public.turmas turma_av ON turma_av.id_turma=a.id_turma
          JOIN public.escolas escola_av ON escola_av.id_escola=turma_av.id_escola
          JOIN public.etapas etapa_av ON etapa_av.id_etapa=turma_av.id_etapa
          WHERE a.id_aluno=c.id_aluno AND a.id_fase=$1 AND a.status='CONCLUIDA'
            AND turma_av.id_etapa=$2 AND escola_av.projeto='PJINSTFONI' AND etapa_av.projeto='PJINSTFONI'
        ))::int AS avaliadas,
        (SELECT count(DISTINCT id_escola)::int FROM projeto) AS escolas
      FROM criancas c
    `, [faseId, agrupamentoId])).rows[0] : null
    const resumo = row ? {
      total: row.total, avaliadas: row.avaliadas,
      naoAvaliadas: row.total - row.avaliadas,
      escolas: row.escolas,
      cobertura: row.total ? row.avaliadas / row.total * 100 : null,
    } : null
      resumosAgrupamento.push({agrupamentoId,...resumo!})
    }
    await client.query('COMMIT')
    return { filtros: { faseId, escolaId: filtros.escolaId ?? null, versao: filtros.versao ?? null, turmaId: filtros.turmaId ?? null, fases, escolas, turmas },
      resumo, versoes, perguntas, vogais, consoantes, leitura, palavras, escritaNome, classificacaoTurmas, indiceQ1Q5, indiceQ1Q5Escolas, indiceQ1Q5Turmas, pontuacaoTurmasProjeto, distribuicoesTurmasProjeto, indicesAlfabeticosTurmasProjeto, conscienciaParticipantesTurmas, referenciasQ1Q5, resumoProjeto, resumosAgrupamento, geradoEm: new Date().toISOString() }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}
