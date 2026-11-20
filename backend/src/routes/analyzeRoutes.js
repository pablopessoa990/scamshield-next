import { Router } from "express";
import { analyzeController } from "../controllers/analyzeController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/requireDatabase.js";
const router = Router();
router.post("/", requireDatabase, requireAuth, analyzeController);
export default router;
