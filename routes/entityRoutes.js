import express from 'express';
import { createEntity, getEntities, resetEntityPassword, toggleEntityStatus, updateEntity } from '../controllers/entityController.js';
import { protect } from '../middlewares/authMiddleware.js'; // optional auth
import { checkRole } from '../middlewares/roleMiddleware.js';

const router = express.Router();

// All routes protected by auth middleware if needed
router.post('/', protect, checkRole(['admin']), createEntity);
router.get('/', protect, checkRole(['admin']), getEntities);
router.patch('/:id', protect, checkRole(['admin']), updateEntity);
router.patch('/:id/toggle-status', protect, checkRole(['admin']), toggleEntityStatus);
router.patch('/:id/reset-password', protect, checkRole(['admin']), resetEntityPassword);

export default router;
