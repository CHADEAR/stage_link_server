// src/routes/control.routes.js
import { Router } from "express";
import { spinOnly, voteAndSpin, pollQueue } from "../controllers/control.controller.js";

const router = Router();

router.post("/spin-only", spinOnly);   // สำหรับแผงล่างซ้าย
router.post("/vote", voteAndSpin);     // สำหรับแผงล่างขวา
router.get("/poll", pollQueue);        // สำหรับ ESP32 โพลล์รับคิว

export default router;
