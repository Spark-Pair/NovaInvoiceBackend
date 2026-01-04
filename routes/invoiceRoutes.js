import express from 'express';
import { protect } from '../middlewares/authMiddleware.js'; // optional auth
import { checkRole } from '../middlewares/roleMiddleware.js';
import { createInvoice, getBuyerDetails, getBuyers } from '../controllers/invoiceController.js';

const router = express.Router();

// All routes protected by auth middleware if needed
router.post("/", protect, checkRole(['admin', 'client']), createInvoice);
router.get("/buyers", protect, checkRole(['admin', 'client']), getBuyers);
router.get("/buyers/:id", protect, checkRole(['admin', 'client']), getBuyerDetails);

export default router;
