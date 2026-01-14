const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(requireAuth);

// Admin routes (only admins can access stats, all transactions, and delete)
router.get('/stats', requireAuth, requireAdmin, transactionController.getTransactionStats);
router.get('/', requireAuth, requireAdmin, transactionController.getAllTransactions);
router.delete('/:id', requireAuth, requireAdmin, transactionController.deleteTransaction);

// Transaction CRUD routes (any authenticated user)
router.post('/', requireAuth, transactionController.createTransaction);
router.get('/:id', requireAuth, transactionController.getTransactionById);
router.put('/:id', requireAuth, transactionController.updateTransaction);

// User-specific routes (only the user themselves)
router.get('/user/:userId', requireAuth, transactionController.getUserTransactions);

module.exports = router;

