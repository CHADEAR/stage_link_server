// src/middlewares/auth.js
import { verifyAccess } from "../services/auth.service.js";

export function authMiddleware(req, res, next) {
  const header = req.get("Authorization") || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "missing token", code: "MISSING_TOKEN" });
  }
  try {
    const payload = verifyAccess(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: "invalid token", code: "INVALID_TOKEN" });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "unauthenticated" });
    if (req.user.role !== role) return res.status(403).json({ error: "forbidden" });
    next();
  };
}
