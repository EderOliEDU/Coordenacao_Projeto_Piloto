import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const sslValue = process.env.PILOTO_PG_SSL;
const sslConfig =
  sslValue === 'true'
    ? { rejectUnauthorized: false }
    : sslValue === 'strict'
    ? true
    : false;

/**
 * Pool de conexões com o PostgreSQL projPiloto.
 * Usado para autenticação por CPF e leitura de dados escolares.
 * Variáveis de ambiente: PILOTO_PG_HOST, PILOTO_PG_PORT, PILOTO_PG_DATABASE,
 *                        PILOTO_PG_USER, PILOTO_PG_PASSWORD, PILOTO_PG_SSL
 */
export const pgPool = new Pool({
  host: process.env.PILOTO_PG_HOST || 'localhost',
  port: parseInt(process.env.PILOTO_PG_PORT || '5432', 10),
  database: process.env.PILOTO_PG_DATABASE || 'projPiloto',
  user: process.env.PILOTO_PG_USER || 'postgres',
  password: process.env.PILOTO_PG_PASSWORD || '',
  ssl: sslConfig as boolean | object | undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pgPool.on('error', (err) => {
  console.error('[PG] Erro inesperado no pool:', err.message);
});
