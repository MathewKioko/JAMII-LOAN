const express = require('express');
const { getAvailablePaymentMethods } = require('../utils/paymentAlternatives');
const { handleFlutterwaveWebhook } = require('../utils/flutterwave');

const router = express.Router();

// @desc    Get available payment methods
// @route   GET /api/payment/methods
// @access  Public
const getPaymentMethods = async (req, res) => {
  try {
    const methods = getAvailablePaymentMethods();

    res.json({
      success: true,
      data: methods,
    });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment methods',
    });
  }
};

// @desc    Handle Flutterwave webhook
// @route   POST /api/payment/webhook/flutterwave
// @access  Public (from Flutterwave)
const flutterwaveWebhook = async (req, res) => {
  try {
    console.log('Received Flutterwave webhook:', req.body);

    const result = await handleFlutterwaveWebhook(req.body);

    if (result.success) {
      res.status(200).json({ status: 'success' });
    } else {
      res.status(400).json({ status: 'failed', message: result.message });
    }
  } catch (error) {
    console.error('Flutterwave webhook error:', error);
    res.status(500).json({ status: 'error', message: 'Webhook processing failed' });
  }
};

router.get('/methods', getPaymentMethods);
router.post('/webhook/flutterwave', express.raw({ type: 'application/json' }), flutterwaveWebhook);

module.exports = router;
