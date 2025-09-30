import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../lib/db.js';
import { requireAuth, requireRole } from '../lib/auth.js';

const router = express.Router();

// พาธโฟลเดอร์อัปโหลดแบบ absolute (อิงจาก env หรือ ./uploads ของโปรเจกต์)
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve('./uploads');

// สร้างโฟลเดอร์ถ้ายังไม่มี
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ตั้งค่า Multer ให้เขียนไฟล์ลงโฟลเดอร์อัปโหลด
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}_${safe}`);
  }
});
const upload = multer({ storage });

/**
 * POST /uploads/program  (admin)
 * form-data: { programme_id, file }
 * - บันทึกไฟล์ลงดิสก์
 * - INSERT program_uploads
 * - ถ้าโปรแกรมนั้นยังไม่มี cover_image → อัปเดตให้เป็น /uploads/<filename>
 * - คืน JSON พร้อม url สาธารณะ
 */
router.post(
  '/program',
  requireAuth,
  requireRole('admin'),
  upload.single('file'),
  async (req, res) => {
    const { programme_id } = req.body || {};
    if (!programme_id) {
      if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch {} }
      return res.status(400).json({ error: 'programme_id required' });
    }
    if (!req.file) return res.status(400).json({ error: 'file required' });

    const filename = req.file.filename;            // เก็บชื่อไฟล์ล้วนใน DB
    const publicUrl = `/uploads/${filename}`;      // พาธสาธารณะที่ Express เสิร์ฟ

    const { rows } = await pool.query(
      `INSERT INTO program_uploads (programme_id, file_path, original_name, uploaded_by)
       VALUES ($1,$2,$3,$4)
       RETURNING id, programme_id, file_path, original_name, uploaded_by, created_at`,
      [programme_id, filename, req.file.originalname, req.user.id]
    );

    // อัปเดต cover_image ของโปรแกรมถ้ายังว่าง
    await pool.query(
      `UPDATE programmes
         SET cover_image = $1, updated_at = now()
       WHERE id = $2 AND (cover_image IS NULL OR cover_image = '')`,
      [publicUrl, programme_id]
    );

    res.status(201).json({ ...rows[0], url: publicUrl });
  }
);

export default router;
