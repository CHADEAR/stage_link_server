import express from "express";
import { pool } from "../lib/db.js";
import { requireAuth, requireRole } from "../lib/auth.js";

const router = express.Router();

/**
 * GET /programmes
 * คืนลิสต์โปรแกรม (active เท่านั้น) พร้อมฟิลด์เวลา
 * หมายเหตุ: cover_image จะเป็น /uploads/<filename> ถ้ามีไฟล์อัปแล้ว
 */
router.get("/", async (_req, res) => {
  try {
    const q = `
      SELECT id, title, category, description, cover_image, is_active,
             shoot_date, start_time, end_time,
             created_at, updated_at
      FROM programmes
      WHERE is_active = TRUE
      ORDER BY created_at DESC
    `;
    const { rows } = await pool.query(q);
    res.json(rows);
  } catch (err) {
    console.error("[GET /programmes] error:", err);
    res.status(500).json({ error: "internal error" });
  }
});

/**
 * POST /programmes  (admin)
 * body: { title, category?, description?, cover_image?, shoot_date?, start_time?, end_time? }
 */
router.post("/", requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const {
      title,
      category = null,
      description = null,
      cover_image = null,
      shoot_date = null,   // "YYYY-MM-DD"
      start_time = null,   // "HH:MM" หรือ "HH:MM:SS"
      end_time = null      // "HH:MM" หรือ "HH:MM:SS"
    } = req.body;

    if (!title) return res.status(400).json({ error: "title is required" });

    // validate เบื้องต้น
    const dateOk = !shoot_date || /^\d{4}-\d{2}-\d{2}$/.test(shoot_date);
    const timeOk =
      (!start_time || /^\d{2}:\d{2}(:\d{2})?$/.test(start_time)) &&
      (!end_time   || /^\d{2}:\d{2}(:\d{2})?$/.test(end_time));
    if (!dateOk || !timeOk) return res.status(400).json({ error: "invalid date/time format" });

    const userId = req.user?.id || null;
    const q = `
      INSERT INTO programmes (title, category, description, cover_image, shoot_date, start_time, end_time, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id, title, category, description, cover_image, is_active,
                shoot_date, start_time, end_time, created_at, updated_at
    `;
    const params = [title, category, description, cover_image, shoot_date, start_time, end_time, userId];
    const { rows } = await pool.query(q, params);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("[POST /programmes] error:", err);
    res.status(500).json({ error: "internal error" });
  }
});

/**
 * GET /programmes/:id/uploads
 * คืนไฟล์ที่อัปโหลดของโปรแกรมนั้น ๆ
 * - url จะเป็นพาธสาธารณะเสมอ (/uploads/<filename>)
 */
router.get("/:id/uploads", async (req, res) => {
  try {
    const q = `
      SELECT
        id,
        programme_id,
        '/uploads/' || file_path AS url,   -- คืนเป็นพาธ public
        file_path,
        original_name,
        uploaded_by,
        created_at
      FROM program_uploads
      WHERE programme_id = $1
      ORDER BY created_at DESC
    `;
    const { rows } = await pool.query(q, [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error("[GET /programmes/:id/uploads] error:", err);
    res.status(500).json({ error: "internal error" });
  }
});

export default router;
