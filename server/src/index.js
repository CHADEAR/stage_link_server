// src/index.js
import express from "express";
import cors from "cors";
import pool from "./db.js";
import { register, login, refresh, logout, authMiddleware, requireRole } from "./auth.js";
import { requestPasswordCode, resetWithCode } from "./passwordResetCode.js";

const app = express();
app.use(express.json());
app.use(cors());

// สร้างตารางอัตโนมัติรอบแรก
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets(expires_at);`);

  console.log("DB ready ✅");
}
init().catch(err => {
  console.error("DB init error:", err);
  process.exit(1);
});

// health
app.get("/health", async (_req, res) => {
  try {
    const r = await pool.query("SELECT 1 AS ok");
    res.json({ status: "ok", db: r.rows[0].ok });
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message });
  }
});

// ---------- AUTH ----------
app.post("/auth/register", register);
app.post("/auth/login", login);
app.post("/auth/refresh", refresh);
app.post("/auth/logout", logout);

// ---------- FORGOT/RESET PASSWORD (OTP 6 หลัก) ----------
app.post("/auth/forgot", requestPasswordCode);   // { email }
app.post("/auth/reset-code", resetWithCode);     // { email, code, password }

// ---------- Protected/Example ----------
app.get("/notes", async (_req, res) => {
  const r = await pool.query("SELECT * FROM notes ORDER BY id DESC");
  res.json(r.rows);
});

app.post("/notes", authMiddleware, async (req, res) => {
  const { body } = req.body || {};
  if (!body) return res.status(400).json({ error: "body required" });
  const r = await pool.query("INSERT INTO notes(body) VALUES($1) RETURNING *", [body]);
  res.status(201).json(r.rows[0]);
});

// เฉพาะ admin
app.post("/admin/example", authMiddleware, requireRole("admin"), (req, res) => {
  res.json({ ok: true, by: req.user });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
