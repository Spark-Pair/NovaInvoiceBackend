import express from 'express';
import { protect } from '../middlewares/authMiddleware.js'; // optional auth
import { checkRole } from '../middlewares/roleMiddleware.js';
import { bulkUploadInvoices, createInvoice, deleteInvoice, getBuyerDetails, getBuyers, getInvoices, updateInvoice } from '../controllers/invoiceController.js';
import { upload } from '../middlewares/uploadMiddleware.js';
import { resolveEntity } from '../middlewares/resolveEntity.js';

const router = express.Router();

// All routes protected by auth middleware if needed
router.post("/", protect, checkRole(['dev', 'admin', 'client']), resolveEntity, createInvoice);
router.get("/", protect, checkRole(['dev', 'admin', 'client']), resolveEntity, getInvoices);
router.patch("/:id", protect, checkRole(['dev', 'admin', 'client']), resolveEntity, updateInvoice);
router.delete("/:id", protect, checkRole(['dev', 'admin', 'client']), resolveEntity, deleteInvoice);
router.post(
  "/bulk-upload",
  protect,
  checkRole(['dev', 'admin', 'client']),
  resolveEntity,
  upload.single('file'), // 👈 must match frontend key
  bulkUploadInvoices
);
router.get("/buyers", protect, checkRole(['dev', 'admin', 'client']), resolveEntity, getBuyers);
router.get("/buyers/:id", protect, checkRole(['dev', 'admin', 'client']), getBuyerDetails);

export default router;
