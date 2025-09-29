import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from '../src/lib/db.js';

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin123!';
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1,$2,'admin')
     ON CONFLICT (email) DO UPDATE SET role='admin'`,
    [email, hash]
  );
  console.log(`[seed] Admin ready: ${email} / ${password}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
