// src/middlewares/auth.js
import { verifyAccess } from "../services/auth.service.js";
import pool from "../db.js";

export async function authMiddleware(req, res, next) {
  const header = req.get("Authorization") || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "missing token", code: "MISSING_TOKEN" });
  }
  try {
    const payload = verifyAccess(token);
    req.user = { id: payload.sub, role: payload.role };

    // Best-effort: อัปเดต last_activity ของ session ล่าสุดที่ยังไม่ถูก revoked
    // (เราไม่ได้ใส่ sid ลงใน JWT เพื่อหลีกเลี่ยงการแก้เยอะ จึงเลือกอัปเดตตัวล่าสุดแทน)
    pool.query(
      `UPDATE sessions
         SET last_activity_at = NOW()
       WHERE user_id = $1 AND revoked = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.id]
    ).catch(() => { /* no-op */ });

    next();
  } catch {
    return res.status(401).json({ error: "invalid token", code: "INVALID_TOKEN" });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "unauthenticated" });
    if (req.user.role !== role) return res.status(403).json({ error: "forbidden" });
    next();
  };
}

/** ตรวจสิทธิ์ per-program: ผู้ใช้ต้องมี role ใด role หนึ่งในรายการนั้น */
export function requireProgramRole(roles = []) {
  return async (req, res, next) => {
    try {
      const programId = req.params.programId || req.body.programId;
      if (!programId) return res.status(400).json({ error: "programId required" });

      const r = await pool.query(
        `SELECT 1
           FROM user_program_access
          WHERE user_id = $1
            AND program_id = $2
            AND ($3::text[] IS NULL OR role = ANY($3::text[]))`,
        [req.user.id, programId, roles.length ? roles : null]
      );
      if (!r.rowCount) return res.status(403).json({ error: "no program access" });
      next();
    } catch (e) {
      next(e);
    }
  };
}
