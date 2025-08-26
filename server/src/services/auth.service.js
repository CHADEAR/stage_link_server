// src/services/auth.service.js
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const {
  JWT_ACCESS_SECRET = "dev_access",
  JWT_REFRESH_SECRET = "dev_refresh",
  JWT_ACCESS_EXPIRES = "30m",
  JWT_REFRESH_EXPIRES = "7d",
} = process.env;

export function signAccessToken(payload) {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRES });
}
export function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES });
}
export function verifyAccess(token) {
  return jwt.verify(token, JWT_ACCESS_SECRET);
}
export function verifyRefresh(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

// bcrypt helpers
export function hashPassword(raw) {
  return bcrypt.hash(raw, 12);
}
export function comparePassword(raw, hash) {
  return bcrypt.compare(raw, hash);
}
