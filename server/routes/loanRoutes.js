const express = require('express');
const { applyForLoan, payLoanFee, handleStkCallback } = require('../controllers/loanController');
const { protect } = require('../middleware/auth');
const { validateLoanApplication } = require('../middleware/validation');

const router = express.Router();

// Public route for M-Pesa callback
// @route   POST /api/loan/stk-callback
router.post('/stk-callback', handleStkCallback);

// All other routes require authentication
router.use(protect);

// @route   POST /api/loan/apply
router.post('/apply', validateLoanApplication, applyForLoan);

// @route   POST /api/loan/:id/pay-fee
router.post('/:id/pay-fee', payLoanFee);

module.exports = router;
