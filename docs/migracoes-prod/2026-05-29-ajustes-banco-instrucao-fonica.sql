
-- Migração manual para produção
-- Projeto Instrução Fônica
-- Data: 2026-05-29

-- Comando = 'psql -h 172.17.2.40 -U postgres -d dbsemecel -f docs/migracoes-prod/2026-05-29-ajustes-banco-instrucao-fonica.sql'



BEGIN;

-- 1. Padronizar nome da escola para casar com o CSV de alunos
UPDATE public.escolas
SET nome_escola = 'CMEI ANTONIO VANIER DE OLIVEIRA'
WHERE nome_escola = 'CMEI ÂNTONIO VANIER DE OLIVEIRA';

-- 2. Garantir coluna projeto em escolas
ALTER TABLE public.escolas
ADD COLUMN IF NOT EXISTS projeto text;

-- 3. Garantir coluna projeto em etapas
ALTER TABLE public.etapas
ADD COLUMN IF NOT EXISTS projeto text;

-- 4. Garantir colunas novas em professores
ALTER TABLE public.professores
ADD COLUMN IF NOT EXISTS corporativo_e_mail text;

ALTER TABLE public.professores
ADD COLUMN IF NOT EXISTS senha_temporaria boolean NOT NULL DEFAULT false;

ALTER TABLE public.professores
ADD COLUMN IF NOT EXISTS senha_temporaria_criada_em timestamp with time zone;

ALTER TABLE public.professores
ADD COLUMN IF NOT EXISTS senha_cadastro_token text;

ALTER TABLE public.professores
ADD COLUMN IF NOT EXISTS senha_cadastro_expira_em timestamp with time zone;


-- Escolas participantes
SELECT id_escola, nome_escola, projeto
FROM public.escolas
WHERE projeto = 'PJINSTFONI'
ORDER BY nome_escola;

-- Etapas participantes
SELECT id_etapa, descricao, projeto
FROM public.etapas
WHERE projeto = 'PJINSTFONI'
ORDER BY id_etapa;



COMMIT;

