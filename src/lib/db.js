import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

export const pool = new Pool({ connectionString });

export async function query(sql, params) {
  const start = Date.now();
  const res = await pool.query(sql, params);
  const ms = Date.now() - start;
  if (ms > 200) console.log(`[db] ${ms}ms: ${sql.split('\n')[0]}...`);
  return res;
}
