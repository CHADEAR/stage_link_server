import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../lib/db.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Register (role=user)
router.post('/register', async (req, res) => {
  const { email, password, full_name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name)
       VALUES ($1,$2,'user',$3) RETURNING id, email, role, full_name`,
      [email, hash, full_name || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.message.includes('duplicate')) return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: e.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1 AND is_active=TRUE', [email]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  await pool.query('UPDATE users SET last_login=now() WHERE id=$1', [user.id]);
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name } });
});

// Forgot -> create OTP
router.post('/forgot', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  const { rows } = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
  const user = rows[0];
  if (!user) return res.json({ ok: true }); // don't leak
  const otp = Math.floor(100000 + Math.random()*900000).toString();
  const expires = new Date(Date.now() + 15*60*1000);
  await pool.query(
    `INSERT INTO password_resets (user_id, otp_code, expires_at) VALUES ($1,$2,$3)`,
    [user.id, otp, expires]
  );
  // dev "mailbox"
  if (process.env.DEV_MAILBOX === 'enabled') {
    console.log(`[DEV OTP] for ${email}: ${otp} (expires in 15m)`);
  }
  res.json({ ok: true });
});

// Reset
router.post('/reset', async (req, res) => {
  const { email, otp, new_password } = req.body || {};
  if (!email || !otp || !new_password) return res.status(400).json({ error: 'email, otp, new_password required' });
  const { rows } = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
  const user = rows[0];
  if (!user) return res.status(400).json({ error: 'Invalid email or otp' });
  const { rows: prs } = await pool.query(
    `SELECT * FROM password_resets WHERE user_id=$1 AND otp_code=$2 AND used_at IS NULL AND expires_at>now()
     ORDER BY created_at DESC NULLS LAST LIMIT 1`, [user.id, otp]
  );
  const pr = prs[0];
  if (!pr) return res.status(400).json({ error: 'Invalid email or otp' });
  const hash = await bcrypt.hash(new_password, 10);
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, user.id]);
  await pool.query('UPDATE password_resets SET used_at=now() WHERE id=$1', [pr.id]);
  res.json({ ok: true });
});

export default router;
