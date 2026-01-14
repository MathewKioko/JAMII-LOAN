const express = require('express');
const { applyForLoan, payLoanFee } = require('../controllers/loanController');
const { requireAuth } = require('../middleware/auth');
const { validateLoanApplication } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// @route   POST /api/loan/apply
router.post('/apply', validateLoanApplication, applyForLoan);

// @route   POST /api/loan/:id/pay-fee
router.post('/:id/pay-fee', payLoanFee);

module.exports = router;
