import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { upload } from "../utils/upload.js";
import { createProgramAndUpload } from "../controllers/program-uploads.controller.js";

const r = Router();

r.post("/program-uploads", authMiddleware, upload.single("cover"), createProgramAndUpload);

export default r;
