import express from 'express';
import { protect } from '../middlewares/authMiddleware.js'; // optional auth
import { checkRole } from '../middlewares/roleMiddleware.js';
import { bulkUploadInvoices, createInvoice, deleteInvoice, getBuyerDetails, getBuyers, getInvoices, updateInvoice } from '../controllers/invoiceController.js';
import { upload } from '../middlewares/uploadMiddleware.js';
import { resolveEntity } from '../middlewares/resolveEntity.js';

const router = express.Router();

// All routes protected by auth middleware if needed
router.post("/", protect, checkRole(['admin', 'client']), resolveEntity, createInvoice);
router.get("/", protect, checkRole(['admin', 'client']), resolveEntity, getInvoices);
router.patch("/:id", protect, checkRole(['admin', 'client']), resolveEntity, updateInvoice);
router.delete("/:id", protect, checkRole(['admin', 'client']), resolveEntity, deleteInvoice);
router.post(
  "/bulk-upload",
  protect,
  checkRole(['admin', 'client']),
  resolveEntity,
  upload.single('file'), // 👈 must match frontend key
  bulkUploadInvoices
);
router.get("/buyers", protect, checkRole(['admin', 'client']), resolveEntity, getBuyers);
router.get("/buyers/:id", protect, checkRole(['admin', 'client']), getBuyerDetails);

export default router;