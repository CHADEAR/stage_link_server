// src/passwordReset.js
import bcrypt from "bcryptjs";
import crypto from "crypto";
import pool from "./db.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const RESET_TOKEN_TTL_MIN = parseInt(process.env.RESET_TOKEN_TTL_MIN || "15", 10);

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// POST /auth/forgot { email }
export async function requestPasswordReset(req, res) {
  const { email } = req.body || {};
  // ตอบกลับแบบกลาง ๆ เสมอ เพื่อไม่ให้วัดได้ว่าอีเมลนี้มีในระบบหรือไม่
  const genericOK = { ok: true, message: "If this email exists, we have sent a reset link." };

  if (!email) return res.json(genericOK);

  const lower = String(email).toLowerCase();
  const q = await pool.query(
    "SELECT id FROM users WHERE email=$1 AND is_active=TRUE",
    [lower]
  );
  const user = q.rows[0];

  if (!user) {
    // ไม่บอกว่าไม่มี user นี้
    return res.json(genericOK);
  }

  // สร้าง token แบบสุ่มและเก็บเป็น hash
  const rawToken = crypto.randomBytes(32).toString("hex"); // 64 ตัวอักษร
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60 * 1000);

  // ใช้ transaction: ยกเลิก token เก่าที่ยังไม่ใช้ แล้วออก token ใหม่
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE password_resets SET used=TRUE WHERE user_id=$1 AND used=FALSE", [user.id]);
    await client.query(
      "INSERT INTO password_resets(user_id, token_hash, expires_at, used) VALUES ($1,$2,$3,FALSE)",
      [user.id, tokenHash, expiresAt]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("forgot error:", e);
    return res.status(500).json({ error: "internal error" });
  } finally {
    client.release();
  }

  // ปกติจะส่งอีเมลที่มีลิงก์นี้ให้ผู้ใช้
  const resetLink = `${FRONTEND_URL}/reset-password?token=${rawToken}`;

  // ใน dev ให้ส่งลิงก์กลับไปเพื่อทดสอบได้สะดวก
  if (process.env.NODE_ENV !== "production") {
    return res.json({ ok: true, resetLink, expiresInMin: RESET_TOKEN_TTL_MIN });
  }

  // ใน prod ตอบแบบกลาง ๆ
  return res.json(genericOK);
}

// POST /auth/reset { token, password }
export async function resetPassword(req, res) {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: "token & password required" });

  const tokenHash = hashToken(token);

  // หา token ที่ยังไม่ใช้และไม่หมดอายุ
  const q = await pool.query(
    `SELECT id, user_id, expires_at, used
     FROM password_resets
     WHERE token_hash=$1
     ORDER BY created_at DESC
     LIMIT 1`,
    [tokenHash]
  );
  const pr = q.rows[0];
  const now = new Date();

  if (!pr || pr.used || new Date(pr.expires_at) < now) {
    return res.status(400).json({ error: "invalid or expired token" });
  }

  const hash = await bcrypt.hash(password, 12);

  // อัปเดตรหัสผ่านและ mark token ว่าใช้แล้ว (transaction)
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      "UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2",
      [hash, pr.user_id]
    );

    await client.query(
      "UPDATE password_resets SET used=TRUE WHERE id=$1",
      [pr.id]
    );

    // ตัวเลือก (ไม่จำเป็นตอนนี้): ทำ token อื่นของ user นี้เป็น used ด้วย
    // await client.query("UPDATE password_resets SET used=TRUE WHERE user_id=$1", [pr.user_id]);

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("reset error:", e);
    return res.status(500).json({ error: "internal error" });
  } finally {
    client.release();
  }

  // หมายเหตุ: ถ้าอยากบังคับให้ทุกอุปกรณ์ต้อง login ใหม่
  // จะต้องมีระบบเพิกถอน refresh token/เวอร์ชัน token เพิ่มเติม
  return res.json({ ok: true });
}
