const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(requireAuth);

// User notification routes (any authenticated user)
router.get('/', notificationController.getAllNotifications);
router.get('/:id', notificationController.getNotificationById);
router.put('/:id', notificationController.updateNotification);
router.put('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

// Admin routes (only admins can create notifications)
router.post('/', requireAuth, requireAdmin, notificationController.createNotification);

module.exports = router;

