// src/controllers/control.controller.js
import pool from "../db.js";

// หมุนอย่างเดียว (ไม่โหวต ไม่เปิดไฟ)
export const spinOnly = async (req, res) => {
  const { player } = req.body;
  if (!player) return res.status(400).json({ error: "player required" });

  await pool.query(
    "INSERT INTO control_queue (player, led) VALUES ($1,$2)", 
    [player, false]
  );
  res.json({ ok: true });
};

// โหวต + หมุน (เปิดไฟ)
export const voteAndSpin = async (req, res) => {
  const { player } = req.body;
  if (!player) return res.status(400).json({ error: "player required" });

  // บันทึกโหวต (value=1, source=web)
  await pool.query(
    "INSERT INTO votes (player, value, source) VALUES ($1,$2,$3)",
    [player, 1, "web"]
  );

  // คิวคำสั่งให้ ESP32 หมุน และ เปิดไฟ
  await pool.query(
    "INSERT INTO control_queue (player, led) VALUES ($1,$2)",
    [player, true]
  );

  res.json({ ok: true });
};

// ESP32 โพลล์รับคำสั่งใหม่ ๆ
export const pollQueue = async (req, res) => {
  // รับ after (id ล่าสุดที่ ESP32 ทำไปแล้ว) ถ้าไม่ส่งให้ใช้ 0
  const after = Number(req.query.after || 0);
  const { rows } = await pool.query(
    `SELECT id, player, led 
     FROM control_queue
     WHERE id > $1
     ORDER BY id ASC
     LIMIT 20`,
    [after]
  );
  res.json({ rows });
};
