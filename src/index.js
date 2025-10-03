import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

import { pool } from './lib/db.js';
import authRouter from './routes/auth.js';
import programmesRouter from './routes/programmes.js';
import usersRouter from './routes/users.js';
import uploadsRouter from './routes/uploads.js';
import voteRoutes from "./routes/vote.routes.js";
import controlRoutes from "./routes/control.routes.js";

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// ใช้โฟลเดอร์เดียวกับ Multer
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve('./uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ✅ อนุญาต cross-origin resource สำหรับรูป/ไฟล์
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60_000, limit: 120 }));

// ✅ เสิร์ฟไฟล์อัปโหลด พร้อมตั้ง CORP + cache header ชัดเจน
app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.use('/auth', authRouter);
app.use('/programmes', programmesRouter);
app.use('/users', usersRouter);
app.use('/uploads', uploadsRouter);

 // ✅ เส้นทางสำหรับหน้า Voter/ESP32 (แก้ชื่อเป็น /api/vote)
app.use('/api/vote', voteRoutes);      // POST /api/vote/push, GET /api/vote/snapshot
app.use('/api/control', controlRoutes); // POST /api/control/enqueue, GET /api/control/next


app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`[API] Listening on http://localhost:${PORT}`);
  console.log(`[API] Upload dir: ${UPLOAD_DIR}`);
});

