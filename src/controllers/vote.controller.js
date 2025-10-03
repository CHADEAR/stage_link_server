// src/controllers/vote.controller.js
import { pool } from "../lib/db.js";

async function ensureSnapshotTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vote_snapshot (
      player TEXT PRIMARY KEY CHECK (player IN ('player1','player2','player3','player4')),
      value  INTEGER NOT NULL CHECK (value IN (0,1)),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    INSERT INTO vote_snapshot(player, value)
    VALUES ('player1',0),('player2',0),('player3',0),('player4',0)
    ON CONFLICT (player) DO NOTHING;
  `);
}

/** POST /api/vote/push { player, value }  // value: 1=ไฟติด, 0=ไฟดับ */
export async function pushVote(req, res) {
  try {
    const { player, value } = req.body || {};
    if (!["player1","player2","player3","player4"].includes(player))
      return res.status(400).json({ ok:false, error:"invalid player" });
    const v = Number(value);
    if (![0,1].includes(v))
      return res.status(400).json({ ok:false, error:"invalid value" });

    await ensureSnapshotTable();
    await pool.query(
      `INSERT INTO vote_snapshot(player, value, updated_at)
       VALUES ($1,$2,now())
       ON CONFLICT (player) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
      [player, v]
    );
    res.json({ ok:true });
  } catch (e) {
    console.error(e); res.status(500).json({ ok:false, error:"server error" });
  }
}

/** GET /api/vote/snapshot → { ok, items:[{player,value,updated_at}], current } */
export async function getSnapshot(_req, res) {
  try {
    await ensureSnapshotTable();
    const snap = await pool.query(
      `SELECT player, value, updated_at FROM vote_snapshot ORDER BY player ASC`
    );
    const latestOn = snap.rows
      .filter(r => Number(r.value) === 1)
      .sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
    res.json({ ok:true, items: snap.rows, current: latestOn?.player || null });
  } catch (e) {
    console.error(e); res.status(500).json({ ok:false, error:"server error" });
  }
}
