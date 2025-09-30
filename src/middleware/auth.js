// src/middleware/auth.js
import jwt from "jsonwebtoken";

/** ไม่บังคับต้องล็อกอิน: ถ้ามี token ถูกต้องจะเติม req.user ให้ */
export function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
  } catch (_e) {
    // token ไม่ถูกต้องก็ปล่อยผ่าน (ไม่เติม req.user)
  }
  next();
}

/** บังคับต้องมี token และต้อง verify ผ่าน */
export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (_e) {
    return res.status(401).json({ error: "invalid token" });
  }
}

/** เฉพาะ admin เท่านั้น */
export function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== "admin") {
      return res.status(403).json({ error: "forbidden" });
    }
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (_e) {
    return res.status(401).json({ error: "invalid token" });
  }
}
