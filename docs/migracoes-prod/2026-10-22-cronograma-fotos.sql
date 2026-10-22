BEGIN;
SET LOCAL lock_timeout='10s';

CREATE TABLE IF NOT EXISTS public.cronograma_fotos (
 id_foto uuid PRIMARY KEY,
 id_turma integer NOT NULL REFERENCES public.turmas(id_turma) ON DELETE CASCADE,
 id_cronograma_aplicacao integer NOT NULL,
 cpf_professor text NOT NULL,
 arquivo text NOT NULL UNIQUE,
 nome_original text NOT NULL,
 mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
 tamanho integer NOT NULL CHECK (tamanho > 0 AND tamanho <= 8388608),
 criado_em timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cronograma_fotos_turma_item_idx
 ON public.cronograma_fotos(id_turma,id_cronograma_aplicacao,criado_em);
COMMIT;
