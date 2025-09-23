// src/routes/auth.routes.js
import { Router } from "express";
import { register, login, refresh, logout } from "../controllers/auth.controller.js";
import { requestPasswordCode, verifyPasswordCode, resetWithCode } from "../controllers/reset.controller.js";
import { authMiddleware } from "../middlewares/auth.js";

const r = Router();

r.post("/register", register);
r.post("/login", login);
r.post("/refresh", refresh);
r.post("/logout", authMiddleware, logout);

r.post("/forgot", requestPasswordCode);
r.post("/verify-code", verifyPasswordCode);
r.post("/reset-code", resetWithCode);

export default r;
