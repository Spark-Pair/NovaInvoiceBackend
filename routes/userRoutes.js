import express from 'express';
import {
  getAllUsers,
  getUserSettings,
  loginUser,
  logoutUser,
  setUserSettings,
} from '../controllers/userController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { checkRole } from '../middlewares/roleMiddleware.js';
import { resolveEntity } from '../middlewares/resolveEntity.js';

const router = express.Router();

router.get('/', getAllUsers);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.get('/settings', protect, checkRole(['admin', 'client']), resolveEntity, getUserSettings);
router.patch('/settings', protect, checkRole(['admin', 'client']), resolveEntity, setUserSettings);

export default router;
