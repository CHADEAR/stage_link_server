import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pool from "./db.js";

const {
  JWT_ACCESS_SECRET = "dev_access",
  JWT_REFRESH_SECRET = "dev_refresh",
  JWT_ACCESS_EXPIRES = "30m",
  JWT_REFRESH_EXPIRES = "7d",
} = process.env;

// ออกโทเคน
function signAccessToken(payload) {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRES });
}
function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES });
}

// ---------- Handlers ----------

// POST /auth/register {email, password}
export async function register(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email & password required" });

  const lower = String(email).toLowerCase();
  const found = await pool.query("SELECT 1 FROM users WHERE email=$1", [lower]);
  if (found.rowCount) return res.status(409).json({ error: "email exists" });

  const hash = await bcrypt.hash(password, 12);
  const r = await pool.query(
    "INSERT INTO users(email, password_hash, role) VALUES($1,$2,'user') RETURNING id,email,role,created_at",
    [lower, hash]
  );
  const user = r.rows[0];

  const access = signAccessToken({ sub: user.id, role: user.role });
  const refresh = signRefreshToken({ sub: user.id, role: user.role });

  res.status(201).json({ user, token: access, refreshToken: refresh });
}

// POST /auth/login {email, password}
export async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email & password required" });

  const lower = String(email).toLowerCase();
  const q = await pool.query(
    "SELECT id, email, role, password_hash FROM users WHERE email=$1 AND is_active=TRUE",
    [lower]
  );
  const user = q.rows[0];
  if (!user) return res.status(401).json({ error: "invalid credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });

  await pool.query("UPDATE users SET last_login=NOW() WHERE id=$1", [user.id]);

  const access = signAccessToken({ sub: user.id, role: user.role });
  const refresh = signRefreshToken({ sub: user.id, role: user.role });

  res.json({ user: { id: user.id, email: user.email, role: user.role }, token: access, refreshToken: refresh });
}

// POST /auth/refresh { refreshToken }
export async function refresh(req, res) {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: "refreshToken required" });

  try {
    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    // ออก access token ใหม่จาก payload เดิม (sub, role)
    const access = signAccessToken({ sub: payload.sub, role: payload.role });
    // NOTE: ตัวอย่างนี้ไม่ rotate refresh เพื่อง่ายต่อ dev
    res.json({ token: access });
  } catch {
    return res.status(401).json({ error: "invalid refresh token" });
  }
}

// POST /auth/logout (no-op สำหรับ localStorage refresh)
export async function logout(_req, res) {
  // ถ้าใช้ localStorage ไม่มีสิทธิ์ฝั่ง server ไปลบได้ → ให้ client ลบเอง
  res.json({ ok: true });
}

// ---------- Middleware ----------

export function authMiddleware(req, res, next) {
  const header = req.get("Authorization") || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return res.status(401).json({ error: "missing token" });

  try {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "unauthenticated" });
    if (req.user.role !== role) return res.status(403).json({ error: "forbidden" });
    next();
  };
}
