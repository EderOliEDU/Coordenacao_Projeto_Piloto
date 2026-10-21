import { carregarGraficosAplicador } from './aplicadorGraficos'

export const PROTOCOLO = {
  codigo: 'TERCEIRA-AVALIACAO-V1', versao: '1.0',
  titulo: 'Protocolo de Análise da Terceira Avaliação',
  regras: [
    'Somente a terceira fase dos aplicadores e aplicações concluídas.',
    'Uma aplicação por criança: a concluída mais recente no período; desempate pelo identificador da aplicação.',
    'Percentuais calculados sobre respostas válidas de cada item. Sem dados corresponde a percentual indefinido.',
    'Ausências são apresentadas separadamente dos resultados e não contam como erros.',
    'Q2 por vogal; Q5 pela consoante aplicada; Q7, Q8 e Q9 preservam suas categorias.',
    'Sem nota geral, diagnóstico, comparação entre fases ou classificação de prontidão para o Ensino Fundamental.',
    'Texto produzido por regras fixas, vinculado às respostas registradas; sem inferir evidências ausentes.',
  ],
}
const binarios = [
  ['RIMAS', 'Q1', 'Identificação de rimas', 'identificação de rimas'],
  ['CONSCIENCIA_PALAVRAS', 'Q3', 'Segmentação oral de palavras da frase', 'segmentação oral de palavras da frase'],
  ['CONSCIENCIA_SILABICA', 'Q4', 'Quantidade de sílabas', 'segmentação e contagem de sílabas'],
  ['LETRAS_NUMEROS', 'Q6', 'Diferenciação entre letras e números', 'diferenciação entre letras e números'],
]
export interface LinhaProtocolo { item: string; habilidade: string; base: number; avaliadas: number; ausentes: number;
  resultados: { codigo: string; descricao: string; n: number; percentual: number | null }[]; interpretacao: string; limite: string }
const pct = (n: number, d: number) => d ? Math.round(n / d * 1000) / 10 : null
const soma = (rs: { n: number }[]) => rs.reduce((s, r) => s + r.n, 0)
const numeroPct = (n: number, d: number) => `${pct(n, d)?.toLocaleString('pt-BR')}%`

