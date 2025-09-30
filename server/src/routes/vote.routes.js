import { Router } from "express";
import { setVote, getVotes, resetVotes, getLastReset } from "../controllers/vote.controller.js";
import pool from "../db.js";
import { subscribe } from "../voteHub.js";

const router = Router();

// ESP32 หรือ client อื่นส่งค่าโหวต
router.post("/set", setVote);

// ดึง snapshot ล่าสุด
router.get("/current", getVotes);

// รีเซ็ตทุก player = 0
router.post("/reset", resetVotes);

// ให้ ESP32 โพลล์ดูว่ามีรีเซ็ตล่าสุดเมื่อไหร่
router.get("/last-reset", getLastReset);

// Server-Sent Events สำหรับอัปเดตสดในเว็บ
router.get("/stream", async (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    // ป้องกัน proxy/nginx บัฟเฟอร์ (ถ้าใช้ reverse proxy)
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  // ส่ง snapshot แรกทันที
  const snap = await pool.query(`
    SELECT DISTINCT ON (player) player, value
    FROM votes
    ORDER BY player, created_at DESC
  `);
  res.write(`event: vote_update\ndata: ${JSON.stringify(snap.rows)}\n\n`);

  // ลงทะเบียนลูกค้า
  subscribe(res);

  // ส่ง ping กัน timeout
  const ping = setInterval(() => {
    try { res.write(`: ping\n\n`); } catch {}
  }, 25000);

  req.on("close", () => {
    clearInterval(ping);
    try { res.end(); } catch {}
  });
});

export default router;
