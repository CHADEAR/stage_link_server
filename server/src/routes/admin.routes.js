// src/routes/admin.routes.js
import { Router } from "express";
import pool from "../db.js";
import { authMiddleware, requireRole } from "../middlewares/auth.js";

const r = Router();
r.use(authMiddleware, requireRole("admin"));

// สร้าง/อัปเดต program
r.post("/programs", async (req, res, next) => {
  try {
    const { title, category } = req.body || {};
    if (!title) return res.status(400).json({ error: "title required" });

    const q = await pool.query(
      `INSERT INTO programs (title, category)
       VALUES ($1, $2)
       ON CONFLICT (title)
       DO UPDATE SET category = EXCLUDED.category, updated_at = NOW()
       RETURNING *`,
      [title, category || null]
    );
    res.status(201).json(q.rows[0]);
  } catch (e) { next(e); }
});

// รายชื่อ programs
r.get("/programs", async (_req, res, next) => {
  try {
    const q = await pool.query(`SELECT * FROM programs WHERE is_active = TRUE ORDER BY title`);
    res.json(q.rows);
  } catch (e) { next(e); }
});

// Assign role ให้ user ในรายการ (หลายบทบาท/รายการได้)
// Assign หรือเปลี่ยน role (1 user ต่อ 1 program มีได้ 1 role)
// 1 user 1 program 1 role — assign หรือเปลี่ยน (upsert by user_id)
r.post("/access", async (req, res, next) => {
  try {
    const { userId, programId, role } = req.body || {};
    if (!userId || !programId || !role) {
      return res.status(400).json({ error: "userId, programId, role required" });
    }

    const q = await pool.query(
      `INSERT INTO user_program_access (user_id, program_id, role)
       VALUES ($1, $2, $3::program_role)
       ON CONFLICT (user_id)
       DO UPDATE SET program_id = EXCLUDED.program_id,
                     role       = EXCLUDED.role,
                     updated_at = NOW()
       RETURNING *`,
      [userId, programId, role]
    );

    res.status(201).json(q.rows[0]);
  } catch (e) { next(e); }
});

// ยกเลิกสิทธิ์ของ user (ไม่มี role/program ใด ๆ)
r.delete("/access", async (req, res, next) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });

    await pool.query(
      `DELETE FROM user_program_access WHERE user_id = $1`,
      [userId]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});


// ผู้ใช้ที่ยังไม่มีสิทธิ์ในรายการใด (ช่วย admin หาเพื่อ assign)
r.get("/users/without-program", async (_req, res, next) => {
  try {
    const q = await pool.query(
      `SELECT
  u.id,
  u.username      AS name,      -- ✅ ส่ง username ออกเป็น name
  u.username,
  u.full_name,
  u.email,
  u.created_at
FROM users u
LEFT JOIN user_program_access upa ON upa.user_id = u.id
WHERE u.role = 'user'
  AND u.is_active = TRUE
  AND upa.user_id IS NULL
ORDER BY u.created_at DESC;
`
    );
    res.json(q.rows);
  } catch (e) { next(e); }
});

r.get("/user-program-roles", async (_req, res, next) => {
  try {
    const q = await pool.query(
      `SELECT
          u.id         AS user_id,
          u.username   AS name,            -- ✅ ใช้ username เป็น name
          u.username,                      -- (เผื่อ frontend อยากใช้ตรง ๆ)
          u.email,
          p.id         AS program_id,
          p.title      AS program_title,
          upa.role     AS program_role,
          CASE
            WHEN u.last_login IS NOT NULL THEN 'green'
            ELSE 'red'
          END          AS status_color
        FROM user_program_access upa
        JOIN users    u ON u.id = upa.user_id
        JOIN programs p ON p.id = upa.program_id
       WHERE u.is_active = TRUE
    ORDER BY u.created_at DESC, p.title ASC, upa.role ASC`
    );
    res.json(q.rows);
  } catch (e) { next(e); }
});

export default r;
