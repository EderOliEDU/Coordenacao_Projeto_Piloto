import { getPgPool } from './pgPool'

export const VOGAIS = ['A', 'E', 'I', 'O', 'U'] as const

export async function carregarVogais(idAplicacao: number) {
  const result = await getPgPool().query(`
    SELECT v.vogal, r.acertou, COALESCE(r.origem,'NAO_APRESENTADA') AS origem,
      r.respondido_em AS "respondidoEm"
    FROM (VALUES ('A'),('E'),('I'),('O'),('U')) v(vogal)
    LEFT JOIN public.avaliacao_aplicador_vogais r ON r.id_aplicacao=$1 AND r.vogal=v.vogal
      AND r.id_pergunta=(SELECT id_pergunta FROM public.avaliacao_aplicador_perguntas WHERE codigo='ALITERACAO')
    ORDER BY v.vogal`, [idAplicacao])
  return result.rows
}

export function resumirVogais(vogais: { acertou: boolean | null }[]) {
  const avaliadas = vogais.filter(v => typeof v.acertou === 'boolean').length
  const acertos = vogais.filter(v => v.acertou === true).length
  return { avaliadas, acertos, erros: avaliadas - acertos,
    cobertura: avaliadas / 5, desempenho: avaliadas ? acertos / avaliadas : null }
}
