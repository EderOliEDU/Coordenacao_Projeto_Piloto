export const FOTO_AUTOR_JOIN = `LEFT JOIN LATERAL (
 SELECT COALESCE(NULLIF(trim(p.profissional_nome_social::text),''),NULLIF(trim(p.profissional_nome::text),'')) AS nome
 FROM public.professores p WHERE regexp_replace(p.profissional_cpf::text,'\\D','','g')=regexp_replace(f.cpf_professor,'\\D','','g')
 ORDER BY p.profissional_nome NULLS LAST LIMIT 1
) autor ON true`
export const FOTO_AUTOR_NOME = "COALESCE(autor.nome,'Nome não cadastrado')"
export const FOTO_AUTOR_ID = "md5(regexp_replace(f.cpf_professor,'\\D','','g'))"
