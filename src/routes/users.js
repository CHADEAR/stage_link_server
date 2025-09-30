// src/routes/users.js
import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth, requireRole } from '../lib/auth.js'; // ใช้แพทเทิร์นนี้ให้เหมือนกันทั้งไฟล์

const router = express.Router();

/**
 * GET /users?role=user
 * - admin เท่านั้น
 * - ถ้ามี ?role=... จะกรองด้วย role นั้น
 */
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const raw = typeof req.query.role === 'string' ? req.query.role : '';
  const role = raw.toLowerCase().trim();
  const allowed = new Set(['user', 'admin']);  // เพิ่มได้ถ้ามี role อื่น

  const params = [];
  let q = `
    SELECT id, email, full_name, role, is_active, created_at
    FROM users
  `;
  if (allowed.has(role)) {          // ✅ กรองเฉพาะค่า role ที่ยอมรับ
    q += ` WHERE role = $1 `;
    params.push(role);
  }
  q += ` ORDER BY created_at DESC `;
  const { rows } = await pool.query(q, params);
  res.json(rows);
});


/**
 * GET /users/:userId/access
 * - admin เท่านั้น
 * - คืนสิทธิ์เข้าโปรแกรมของผู้ใช้คนนั้น
 */
router.get('/:userId/access', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { rows } = await pool.query(
      `
        SELECT a.id, a.role, a.programme_id, p.title
        FROM user_program_access a
        JOIN programmes p ON p.id = a.programme_id
        WHERE a.user_id = $1
        ORDER BY p.title
      `,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET /users/:userId/access] error:', err);
    res.status(500).json({ error: 'internal error' });
  }
});

/**
 * POST /users/:userId/access
 * body: { programme_id, role, action? }
 * - admin เท่านั้น
 * - action = 'revoke' จะลบสิทธิ์เฉพาะ role นั้นในโปรแกรมนั้น
 * - ไม่ใส่ action = บันทึก/ให้สิทธิ์ (upsert ด้วย ON CONFLICT DO NOTHING)
 */
router.post('/:userId/access', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { programme_id, role, action } = req.body || {};
    if (!programme_id || !role) {
      return res.status(400).json({ error: 'programme_id and role required' });
    }

    if (action === 'revoke') {
      await pool.query(
        'DELETE FROM user_program_access WHERE user_id=$1 AND programme_id=$2 AND role=$3',
        [userId, programme_id, role]
      );
      return res.json({ ok: true, action: 'revoked' });
    }

    await pool.query(
      `
        INSERT INTO user_program_access (user_id, programme_id, role)
        VALUES ($1,$2,$3)
        ON CONFLICT (user_id, programme_id, role) DO NOTHING
      `,
      [userId, programme_id, role]
    );
    return res.json({ ok: true, action: 'granted' });
  } catch (err) {
    console.error('[POST /users/:userId/access] error:', err);
    res.status(500).json({ error: 'internal error' });
  }
});

export default router;
