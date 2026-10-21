import { getPgPool } from './pgPool'

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
      JOIN public.escolas e ON e.id_escola=t.id_escola
      WHERE a.id_fase=$1 ORDER BY e.nome_escola,e.id_escola`, [faseId])).rows
    const turmas = filtros.escolaId ? (await client.query(`SELECT t.id_turma AS id,
      ('Turma ' || coalesce(nullif(et.descricao::text,''),'Etapa não informada') || ' ' ||
        coalesce(nullif(t.letra_turma::text,''),t.id_turma::text) ||
        coalesce(' · ' || nullif(t.turno::text,''),'')) AS nome
      FROM public.turmas t LEFT JOIN public.etapas et ON et.id_etapa=t.id_etapa
      WHERE t.id_escola=$1 AND EXISTS (SELECT 1 FROM public.avaliacao_aplicador_aplicacoes a
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
      WHERE a.id_fase=$1 AND ($2::integer IS NULL OR t.id_escola=$2)
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
    const leitura = await query(`SELECT a.versao_instrumento AS versao,p.ordem,p.palavra,
      r.classificacao,count(*)::int AS n,
      count(*) FILTER (WHERE nullif(trim(r.audio_arquivo),'') IS NOT NULL AND r.audio_tamanho>0)::int AS "comMetadadosAudio"
      FROM base a JOIN public.avaliacao_aplicador_leitura_respostas r USING(id_aplicacao)
      JOIN public.avaliacao_aplicador_leitura_palavras p USING(id_palavra)
      WHERE a.status='CONCLUIDA' GROUP BY 1,2,3,4 ORDER BY 1,2,4`)
    const palavras = (await client.query(`SELECT palavra,ordem FROM public.avaliacao_aplicador_leitura_palavras
      WHERE ativo OR id_palavra IN (SELECT r.id_palavra FROM public.avaliacao_aplicador_leitura_respostas r
      JOIN public.avaliacao_aplicador_aplicacoes a USING(id_aplicacao) WHERE a.id_fase=$1) ORDER BY ordem`, [faseId])).rows
    await client.query('COMMIT')
    return { filtros: { faseId, escolaId: filtros.escolaId ?? null, versao: filtros.versao ?? null, turmaId: filtros.turmaId ?? null, fases, escolas, turmas },
      resumo, versoes, perguntas, vogais, consoantes, leitura, palavras, geradoEm: new Date().toISOString() }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}
