// src/services/reset.service.js
import crypto from "crypto";

export const RESET_CODE_TTL_MIN = parseInt(process.env.RESET_CODE_TTL_MIN || "15", 10);

export function generateCode() {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

export function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}
