import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Iniciando seed do banco SQLite...');

  // ── Admin user ────────────────────────────────────────────────────────────
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash: adminHash },
  });
  console.log('[Seed] Admin criado/verificado:', admin.username);

  // ── Escala Linguagem (com cores) ──────────────────────────────────────────
  const escalaLinguagem = await prisma.escalaResposta.upsert({
    where: { nome: 'Linguagem' },
    update: {},
    create: {
      nome: 'Linguagem',
      opcoes: {
        create: [
          { chave: 'PEA-ND',  descricao: 'Não demonstra',              cor: '#F39C12', ordem: 1 },
          { chave: 'PEA-NDA', descricao: 'Não demonstra ainda',        cor: '#E67E22', ordem: 2 },
          { chave: 'PEA-TD',  descricao: 'Tentando demonstrar',        cor: '#F1C40F', ordem: 3 },
          { chave: 'PEA-PD',  descricao: 'Parcialmente demonstrado',   cor: '#3498DB', ordem: 4 },
          { chave: 'PEA-D',   descricao: 'Demonstrado',                cor: '#2ECC71', ordem: 5 },
        ],
      },
    },
  });

  // ── Escala Fluxo ──────────────────────────────────────────────────────────
  const escalaFluxo = await prisma.escalaResposta.upsert({
    where: { nome: 'Fluxo' },
    update: {},
    create: {
      nome: 'Fluxo',
      opcoes: {
        create: [
          { chave: 'SF',  descricao: 'Segue o fluxo',             cor: null, ordem: 1 },
          { chave: 'SFP', descricao: 'Segue o fluxo parcialmente', cor: null, ordem: 2 },
          { chave: 'NSF', descricao: 'Não segue o fluxo',         cor: null, ordem: 3 },
        ],
      },
    },
  });
  console.log('[Seed] Escalas criadas/verificadas:', escalaLinguagem.nome, '|', escalaFluxo.nome);

  // ── Formulário v1 (criado apenas se não existir) ──────────────────────────
  const existingForm = await prisma.formulario.findUnique({ where: { versao: 'v1' } });
  if (!existingForm) {
    const formulario = await prisma.formulario.create({
      data: {
        versao: 'v1',
        titulo: 'Formulário de Avaliação — Projeto Piloto Educação Infantil',
        ativo: true,
        secoes: {
          create: [
            {
              titulo: 'Linguagem – Oralidade e Leitura',
              ordem: 1,
              perguntas: {
                create: [
                  {
                    texto: 'Consciência fonológica e fonêmica',
                    ordem: 1,
                    escala: { connect: { id: escalaLinguagem.id } },
                  },
                ],
              },
            },
            {
              titulo: 'Linguagem – Escrita',
              ordem: 2,
              perguntas: {
                create: [
                  {
                    texto: 'Escrita espontânea',
                    ordem: 1,
                    escala: { connect: { id: escalaLinguagem.id } },
                  },
                ],
              },
            },
            {
              titulo: 'Linguagem – Compreensão Leitora',
              ordem: 3,
              perguntas: {
                create: [
                  {
                    texto: 'Compreensão de textos',
                    ordem: 1,
                    escala: { connect: { id: escalaLinguagem.id } },
                  },
                ],
              },
            },
            {
              titulo: 'Matemática',
              ordem: 4,
              perguntas: {
                create: [
                  {
                    texto: 'Raciocínio lógico-matemático',
                    ordem: 1,
                    escala: { connect: { id: escalaFluxo.id } },
                  },
                ],
              },
            },
            {
              titulo: 'Senso de Organização – Cuidado de Si, do Outro e do Ambiente',
              ordem: 5,
              perguntas: {
                create: [
                  {
                    texto: 'Organização e cuidado',
                    ordem: 1,
                    escala: { connect: { id: escalaFluxo.id } },
                  },
                ],
              },
            },
          ],
        },
      },
    });
    console.log('[Seed] Formulário criado:', formulario.versao, '—', formulario.titulo);
  } else {
    console.log('[Seed] Formulário v1 já existe, pulando criação.');
  }

  console.log('[Seed] Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('[Seed] Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
