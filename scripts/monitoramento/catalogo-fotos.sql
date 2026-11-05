SELECT COALESCE(jsonb_agg(to_jsonb(foto) ORDER BY foto."criadoEm" DESC),'[]'::jsonb)
FROM (
 SELECT f.id_foto::text AS id,f.nome_original AS nome,f.criado_em AS "criadoEm",f.arquivo,f.mime_type AS "mimeType",
 f.id_turma::text AS "turmaId",t.id_escola::text AS "escolaId",f.id_cronograma_aplicacao::text AS "conteudoId",
 e.nome_escola AS "escolaNome",concat(et.descricao,' ',COALESCE(NULLIF(t.letra_turma,''),t.id_turma::text)) AS "turmaNome",
 ca.tema,ca.ordem,md5(regexp_replace(f.cpf_professor,'\D','','g')) AS "professorId",
 COALESCE(autor.nome,'Nome não cadastrado') AS "professorNome"
 FROM public.cronograma_fotos f JOIN public.turmas t ON t.id_turma=f.id_turma
 JOIN public.escolas e ON e.id_escola=t.id_escola JOIN public.etapas et ON et.id_etapa=t.id_etapa
 JOIN LATERAL (SELECT tema,ordem FROM public.cronograma_aplicacao WHERE id_cronograma_aplicacao=f.id_cronograma_aplicacao AND id_etapa=t.id_etapa AND ordem IS NOT NULL ORDER BY ordem,tema LIMIT 1) ca ON true
 LEFT JOIN LATERAL (SELECT COALESCE(NULLIF(trim(p.profissional_nome_social::text),''),NULLIF(trim(p.profissional_nome::text),'')) AS nome
  FROM public.professores p WHERE regexp_replace(p.profissional_cpf::text,'\D','','g')=regexp_replace(f.cpf_professor,'\D','','g') ORDER BY p.profissional_nome NULLS LAST LIMIT 1) autor ON true
 WHERE e.projeto='PJINSTFONI' AND et.projeto='PJINSTFONI'
) foto;
