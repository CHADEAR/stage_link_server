// src/controllers/control.controller.js
import { pool } from "../lib/db.js";

async function ensureQueueTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS control_queue (
      id SERIAL PRIMARY KEY,
      player TEXT NOT NULL CHECK (player IN ('player1','player2','player3','player4')),
      light  BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      taken_at   TIMESTAMPTZ
    );
  `);
}

/** POST /api/control/enqueue { player, light } */
export async function enqueueControl(req, res) {
  try {
    const { player, light } = req.body || {};
    if (!["player1","player2","player3","player4"].includes(player))
      return res.status(400).json({ ok:false, error:"invalid player" });
    if (typeof light !== "boolean")
      return res.status(400).json({ ok:false, error:"light must be boolean" });

    await ensureQueueTable();
    const { rows } = await pool.query(
      `INSERT INTO control_queue(player, light)
       VALUES ($1,$2) RETURNING id, player, light, created_at`,
      [player, light]
    );
    res.json({ ok:true, cmd: rows[0] });
  } catch (e) {
    console.error(e); res.status(500).json({ ok:false, error:"server error" });
  }
}

/** GET /api/control/next → ESP32 โพลล์ดึงคำสั่งถัดไป (FIFO) */
export async function nextControl(_req, res) {
  try {
    await ensureQueueTable();
    const { rows } = await pool.query(
      `UPDATE control_queue
       SET taken_at = now()
       WHERE id = (
         SELECT id FROM control_queue
         WHERE taken_at IS NULL
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       RETURNING id, player, light, created_at, taken_at`
    );
    res.json({ ok:true, cmd: rows[0] || null });
  } catch (e) {
    console.error(e); res.status(500).json({ ok:false, error:"server error" });
  }
}
// src/controllers/control.controller.js
// โค้ดคิวเดิมของคุณ…
const queue = []; // [{ player, light }] ทีละคำสั่ง

export async function enqueue(req, res) {
  const { player, light } = req.body; // light: true/false
  if (!player || typeof light !== "boolean") {
    return res.status(400).json({ ok:false, error:"bad request" });
  }
  queue.push({ player, light });
  res.json({ ok: true });
}

// === เพิ่มใหม่: resetAll ===
// ดันคำสั่ง home:true สำหรับผู้เล่นทั้ง 4 คน เข้า queue
export async function resetAll(_req, res) {
  const players = ["player1","player2","player3","player4"];
  players.forEach(p => queue.push({ player: p, home: true }));
  res.json({ ok: true });
}

// เดิม: ให้ ESP32 มาเอาคำสั่งถัดไป
export async function nextCmd(_req, res) {
  const cmd = queue.shift() || null;
  // ตัวอย่าง response:
  // { ok:true, cmd:{ player:"player1", light:true } }
  // หรือ  { ok:true, cmd:{ player:"player2", home:true } }
  res.json({ ok: true, cmd });
}
