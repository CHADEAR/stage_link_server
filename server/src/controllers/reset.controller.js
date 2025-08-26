// src/controllers/reset.controller.js
import pool from "../db.js";
import { RESET_CODE_TTL_MIN, generateCode, hashCode } from "../services/reset.service.js";
import { hashPassword } from "../services/auth.service.js";

export async function requestPasswordCode(req, res) {
  const { email } = req.body || {};
  const genericOK = { ok: true, message: "If this email exists, we sent a verification code." };
  if (!email) return res.json(genericOK);

  const lower = String(email).toLowerCase();
  const q = await pool.query("SELECT id FROM users WHERE email=$1 AND is_active=TRUE", [lower]);
  const user = q.rows[0];
  if (!user) return res.json(genericOK);

  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MIN * 60 * 1000);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE password_resets SET used=TRUE WHERE user_id=$1 AND used=FALSE", [user.id]);
    await client.query(
      "INSERT INTO password_resets(user_id, token_hash, expires_at, used) VALUES ($1,$2,$3,FALSE)",
      [user.id, codeHash, expiresAt]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("forgot/code error:", e);
    return res.status(500).json({ error: "internal error" });
  } finally {
    client.release();
  }

  if (process.env.NODE_ENV !== "production") {
    return res.json({ ok: true, code, expiresInMin: RESET_CODE_TTL_MIN });
  }
  return res.json(genericOK);
}

export async function verifyPasswordCode(req, res) {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: "email and code required" });

  const lower = String(email).toLowerCase();
  const uq = await pool.query("SELECT id FROM users WHERE email=$1 AND is_active=TRUE", [lower]);
  const user = uq.rows[0];
  if (!user) return res.status(400).json({ error: "invalid email or code" });

  const codeHash = hashCode(code);
  const rq = await pool.query(
    `SELECT id, expires_at, used
       FROM password_resets
      WHERE user_id=$1 AND token_hash=$2
      ORDER BY created_at DESC
      LIMIT 1`,
    [user.id, codeHash]
  );
  const pr = rq.rows[0];
  if (!pr) return res.status(400).json({ error: "invalid email or code" });
  if (pr.used) return res.status(400).json({ error: "code already used" });
  if (new Date(pr.expires_at) < new Date()) return res.status(400).json({ error: "code expired" });

  return res.json({ ok: true });
}

export async function resetWithCode(req, res) {
  const { email, code, password } = req.body || {};
  if (!email || !code || !password) {
    return res.status(400).json({ error: "email, code, password required" });
  }

  const lower = String(email).toLowerCase();
  const uq = await pool.query("SELECT id FROM users WHERE email=$1 AND is_active=TRUE", [lower]);
  const user = uq.rows[0];
  if (!user) return res.status(400).json({ error: "invalid email or code" });

  const codeHash = hashCode(code);
  const rq = await pool.query(
    `SELECT id, expires_at, used FROM password_resets
     WHERE user_id=$1 AND token_hash=$2
     ORDER BY created_at DESC
     LIMIT 1`,
    [user.id, codeHash]
  );
  const pr = rq.rows[0];
  if (!pr) return res.status(400).json({ error: "invalid email or code" });
  if (pr.used) return res.status(400).json({ error: "code already used" });
  if (new Date(pr.expires_at) < new Date()) return res.status(400).json({ error: "code expired" });

  const hash = await hashPassword(password);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2", [hash, user.id]);
    await client.query("UPDATE password_resets SET used=TRUE WHERE id=$1", [pr.id]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("reset/code error:", e);
    return res.status(500).json({ error: "internal error" });
  } finally {
    client.release();
  }

  return res.json({ ok: true });
}
