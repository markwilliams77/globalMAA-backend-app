// routes/tenders.routes.ts
import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { createTender, getTenders, getTenderById } from "../controllers/tenders.controllers";

const router = express.Router();

router.post("/", authMiddleware, createTender);
router.get("/", authMiddleware, getTenders);
router.get("/:id", authMiddleware, getTenderById);

export default router;