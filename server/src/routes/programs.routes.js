// src/routes/programs.routes.js
import { Router } from "express";
import pool from "../db.js";
import { authMiddleware } from "../middlewares/auth.js";

const r = Router();

// public: รายการทั้งหมดที่ active
r.get("/", async (_req, res, next) => {
  try {
    const q = await pool.query(`SELECT id, title, category FROM programs WHERE is_active = TRUE ORDER BY title`);
    res.json(q.rows);
  } catch (e) { next(e); }
});

// require auth: รายการที่ "ฉัน" มีสิทธิ์ พร้อม roles
r.get("/mine", authMiddleware, async (req, res, next) => {
  try {
    const q = await pool.query(
      `SELECT p.id, p.title, array_agg(upa.role ORDER BY upa.role) AS roles
         FROM user_program_access upa
         JOIN programs p ON p.id = upa.program_id AND p.is_active
        WHERE upa.user_id = $1
     GROUP BY p.id, p.title
     ORDER BY p.title`,
      [req.user.id]
    );
    res.json(q.rows);
  } catch (e) { next(e); }
});

export default r;
