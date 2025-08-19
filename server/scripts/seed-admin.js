// server/scripts/seed-admin.js
import bcrypt from "bcryptjs";
import pool from "../src/db.js";   // << ใช้ตัวเดียวกับแอป

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAILS.length || !ADMIN_PASSWORD) {
  console.error("❌ ต้องตั้ง ADMIN_EMAILS และ ADMIN_PASSWORD ใน .env");
  process.exit(1);
}

async function main() {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  for (const email of ADMIN_EMAILS) {
    const exists = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (exists.rowCount === 0) {
      await pool.query(
        "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')",
        [email, hash]
      );
      console.log("✅ สร้างแอดมิน:", email);
    } else {
      console.log("ℹ️ มีแอดมินอยู่แล้ว:", email);
    }
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error("❌ Seed admin failed:", err);
  process.exit(1);
});
