import pool from "../db.js";
import { httpError } from "../utils/http.js";

// POST /program-uploads  (multipart/form-data)
export async function createProgramAndUpload(req, res, next) {
  const client = await pool.connect();
  try {
    const {
      title,       // required
      category,    // optional
      shoot_date,  // required YYYY-MM-DD
      start_time,  // required HH:mm
      end_time,    // required HH:mm
      details      // optional
    } = req.body;

    if (!title || !shoot_date || !start_time || !end_time) {
      throw httpError(400, "title, shoot_date, start_time, end_time are required");
    }

    const coverUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const userId = req.user?.id || null;

    await client.query("BEGIN");

    // 1) upsert program ตาม title (UNIQUE)
    const prog = await client.query(
      `INSERT INTO public.programs (title, category)
       VALUES ($1, $2)
       ON CONFLICT (title)
       DO UPDATE SET category = COALESCE(EXCLUDED.category, public.programs.category),
                     updated_at = now()
       RETURNING id;`,
      [title.trim(), category || null]
    );
    const programId = prog.rows[0].id;

    // 2) insert รอบถ่ายทำ
    const ins = await client.query(
      `INSERT INTO public.program_uploads
        (program_id, shoot_date, start_time, end_time, details, cover_image_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *;`,
      [programId, shoot_date, start_time, end_time, details || null, coverUrl, userId]
    );

    await client.query("COMMIT");
    res.status(201).json({ program_id: programId, upload: ins.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}
