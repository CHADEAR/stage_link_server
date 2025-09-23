// src/routes/me.routes.js
import { Router } from "express";
import pool from "../db.js";
import { authMiddleware } from "../middlewares/auth.js";

const r = Router();
r.use(authMiddleware);

r.get("/", async (req, res, next) => {
  try {
    const q = await pool.query(`SELECT id, email, role, full_name FROM users WHERE id=$1`, [req.user.id]);
    res.json(q.rows[0] || null);
  } catch (e) { next(e); }
});

r.get("/status", async (req, res, next) => {
  try {
    const q = await pool.query(
      `SELECT CASE
                WHEN EXISTS (
                  SELECT 1
                    FROM sessions s
                   WHERE s.user_id = $1
                     AND s.revoked = FALSE
                     AND s.expires_at > NOW()
                     AND s.last_activity_at > NOW() - interval '15 minutes'
                ) THEN 'green' ELSE 'red'
              END AS status_color`,
      [req.user.id]
    );
    res.json(q.rows[0]);
  } catch (e) { next(e); }
});

export default r;
