const express = require('express');
const prisma = require('../config/prisma');
const { handleMpesaCallback } = require('../utils/mpesa');

const router = express.Router();

// @desc    Handle M-PESA callback
// @route   POST /api/mpesa/callback
// @access  Public (called by M-PESA)
const mpesaCallback = async (req, res) => {
  try {
    const callbackData = req.body;

    console.log('M-PESA Callback received:', JSON.stringify(callbackData, null, 2));

    const result = handleMpesaCallback(callbackData);

    if (result.success) {
      // Find transaction by CheckoutRequestID using Prisma
      const transaction = await prisma.transaction.findFirst({
        where: {
          mpesaResponse: {
            path: ['checkoutRequestID'],
            equals: result.checkoutRequestID,
          },
        },
      });

      if (transaction) {
        // Update transaction status
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'success',
            mpesaResponse: {
              ...transaction.mpesaResponse,
              ...result,
            },
          },
        });

        // Update loan fee status
        if (transaction.loanId) {
          await prisma.loan.update({
            where: { id: transaction.loanId },
            data: { feePaid: true },
          });
        }

        console.log('Payment processed successfully for loan:', transaction.loanId);
      }
    } else {
      // Find transaction and update status to failed
      const transaction = await prisma.transaction.findFirst({
        where: {
          mpesaResponse: {
            path: ['checkoutRequestID'],
            equals: result.checkoutRequestID,
          },
        },
      });

      if (transaction) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'failed',
            mpesaResponse: {
              ...transaction.mpesaResponse,
              ...result,
            },
          },
        });

        console.log('Payment failed for transaction:', transaction.id);
      }
    }

    // Always respond with success to M-PESA
    res.json({ success: true });
  } catch (error) {
    console.error('Error processing M-PESA callback:', error);
    // Still respond with success to avoid retries
    res.json({ success: true });
  }
};

router.post('/callback', mpesaCallback);

module.exports = router;
