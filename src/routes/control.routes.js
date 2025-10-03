// src/routes/control.routes.js
import { Router } from "express";
import { enqueue, nextCmd, resetAll } from "../controllers/control.controller.js";

const r = Router();

// สั่งคิวให้ ESP32 (หมุน + เลือกเปิด/ปิดไฟ)
r.post("/enqueue", enqueue);

// ESP32 มาดึงคำสั่งถัดไป
r.get("/next", nextCmd);

// รีเซ็ตฮาร์ดแวร์ทั้งหมด (ไฟดับ + เซอร์โวกลับ 0°)
r.post("/reset", resetAll);

export default r;
