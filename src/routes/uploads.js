import express from 'express';
import multer from 'multer';
import path from 'path';
import { pool } from '../lib/db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import fs from 'fs';

const router = express.Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (_req, file, cb) {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}_${safe}`);
  }
});
const upload = multer({ storage });

// Upload a file for a programme (admin only)
router.post('/program', requireAuth, requireRole('admin'), upload.single('file'), async (req, res) => {
  const { programme_id } = req.body || {};
  if (!programme_id) {
    // cleanup file if present
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(400).json({ error: 'programme_id required' });
  }
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const filePath = req.file.filename; // store relative
  const { rows } = await pool.query(
    `INSERT INTO program_uploads (programme_id, file_path, original_name, uploaded_by)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [programme_id, filePath, req.file.originalname, req.user.id]
  );
  res.status(201).json({ ...rows[0], url: `/static/${filePath}` });
});

export default router;
