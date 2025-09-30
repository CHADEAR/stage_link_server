// src/db.js
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

export const pool = new Pool({
  connectionString,
  // หากรันบนคลาวด์ที่บังคับ SSL:
  ...(process.env.NODE_ENV === 'production' && process.env.PGSSLMODE !== 'disable'
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
});

// helper ใช้ query แบบสั้น ๆ (ถ้าต้องการ)
export const query = (text, params) => pool.query(text, params);

// log error จาก pool (กัน process ตายเงียบ ๆ)
pool.on('error', (err) => {
  console.error('[pg] unexpected error on idle client', err);
});
