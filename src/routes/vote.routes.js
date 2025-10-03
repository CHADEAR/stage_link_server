// src/routes/vote.routes.js
import { Router } from "express";
import { pushVote, getSnapshot } from "../controllers/vote.controller.js";

const r = Router();
r.post("/push", pushVote);       // POST /api/vote/push
r.get("/snapshot", getSnapshot); // GET  /api/vote/snapshot
export default r;
