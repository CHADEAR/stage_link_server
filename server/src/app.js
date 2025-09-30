// src/app.js
import express from "express";
import cors from "cors";
import pool from "./db.js";
import authRoutes from "./routes/auth.routes.js";
import notesRoutes from "./routes/notes.routes.js";
import errorHandler from "./middlewares/error.js";

// โหวตเดิม
import voteRoutes from "./routes/vote.routes.js";
// ✅ ควบคุมเซอร์โว (spin-only / vote+spin / poll)
import controlRoutes from "./routes/control.routes.js";

const app = express();
app.use(express.json());
app.use(cors());

// mount API
app.use("/api/vote",    voteRoutes);
app.use("/api/control", controlRoutes);

// (ครั้งแรก) สร้างตารางที่จำเป็น
async function init() {
  // ตัวอย่างตารางเดิม
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // เผื่อยังไม่มีตาราง votes
  await pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id BIGSERIAL PRIMARY KEY,
      player TEXT NOT NULL,
      value INTEGER NOT NULL,
      source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_votes_player_created ON votes(player, created_at DESC);`);

  // ตารางสำหรับ reset password (ของคุณเดิม)
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

  // ✅ ตารางคิวสั่งงานให้ ESP32 มาโพลล์
  await pool.query(`
    CREATE TABLE IF NOT EXISTS control_queue (
      id BIGSERIAL PRIMARY KEY,
      player TEXT NOT NULL,
      led BOOLEAN NOT NULL DEFAULT true,  -- true = เปิดไฟ (โหวต), false = ไม่เปิดไฟ (spin-only)
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_control_queue_id ON control_queue(id);`);

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

// routes อื่น ๆ
app.use("/auth", authRoutes);
app.use("/notes", notesRoutes);

// error handler กลาง (ต้องวางหลัง routes)
app.use(errorHandler);

// กัน process ตายจาก promise ที่ไม่ถูกจับ
process.on("unhandledRejection", (e) => {
  console.error("UNHANDLED REJECTION:", e);
});
process.on("uncaughtException", (e) => {
  console.error("UNCAUGHT EXCEPTION:", e);
});

// ฟังทุก IP ในวงแลน/ฮอตสปอต
app.listen(3000, "0.0.0.0", () => {
  console.log("Server running at http://0.0.0.0:3000");
});

export default app;
