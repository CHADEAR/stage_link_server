import pool from "../db.js";
import { broadcast } from "../voteHub.js";

export const setVote = async (req, res) => {
  const { player, value, source } = req.body;
  if (!player || (value !== 0 && value !== 1)) {
    return res.status(400).json({ error: "invalid" });
  }

  await pool.query(
    `INSERT INTO votes (player, value, source) VALUES ($1, $2, $3)`,
    [player, value, source || "esp32"]
  );

  // ส่ง snapshot ล่าสุดของแต่ละ player ออกอากาศ
  const snap = await pool.query(`
    SELECT DISTINCT ON (player) player, value
    FROM votes
    ORDER BY player, created_at DESC
  `);
  broadcast(snap.rows);
  res.json({ ok: true });
};

export const getVotes = async (_req, res) => {
  const r = await pool.query(`
    SELECT DISTINCT ON (player) player, value
    FROM votes
    ORDER BY player, created_at DESC
  `);
  res.json({ rows: r.rows });
};

export const resetVotes = async (_req, res) => {
  const players = ["player1", "player2", "player3", "player4"];
  try {
    await pool.query("BEGIN");
    for (const p of players) {
      await pool.query(
        `INSERT INTO votes (player, value, source) VALUES ($1,$2,$3)`,
        [p, 0, "reset"]
      );
    }
    // บันทึกสัญญาณรีเซ็ตให้ ESP32 โพลล์ไปเห็น
    await pool.query(`INSERT INTO vote_commands (type) VALUES ('reset')`);
    await pool.query("COMMIT");

    const snap = await pool.query(`
      SELECT DISTINCT ON (player) player, value
      FROM votes
      ORDER BY player, created_at DESC
    `);
    broadcast(snap.rows);
    res.json({ ok: true });
  } catch (e) {
    await pool.query("ROLLBACK");
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const getLastReset = async (_req, res) => {
  const r = await pool.query(`
    SELECT EXTRACT(EPOCH FROM MAX(created_at))::bigint AS ts
    FROM vote_commands
    WHERE type = 'reset'
  `);
  res.json({ resetAt: Number(r.rows[0]?.ts || 0) });
};
