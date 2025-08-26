// src/controllers/auth.controller.js
import pool from "../db.js";
import { signAccessToken, signRefreshToken, hashPassword, comparePassword, verifyRefresh } from "../services/auth.service.js";

export async function register(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email & password required", code: "INPUT_REQUIRED" });
  }
  const lower = String(email).toLowerCase();

  const found = await pool.query("SELECT 1 FROM users WHERE email=$1", [lower]);
  if (found.rowCount) {
    return res.status(409).json({ error: "email exists", code: "EMAIL_EXISTS" });
  }

  const hash = await hashPassword(password);
  const r = await pool.query(
    "INSERT INTO users(email, password_hash, role) VALUES($1,$2,'user') RETURNING id,email,role,created_at",
    [lower, hash]
  );
  const user = r.rows[0];

  return res.status(201).json({
    user,
    message: "Registered successfully. Please login.",
  });
}

export async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email & password required", code: "INPUT_REQUIRED" });
  }

  const lower = String(email).toLowerCase();
  const q = await pool.query(
    "SELECT id, email, role, password_hash FROM users WHERE email=$1 AND is_active=TRUE",
    [lower]
  );
  const user = q.rows[0];

  if (!user) {
    return res.status(401).json({
      error: process.env.NODE_ENV === "production"
        ? "invalid credentials"
        : "Email not found. Please sign up first.",
      code: "USER_NOT_FOUND"
    });
  }

  const ok = await comparePassword(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({
      error: process.env.NODE_ENV === "production"
        ? "invalid credentials"
        : "Incorrect password. Please try again.",
      code: "BAD_PASSWORD"
    });
  }

  await pool.query("UPDATE users SET last_login=NOW() WHERE id=$1", [user.id]);

  const access = signAccessToken({ sub: user.id, role: user.role });
  const refresh = signRefreshToken({ sub: user.id, role: user.role });

  res.json({
    user: { id: user.id, email: user.email, role: user.role },
    token: access,
    refreshToken: refresh
  });
}

export async function refresh(req, res) {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: "refreshToken required" });

  try {
    const payload = verifyRefresh(refreshToken);
    const access = signAccessToken({ sub: payload.sub, role: payload.role });
    res.json({ token: access });
  } catch {
    return res.status(401).json({ error: "invalid refresh token" });
  }
}

export async function logout(_req, res) {
  res.json({ ok: true });
}
