-- Atualiza public.escolas com dados do CSV "Analise - Tabela da lista das escolas - Detalhado".
--
-- Aplicado em dev/dbsemecel em 2026-06-19 via:
--   node scripts/update-escolas-from-csv.js --apply
--
-- Resultado da aplicacao:
--   - 97 escolas existentes atualizadas;
--   - 31 dessas tiveram nome corrigido por variante/abreviacao conforme CSV;
--   - 7 escolas inseridas;
--   - 2 escolas antigas permaneceram sem codigo_inep por nao constarem no CSV;
--   - total final em public.escolas: 106 linhas;
--   - total com codigo_inep: 104 linhas;
--   - nenhum codigo_inep duplicado.

BEGIN;

ALTER TABLE public.escolas
  ADD COLUMN IF NOT EXISTS codigo_inep text,
  ADD COLUMN IF NOT EXISTS uf varchar(2),
  ADD COLUMN IF NOT EXISTS municipio text,
  ADD COLUMN IF NOT EXISTS restricao_atendimento text,
  ADD COLUMN IF NOT EXISTS localizacao text,
  ADD COLUMN IF NOT EXISTS localidade_diferenciada text,
  ADD COLUMN IF NOT EXISTS categoria_administrativa text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS dependencia_administrativa text,
  ADD COLUMN IF NOT EXISTS categoria_escola_privada text,
  ADD COLUMN IF NOT EXISTS conveniada_poder_publico text,
  ADD COLUMN IF NOT EXISTS regulamentacao_conselho_educacao text,
  ADD COLUMN IF NOT EXISTS porte_escola text,
  ADD COLUMN IF NOT EXISTS etapas_modalidades text,
  ADD COLUMN IF NOT EXISTS outras_ofertas_educacionais text,
  ADD COLUMN IF NOT EXISTS latitude numeric(11,8),
  ADD COLUMN IF NOT EXISTS longitude numeric(11,8),
  ADD COLUMN IF NOT EXISTS escolas_csv_atualizado_em timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS idx_escolas_codigo_inep
  ON public.escolas (codigo_inep)
  WHERE codigo_inep IS NOT NULL;

-- A carga dos dados e o pareamento por nome normalizado/fuzzy ficam no script
-- scripts/update-escolas-from-csv.js, pois os valores vêm do CSV externo.
-- Para conferir sem alterar:
--   node scripts/update-escolas-from-csv.js
--
-- Para aplicar:
--   node scripts/update-escolas-from-csv.js --apply

COMMIT;
