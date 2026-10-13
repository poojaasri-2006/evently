const express = require('express');
const router = express.Router();

const {
  getProfile,
  updateProfile,
  updateVendorProfile,
  uploadVendorImage,
  updatePassword,
  deleteAccount,
  getNotificationPreferences,
  updateNotificationPreferences
} = require('../controllers/profile.controller');
const { authMiddleware, requireOrganizer, requireVendor } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.get('/', authMiddleware, getProfile);
router.patch('/organizer', authMiddleware, requireOrganizer, updateProfile);
router.patch('/vendor', authMiddleware, requireVendor, updateVendorProfile);
router.post('/vendor/image', authMiddleware, requireVendor, upload.single('image'), uploadVendorImage);
router.post('/password', authMiddleware, updatePassword);
router.post('/delete-account', authMiddleware, deleteAccount);
router.get('/notification-preferences', authMiddleware, getNotificationPreferences);
router.patch('/notification-preferences', authMiddleware, updateNotificationPreferences);

module.exports = router;
