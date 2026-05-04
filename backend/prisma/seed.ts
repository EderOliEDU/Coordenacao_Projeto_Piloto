import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create EscalaResposta ESC_PEA_COR
  const escalaPEA = await prisma.escalaResposta.upsert({
    where: { codigo: 'ESC_PEA_COR' },
    update: {},
    create: {
      codigo: 'ESC_PEA_COR',
      nomeExibicao: 'PEA – Práticas Experienciadas Avaliadas (cor)',
      descricao: 'Escala de avaliação por cores sem rótulo de texto',
      opcoes: {
        create: [
          { chave: 'PEA-NDA', ordem: 1, corHex: '#F39C12', rotuloUI: '', descricaoLegenda: 'prática experienciada – apresentou que não domina ainda' },
          { chave: 'PEA-TD',  ordem: 2, corHex: '#F1C40F', rotuloUI: '', descricaoLegenda: 'prática experienciada – apresentou que tem dificuldade' },
          { chave: 'PEA-PD',  ordem: 3, corHex: '#3498DB', rotuloUI: '', descricaoLegenda: 'prática experienciada – apresentou que tem pouca dificuldade' },
          { chave: 'PEA-D',   ordem: 4, corHex: '#2ECC71', rotuloUI: '', descricaoLegenda: 'prática experienciada – apresentou que domina' },
        ],
      },
    },
    include: { opcoes: true },
  });

  // 2. Create EscalaResposta ESC_FLUXO
  const escalaFluxo = await prisma.escalaResposta.upsert({
    where: { codigo: 'ESC_FLUXO' },
    update: {},
    create: {
      codigo: 'ESC_FLUXO',
      nomeExibicao: 'Fluxo de Aprendizagem',
      opcoes: {
        create: [
          { chave: 'SF',  ordem: 1, corHex: null, rotuloUI: 'SF',  descricaoLegenda: 'segue o fluxo' },
          { chave: 'SFP', ordem: 2, corHex: null, rotuloUI: 'SFP', descricaoLegenda: 'segue o fluxo parcialmente' },
          { chave: 'NSF', ordem: 3, corHex: null, rotuloUI: 'NSF', descricaoLegenda: 'não segue o fluxo' },
        ],
      },
    },
    include: { opcoes: true },
  });

  // 3. Create EscalaResposta ESC_SIM_NAO
  const escalaSimNao = await prisma.escalaResposta.upsert({
    where: { codigo: 'ESC_SIM_NAO' },
    update: {},
    create: {
      codigo: 'ESC_SIM_NAO',
      nomeExibicao: 'Sim / Não',
      opcoes: {
        create: [
          { chave: 'SIM', ordem: 1, rotuloUI: 'Sim', descricaoLegenda: 'Sim' },
          { chave: 'NAO', ordem: 2, rotuloUI: 'Não', descricaoLegenda: 'Não' },
        ],
      },
    },
    include: { opcoes: true },
  });

  // 4. Create Formulario
  const formulario = await prisma.formulario.upsert({
    where: { id: 'formulario-piloto-ei-v1' },
    update: {},
    create: {
      id: 'formulario-piloto-ei-v1',
      nome: 'Formulário Piloto EI',
      versao: '1.0.0',
      ativo: true,
    },
  });

  // Helper to create section+questions
  async function criarSecao(titulo: string, ordem: number, perguntas: Array<{ codigo: string; enunciado: string; escalaId: string; ordemP: number }>) {
    const secao = await prisma.secaoFormulario.create({
      data: {
        formularioId: formulario.id,
        titulo,
        ordem,
        perguntas: {
          create: perguntas.map((p) => ({
            codigo: p.codigo,
            enunciado: p.enunciado,
            escalaId: p.escalaId,
            ordem: p.ordemP,
          })),
        },
      },
    });
    return secao;
  }

  // Check if sections already exist
  const existingSecoes = await prisma.secaoFormulario.count({ where: { formularioId: formulario.id } });
  if (existingSecoes === 0) {
    // Section 0 - Perguntas Gerais
    await criarSecao('Perguntas Gerais', 0, [
      { codigo: 'P01', enunciado: 'Público Alvo da Educação Especial?', escalaId: escalaSimNao.id, ordemP: 1 },
      { codigo: 'P02', enunciado: 'Em estudo de caso?', escalaId: escalaSimNao.id, ordemP: 2 },
      { codigo: 'P03', enunciado: 'Qual o fluxo de aprendizagem?', escalaId: escalaFluxo.id, ordemP: 3 },
    ]);

    // Section 1 - Linguagem – Oralidade e Leitura
    await criarSecao('Linguagem – Oralidade e Leitura (Consciência fonológica e fonêmica)', 1, [
      { codigo: 'L-OL-01', enunciado: 'Identifica rimas?', escalaId: escalaPEA.id, ordemP: 1 },
      { codigo: 'L-OL-02', enunciado: 'Reconhece sílabas?', escalaId: escalaPEA.id, ordemP: 2 },
      { codigo: 'L-OL-03', enunciado: 'Reconhece fonemas?', escalaId: escalaPEA.id, ordemP: 3 },
      { codigo: 'L-OL-04', enunciado: 'Lê palavras simples?', escalaId: escalaPEA.id, ordemP: 4 },
      { codigo: 'L-OL-05', enunciado: 'Lê frases simples?', escalaId: escalaPEA.id, ordemP: 5 },
    ]);

    // Section 2 - Linguagem – Escrita
    await criarSecao('Linguagem – Escrita', 2, [
      { codigo: 'L-ES-01', enunciado: 'Escreve o próprio nome?', escalaId: escalaPEA.id, ordemP: 1 },
      { codigo: 'L-ES-02', enunciado: 'Escreve palavras simples?', escalaId: escalaPEA.id, ordemP: 2 },
      { codigo: 'L-ES-03', enunciado: 'Escreve frases simples?', escalaId: escalaPEA.id, ordemP: 3 },
      { codigo: 'L-ES-04', enunciado: 'Utiliza letras convencionais?', escalaId: escalaPEA.id, ordemP: 4 },
    ]);

    // Section 3 - Linguagem – Compreensão Leitora
    await criarSecao('Linguagem – Compreensão Leitora', 3, [
      { codigo: 'L-CL-01', enunciado: 'Compreende texto lido em voz alta?', escalaId: escalaPEA.id, ordemP: 1 },
      { codigo: 'L-CL-02', enunciado: 'Identifica personagens principais?', escalaId: escalaPEA.id, ordemP: 2 },
      { codigo: 'L-CL-03', enunciado: 'Localiza informações explícitas?', escalaId: escalaPEA.id, ordemP: 3 },
    ]);

    // Section 4 - Matemática
    await criarSecao('Matemática', 4, [
      { codigo: 'MAT-01', enunciado: 'Conta objetos até 10?', escalaId: escalaFluxo.id, ordemP: 1 },
      { codigo: 'MAT-02', enunciado: 'Reconhece números até 10?', escalaId: escalaFluxo.id, ordemP: 2 },
      { codigo: 'MAT-03', enunciado: 'Realiza adições simples?', escalaId: escalaFluxo.id, ordemP: 3 },
      { codigo: 'MAT-04', enunciado: 'Realiza subtrações simples?', escalaId: escalaFluxo.id, ordemP: 4 },
      { codigo: 'MAT-05', enunciado: 'Resolve problemas cotidianos simples?', escalaId: escalaFluxo.id, ordemP: 5 },
    ]);

    // Section 5 - Senso de Organização
    await criarSecao('Senso de Organização – Cuidado de si, do outro e do ambiente', 5, [
      { codigo: 'SO-01', enunciado: 'Organiza seu espaço de trabalho?', escalaId: escalaFluxo.id, ordemP: 1 },
      { codigo: 'SO-02', enunciado: 'Cuida dos materiais da escola?', escalaId: escalaFluxo.id, ordemP: 2 },
      { codigo: 'SO-03', enunciado: 'Colabora com colegas?', escalaId: escalaFluxo.id, ordemP: 3 },
      { codigo: 'SO-04', enunciado: 'Demonstra autonomia nas atividades?', escalaId: escalaFluxo.id, ordemP: 4 },
    ]);
  }

  console.log('✓ Seed concluído!');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
