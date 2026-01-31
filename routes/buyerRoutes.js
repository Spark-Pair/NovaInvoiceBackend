import express from 'express';
import { createBuyer, getBuyers, toggleBuyerStatus, updateBuyer } from '../controllers/buyerController.js';
import { protect } from '../middlewares/authMiddleware.js'; // optional auth
import { checkRole } from '../middlewares/roleMiddleware.js';
import { resolveEntity } from '../middlewares/resolveEntity.js';

const router = express.Router();

// All routes protected by auth middleware if needed
router.post("/", protect, checkRole(['admin', 'client']), resolveEntity, createBuyer);
router.get("/", protect, checkRole(['admin', 'client']), resolveEntity, getBuyers);
router.patch("/:id", protect, checkRole(['admin', 'client']), updateBuyer);
router.patch("/:id/toggle-status", protect, checkRole(['admin', 'client']), toggleBuyerStatus);

export default router;
