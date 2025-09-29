import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth, requireRole } from '../lib/auth.js';

const router = express.Router();

// List users (admin)
router.get('/', requireAuth, requireRole('admin'), async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT u.id, u.email, u.role, u.full_name, u.is_active, u.created_at
    FROM users u ORDER BY u.created_at DESC
  `);
  res.json(rows);
});

// List accesses for a user
router.get('/:userId/access', requireAuth, requireRole('admin'), async (req, res) => {
  const { userId } = req.params;
  const { rows } = await pool.query(`
    SELECT a.id, a.role, a.programme_id, p.title
    FROM user_program_access a
    JOIN programmes p ON p.id=a.programme_id
    WHERE a.user_id=$1
    ORDER BY p.title
  `, [userId]);
  res.json(rows);
});

// Grant/Revoke access
router.post('/:userId/access', requireAuth, requireRole('admin'), async (req, res) => {
  const { userId } = req.params;
  const { programme_id, role, action } = req.body || {};
  if (!programme_id || !role) return res.status(400).json({ error: 'programme_id and role required' });
  if (action === 'revoke') {
    await pool.query('DELETE FROM user_program_access WHERE user_id=$1 AND programme_id=$2 AND role=$3', [userId, programme_id, role]);
    return res.json({ ok: true, action: 'revoked' });
  } else {
    await pool.query(
      `INSERT INTO user_program_access (user_id, programme_id, role)
       VALUES ($1,$2,$3) ON CONFLICT (user_id, programme_id, role) DO NOTHING`,
      [userId, programme_id, role]
    );
    return res.json({ ok: true, action: 'granted' });
  }
});

export default router;
