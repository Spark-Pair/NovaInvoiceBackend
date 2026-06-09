import express from "express";
import {
  deleteFbrApiKey,
  getFbrSettings,
  submitInvoiceToFbr,
  upsertFbrApiKey,
  validateInvoiceWithFbr,
} from "../controllers/fbrController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { resolveEntity } from "../middlewares/resolveEntity.js";

const router = express.Router();

router.use(protect, checkRole(["dev", "admin", "client"]), resolveEntity);

router.get("/settings", getFbrSettings);
router.put("/settings/keys", upsertFbrApiKey);
router.delete("/settings/keys/:environment", deleteFbrApiKey);

router.post("/invoices/:id/validate", validateInvoiceWithFbr);
router.post("/invoices/:id/submit", submitInvoiceToFbr);

export default router;
