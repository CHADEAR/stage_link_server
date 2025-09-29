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

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure uploads dir
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60_000, limit: 120 }));

// Serve uploaded files statically
app.use('/static', express.static(path.resolve(UPLOAD_DIR)));

app.get('/health', async (req, res) => {
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

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => console.log(`[API] Listening on http://localhost:${PORT}`));
