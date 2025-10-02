// src/routes/programmes.js
import express from "express";
import { pool } from "../lib/db.js";              // <- path ของโปรเจกต์คุณ
import { requireAuth, requireRole } from "../lib/auth.js";

const router = express.Router();

/**
 * GET /programmes
 * ตัวกรอง (query string):
 *  - date=YYYY-MM-DD           (ตรงวัน)
 *  - date_from=YYYY-MM-DD&date_to=YYYY-MM-DD  (ช่วงวันที่)
 *  - categories=news,variety   (คอมม่า) หรือ categories=news&categories=variety (ซ้ำคีย์ได้)
 *  - limit, offset (ถ้าต้องการ)
 */
router.get("/", async (req, res) => {
  try {
    const { date, date_from, date_to, limit, offset } = req.query;

    // parse categories (รองรับ comma-separated และ multi-keys)
    let cats = [];
    const qCats = req.query.categories;
    if (Array.isArray(qCats)) {
      cats = qCats.flatMap(s => String(s).split(",")).map(s => s.trim()).filter(Boolean);
    } else if (typeof qCats === "string") {
      cats = qCats.split(",").map(s => s.trim()).filter(Boolean);
    }

    const where = ["p.is_active = TRUE"];
    const params = [];
    const add = (sqlFrag, val) => { params.push(val); where.push(sqlFrag.replace("$$", `$${params.length}`)); };

    if (date) {
      add("p.shoot_date = $$::date", date);
    } else if (date_from && date_to) {
      params.push(date_from, date_to);
      where.push(`p.shoot_date BETWEEN $${params.length-1}::date AND $${params.length}::date`);
    } else if (date_from) {
      add("p.shoot_date >= $$::date", date_from);
    } else if (date_to) {
      add("p.shoot_date <= $$::date", date_to);
    }

    if (cats.length) {
      add("p.category = ANY($$::text[])", cats);
    }

    const lim = Number.isFinite(+limit) ? Math.max(1, Math.min(+limit, 200)) : 100;
    const off = Number.isFinite(+offset) ? Math.max(0, +offset) : 0;

    const sql = `
      SELECT
        p.id, p.title, p.category, p.description, p.cover_image, p.is_active,
        p.shoot_date, p.start_time, p.end_time, p.created_at, p.updated_at
      FROM programmes p
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY
        p.shoot_date NULLS LAST,
        p.start_time NULLS LAST,
        p.created_at DESC
      LIMIT ${lim} OFFSET ${off}
    `;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("[GET /programmes] error:", err);
    res.status(500).json({ error: "internal error" });
  }
});

/**
 * POST /programmes  (admin เท่านั้น)
 * body: { title, category?, description?, cover_image?, shoot_date?, start_time?, end_time? }
 */
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
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

/** อัปโหลดของโปรแกรม */
router.get("/:id/uploads", async (req, res) => {
  try {
    const q = `
      SELECT id, programme_id, file_path AS url, original_name, uploaded_by, created_at
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