/** Função pura: mesma evidência produz sempre os mesmos cálculos e frases. */
export function avaliarTerceiraAvaliacao(d: Awaited<ReturnType<typeof carregarGraficosAplicador>>) {
  const base = d.resumo.concluidas
  const linhas: LinhaProtocolo[] = []
  function registrar(item: string, habilidade: string, opcoes: { codigo: string; descricao: string; n: number }[], limite: string) {
    const avaliadas = soma(opcoes)
    if (avaliadas > base) throw new Error('Contagens incompatíveis com a base do protocolo.')
    const resultados = opcoes.map(r => ({ ...r, percentual: pct(r.n, avaliadas) }))
    const interpretacao = avaliadas
      ? resultados.map(r => `${r.descricao}: ${r.n} de ${avaliadas} (${numeroPct(r.n, avaliadas)}).`).join(' ')
      : 'Não há evidência registrada suficiente para esta habilidade.'
    const linha = { item, habilidade, base, avaliadas, ausentes: base - avaliadas, resultados, interpretacao, limite }
    linhas.push(linha); return linha
  }
  function binario(item: string, habilidade: string, rs: { resposta: string; n: number }[], limite: string) {
    return registrar(item, habilidade, [
      { codigo: 'SIM', descricao: 'Demonstrou a habilidade na tarefa aplicada', n: soma(rs.filter(r => r.resposta === 'SIM')) },
      { codigo: 'NAO', descricao: 'Não demonstrou a habilidade na tarefa aplicada', n: soma(rs.filter(r => r.resposta === 'NAO')) },
    ], limite)
  }
  for (const [codigo, item, habilidade] of binarios) binario(item, habilidade, d.perguntas.filter(r => r.codigo === codigo),
    'Resultado da tarefa aplicada; não determina uma fase global de aprendizagem.')
  for (const vogal of 'AEIOU') binario(`Q2-${vogal}`, `Som inicial da vogal ${vogal}`, d.vogais.filter(r => r.vogal === vogal && r.acertou !== null)
    .map(r => ({ resposta: r.acertou ? 'SIM' : 'NAO', n: r.n })), 'Identificação sonora na tarefa; não comprova reconhecimento da letra escrita nem domínio de outras vogais.')
  const cs = d.consoantes
  binario('Q5', 'Resultado sobre a consoante aplicada', cs, 'Cada criança foi avaliada sobre uma consoante; não generalizar ao alfabeto.')
  // Detalhes por consoante: a base é somente o grupo que recebeu aquela letra.
  for (const letra of [...new Set(cs.map(r => r.letra))]) {
    const rs = cs.filter(r => r.letra === letra)
    const linha = binario(`Q5-${letra}`, `Consoante ${letra}`, rs, 'Grupo avaliado nesta consoante; não é ranking de dificuldade.')
    linha.base = linha.avaliadas; linha.ausentes = 0
  }
  const categorias: Record<string, [string, string][]> = {
    ESCRITA_NOME: [['COM_APOIO', 'Realizou a escrita do nome com apoio'], ['SEM_APOIO', 'Realizou a escrita do nome sem apoio'], ['NAO_ESCREVE', 'Não escreveu o nome na tarefa aplicada']],
    NIVEL_ESCRITA: [['PRE_ALFABETICA', 'Classificação registrada: pré-alfabética'], ['ALFABETICA_PARCIAL', 'Classificação registrada: alfabética parcial'], ['ALFABETICA_COMPLETA', 'Classificação registrada: alfabética completa'], ['ALFABETICA_CONSOLIDADA', 'Classificação registrada: alfabética consolidada']],
  }
  for (const [codigo, opcoes] of Object.entries(categorias)) registrar(codigo === 'ESCRITA_NOME' ? 'Q7' : 'Q8', codigo === 'ESCRITA_NOME' ? 'Escrita do próprio nome' : 'Classificação da escrita',
    opcoes.map(([c, descricao]) => ({ codigo: c, descricao, n: soma(d.perguntas.filter(r => r.codigo === codigo && r.resposta === c)) })),
    codigo === 'ESCRITA_NOME' ? 'Sequência familiar; não comprova escrita produtiva de palavras novas.' : 'Julgamento registrado pelo aplicador; não validado aqui em produções escritas. A questão é opcional.')
  const leitura = [['NAO_UTILIZA_SONS', 'Não utiliza sons'], ['UTILIZA_ALGUNS_SONS', 'Utiliza alguns sons'], ['DECODIFICA', 'Decodifica'], ['LE_AUTONOMIA', 'Lê com autonomia'], ['NAO_RESPONDEU', 'Não respondeu na oportunidade registrada']]
  for (const p of d.palavras) registrar(`Q9-${p.palavra}`, `Leitura de ${p.palavra}`, leitura.map(([c, descricao]) => ({ codigo: c, descricao, n: soma(d.leitura.filter(r => r.palavra === p.palavra && r.classificacao === c)) })),
    'Classificação original por palavra; não houve revisão do áudio. Não respondeu é uma categoria registrada e difere de ausência de registro. Autonomia não determina fase consolidada.')
  linhas.sort((a, b) => Number(a.item.match(/^Q(\d+)/)?.[1]) - Number(b.item.match(/^Q(\d+)/)?.[1]))
  const demonstradas = linhas.filter(l => !l.item.startsWith('Q5-')).flatMap(l => l.resultados
    .filter(r => r.n > 0 && ['SIM', 'SEM_APOIO', 'COM_APOIO', 'DECODIFICA', 'LE_AUTONOMIA'].includes(r.codigo))
    .map(r => `${l.item} — ${l.habilidade}: ${r.descricao.toLowerCase()} — ${r.n} de ${l.avaliadas} (${numeroPct(r.n, l.avaliadas)}).`))
  const continuidade = linhas.filter(l => !l.item.startsWith('Q5-')).flatMap(l => {
    const nao = l.resultados.find(r => r.codigo === 'NAO')?.n || 0
    if (nao) return [`${l.item}: oferecer novas oportunidades de ${l.habilidade.toLowerCase()} às ${nao} crianças que não demonstraram a habilidade na tarefa, registrando os apoios utilizados e reavaliando o mesmo domínio.`]
    if (l.item === 'Q7') {
      const n = soma(l.resultados.filter(r => ['COM_APOIO', 'NAO_ESCREVE'].includes(r.codigo)))
      return n ? [`Q7: acompanhar a escrita do nome das ${n} crianças que realizaram com apoio ou não escreveram, preservando o registro do apoio necessário.`] : []
    }
    if (l.item.startsWith('Q9-')) {
      const n = soma(l.resultados.filter(r => ['NAO_UTILIZA_SONS', 'UTILIZA_ALGUNS_SONS'].includes(r.codigo)))
      return n ? [`${l.item}: retomar relações entre letras e sons e sua combinação na leitura, considerando as ${n} classificações de uso ausente ou parcial dos sons nesta palavra. Confirmar as estratégias nas evidências disponíveis.`] : []
    }
    return []
  })
  const semDados = linhas.filter(l => l.ausentes > 0).map(l => `${l.item}: ${l.ausentes} de ${l.base} crianças sem resultado registrado para este item.`)
  return { protocolo: PROTOCOLO, base, linhas,
    sintese: { demonstradas, continuidade, semDados },
    conclusao: base ? 'Esta avaliação descreve habilidades demonstradas nas tarefas e necessidades de continuidade pedagógica na transição para o Ensino Fundamental. Não permite concluir prontidão global, evolução entre fases ou diagnóstico.' : 'Não há aplicações concluídas neste recorte para elaborar a análise.' }
}

export async function carregarRelatorioTerceiraAvaliacao(escolaId?: number, turmaId?: number) {
  const faseId = Number(process.env.TERCEIRA_AVALIACAO_FASE_ID || '3')
  if (!Number.isSafeInteger(faseId) || faseId <= 0) throw new Error('Configuração da terceira fase inválida.')
  const d = await carregarGraficosAplicador({ faseId, escolaId, turmaId, unicaConcluidaPorAluno: true })
  return { ...avaliarTerceiraAvaliacao(d), filtros: d.filtros, geradoEm: d.geradoEm }
}
