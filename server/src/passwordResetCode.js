// src/passwordResetCode.js
import bcrypt from "bcryptjs";
import crypto from "crypto";
import pool from "./db.js";

const RESET_CODE_TTL_MIN = parseInt(process.env.RESET_CODE_TTL_MIN || "15", 10);

// สุ่มรหัส 6 หลัก (คงความยาวด้วย padStart)
function generateCode() {
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(6, "0"); // e.g. "039412"
}

function hashCode(code) {
  // ใช้ sha256 กับ code + salt สั้น ๆ เพื่อไม่เก็บ plaintext ใน DB
  return crypto.createHash("sha256").update(code).digest("hex");
}

/** POST /auth/forgot { email }
 *  - สร้างรหัส 6 หลัก
 *  - เก็บ hash + หมดอายุ
 *  - ใน dev ส่ง code กลับมาให้ทดสอบ
 */
export async function requestPasswordCode(req, res) {
  const { email } = req.body || {};
  const genericOK = { ok: true, message: "If this email exists, we sent a verification code." };
  if (!email) return res.json(genericOK);

  const lower = String(email).toLowerCase();
  const q = await pool.query("SELECT id FROM users WHERE email=$1 AND is_active=TRUE", [lower]);
  const user = q.rows[0];
  if (!user) {
    return res.json(genericOK); // ป้องกัน email enumeration
  }

  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MIN * 60 * 1000);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // ยกเลิกโค้ดเก่าที่ยังไม่ใช้
    await client.query("UPDATE password_resets SET used=TRUE WHERE user_id=$1 AND used=FALSE", [user.id]);
    // บันทึกโค้ดใหม่
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

  // TODO(prod): ส่งอีเมลจริงแนบ code ไปที่ lower
  if (process.env.NODE_ENV !== "production") {
    return res.json({ ok: true, code, expiresInMin: RESET_CODE_TTL_MIN });
  }
  return res.json(genericOK);
}

/** POST /auth/reset-code { email, code, password }
 *  - ตรวจ email/รหัส
 *  - อัปเดตรหัสผ่านใหม่
 *  - mark โค้ดเป็น used
 */
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

  const hash = await bcrypt.hash(password, 12);

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
