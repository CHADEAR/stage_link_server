// src/routes/notes.routes.js
import { Router } from "express";
import pool from "../db.js";
import { authMiddleware } from "../middlewares/auth.js";

const r = Router();

r.get("/", async (_req, res) => {
  const q = await pool.query("SELECT * FROM notes ORDER BY id DESC");
  res.json(q.rows);
});

r.post("/", authMiddleware, async (req, res) => {
  const { body } = req.body || {};
  if (!body) return res.status(400).json({ error: "body required" });
  const q = await pool.query("INSERT INTO notes(body) VALUES($1) RETURNING *", [body]);
  res.status(201).json(q.rows[0]);
});

export default r;
