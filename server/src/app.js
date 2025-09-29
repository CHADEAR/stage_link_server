// src/app.js
import express from "express";
import cors from "cors";
import pool from "./db.js";
import authRoutes from "./routes/auth.routes.js";
import notesRoutes from "./routes/notes.routes.js";
import adminRoutes from "./routes/admin.routes.js";     // 👈 NEW
import programsRoutes from "./routes/programs.routes.js"; // 👈 NEW
import meRoutes from "./routes/me.routes.js";             // 👈 NEW
import errorHandler from "./middlewares/error.js";


const app = express();
app.use(express.json());
app.use(cors());


// (ครั้งแรก) สร้างตารางที่จำเป็น
async function init() {
  // extensions
  await pool.query(`CREATE EXTENSION IF NOT EXISTS citext;`);
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  // notes (เดิม)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // password_resets (เดิม)
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

  // ENUM per-program role
  await pool.query(`
    DO $$ BEGIN
      CREATE TYPE program_role AS ENUM ('mc','judge','guest','voter');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  // programs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS programs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL UNIQUE,
      category TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN NEW.updated_at := NOW(); RETURN NEW; END $$;
  `);

  await pool.query(`DROP TRIGGER IF EXISTS trg_programs_updated_at ON programs;`);
  await pool.query(`
    CREATE TRIGGER trg_programs_updated_at
    BEFORE UPDATE ON programs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  `);

  // user_program_access (หลายบทบาท/รายการเดียว)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_program_access (
      user_id    UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
      program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
      role       program_role NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, program_id, role)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_upa_user    ON user_program_access(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_upa_program ON user_program_access(program_id);`);
  await pool.query(`DROP TRIGGER IF EXISTS trg_upa_updated_at ON user_program_access;`);
  await pool.query(`
    CREATE TRIGGER trg_upa_updated_at
    BEFORE UPDATE ON user_program_access
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  `);

  // sessions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked BOOLEAN NOT NULL DEFAULT FALSE,
      ip_addr INET,
      user_agent TEXT
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_live ON sessions(expires_at) WHERE revoked = FALSE;`);

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

// routes
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);        // 👈 NEW
app.use("/programs", programsRoutes);  // 👈 NEW
app.use("/me", meRoutes);              // 👈 NEW

// error handler
app.use(errorHandler);

process.on("unhandledRejection", (e) => { console.error("UNHANDLED REJECTION:", e); });
process.on("uncaughtException", (e) => { console.error("UNCAUGHT EXCEPTION:", e); });

export default app;
