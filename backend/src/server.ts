import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { pgPool } from './db/pg';
import prisma from './db/prisma';

const PORT = process.env.PORT || 3001;

async function startServer(): Promise<void> {
  // ── Verificar conexão com PostgreSQL ────────────────────────────────────
  try {
    const client = await pgPool.connect();
    client.release();
    console.log(
      `[PG] Conectado ao PostgreSQL — banco: ${process.env.PILOTO_PG_DATABASE || 'projPiloto'} | host: ${process.env.PILOTO_PG_HOST || 'localhost'}`
    );
  } catch (err) {
    console.warn('[PG] ⚠ Não foi possível conectar ao PostgreSQL:', (err as Error).message);
    console.warn('[PG] ⚠ Autenticação por CPF indisponível até conexão ser restabelecida.');
  }

  // ── Verificar conexão com SQLite (Prisma) ──────────────────────────────
  try {
    await prisma.$connect();
    console.log('[Prisma] Conectado ao SQLite.');
  } catch (err) {
    console.error('[Prisma] Erro fatal ao conectar ao SQLite:', (err as Error).message);
    process.exit(1);
  }

  // ── Iniciar servidor HTTP ──────────────────────────────────────────────
  app.listen(PORT, () => {
    console.log(`[Server] 🚀 Servidor rodando em http://localhost:${PORT}`);
  });
}

startServer();
