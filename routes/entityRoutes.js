import express from 'express';
import { createEntity, getEntities, resetEntityPassword, toggleEntityStatus, updateEntity } from '../controllers/entityController.js';
import { protect } from '../middlewares/authMiddleware.js'; // optional auth
import { checkRole } from '../middlewares/roleMiddleware.js';

const router = express.Router();

// All routes protected by auth middleware if needed
router.post('/', protect, checkRole(['dev', 'admin']), createEntity);
router.get('/', protect, checkRole(['dev', 'admin']), getEntities);
router.patch('/:id', protect, checkRole(['dev', 'admin']), updateEntity);
router.patch('/:id/toggle-status', protect, checkRole(['dev', 'admin']), toggleEntityStatus);
router.patch('/:id/reset-password', protect, checkRole(['dev', 'admin']), resetEntityPassword);

export default router;
