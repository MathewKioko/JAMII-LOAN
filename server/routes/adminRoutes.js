const express = require('express');
const {
  getAllLoans,
  approveLoan,
  rejectLoan,
  autoApproveLoan,
  specialApproveLoan,
  getLoanQueue,
  initiateLoanDisbursement,
  getAdminStats,
  sendApprovalNotification,
  processRefund,
  getAllUsers,
  updateUser,
  toggleUserStatus,
  getSystemSettings,
  updateSystemSetting,
  getAuditLogs,
  getSystemStatus,
  sendMessageToUser,
  sendMessageToAllUsers,
  getSentMessages,
  getMessageById,
  deleteMessage,
  getConversationWithUser,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/admin/loans
router.get('/loans', getAllLoans);

// @route   PATCH /api/admin/loan/:id/approve
router.patch('/loan/:id/approve', approveLoan);

// @route   PATCH /api/admin/loan/:id/reject
router.patch('/loan/:id/reject', rejectLoan);

// @route   PATCH /api/admin/loan/:id/auto-approve
router.patch('/loan/:id/auto-approve', autoApproveLoan);

// @route   PATCH /api/admin/loan/:id/special-approve
router.patch('/loan/:id/special-approve', specialApproveLoan);

// @route   GET /api/admin/loan-queue
router.get('/loan-queue', getLoanQueue);

// @route   POST /api/admin/loan/:id/disbursement
router.post('/loan/:id/disbursement', initiateLoanDisbursement);

// @route   GET /api/admin/stats
router.get('/stats', getAdminStats);

// @route   POST /api/admin/loan/:id/notify-approval
router.post('/loan/:id/notify-approval', sendApprovalNotification);

// @route   POST /api/admin/loan/:id/refund
router.post('/loan/:id/refund', processRefund);

// User Management Routes
// @route   GET /api/admin/users
router.get('/users', getAllUsers);

// @route   PATCH /api/admin/users/:id
router.patch('/users/:id', updateUser);

// @route   PATCH /api/admin/users/:id/status
router.patch('/users/:id/status', toggleUserStatus);

// System Settings Routes
// @route   GET /api/admin/settings
router.get('/settings', getSystemSettings);

// @route   PATCH /api/admin/settings/:key
router.patch('/settings/:key', updateSystemSetting);

// Audit Logs Routes
// @route   GET /api/admin/audit-logs
router.get('/audit-logs', getAuditLogs);

// System Status Routes
// @route   GET /api/admin/system-status
router.get('/system-status', getSystemStatus);

// Message Routes
// @route   POST /api/admin/messages/send
router.post('/messages/send', sendMessageToUser);

// @route   POST /api/admin/messages/send-all
router.post('/messages/send-all', sendMessageToAllUsers);

// @route   GET /api/admin/messages/sent
router.get('/messages/sent', getSentMessages);

// @route   GET /api/admin/messages/:id
router.get('/messages/:id', getMessageById);

// @route   DELETE /api/admin/messages/:id
router.delete('/messages/:id', deleteMessage);

// @route   GET /api/admin/messages/conversation/:userId
router.get('/messages/conversation/:userId', getConversationWithUser);

module.exports = router;
