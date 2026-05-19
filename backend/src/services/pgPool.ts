import { Pool } from 'pg'

let _pool: Pool | null = null

export function getPgPool(): Pool {
  if (_pool) return _pool

  _pool = new Pool({
    host: process.env.PILOTO_PG_HOST,
    port: process.env.PILOTO_PG_PORT ? parseInt(process.env.PILOTO_PG_PORT, 10) || 5432 : 5432,
    database: process.env.PILOTO_PG_DB || process.env.PILOTO_PG_DATABASE,
    user: process.env.PILOTO_PG_USER,
    password: process.env.PILOTO_PG_PASSWORD,
    ssl: (process.env.PILOTO_PG_SSL ?? '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined,
  })

  return _pool
}
