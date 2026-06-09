import express from 'express';
import {
  createAdmin,
  getAdmins,
  getAllUsers,
  getUserSettings,
  loginUser,
  logoutAdminSessions,
  logoutUser,
  resetAdminPassword,
  setUserSettings,
  toggleAdminStatus,
} from '../controllers/userController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { checkRole } from '../middlewares/roleMiddleware.js';
import { resolveEntity } from '../middlewares/resolveEntity.js';

const router = express.Router();

router.get('/', protect, checkRole(['dev']), getAllUsers);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.get('/admins', protect, checkRole(['dev']), getAdmins);
router.post('/admins', protect, checkRole(['dev']), createAdmin);
router.patch('/admins/:id/reset-password', protect, checkRole(['dev']), resetAdminPassword);
router.patch('/admins/:id/logout', protect, checkRole(['dev']), logoutAdminSessions);
router.patch('/admins/:id/toggle-status', protect, checkRole(['dev']), toggleAdminStatus);
router.get('/settings', protect, checkRole(['dev', 'admin', 'client']), resolveEntity, getUserSettings);
router.patch('/settings', protect, checkRole(['dev', 'admin', 'client']), resolveEntity, setUserSettings);

export default router;
