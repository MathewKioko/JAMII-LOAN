const Loan = require('../models/Loan');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { initiateStkPush } = require('../utils/mpesa');
const { sendLoanApplicationEmail } = require('../utils/email');

// @desc    Apply for loan
// @route   POST /api/loan/apply
// @access  Private
const applyForLoan = async (req, res, next) => {
  try {
    const { amount, phoneNumber, description, paymentMethod = 'mpesa' } = req.body;
    const userId = req.user._id;

    // Check eligibility
    const user = await User.findById(userId);

    if (!user.isCitizen) {
      return res.status(400).json({
        success: false,
        message: 'Only Kenyan citizens are eligible for loans',
      });
    }

    // Check credit score
    if (user.creditScore < 400) {
      return res.status(400).json({
        success: false,
        message: 'Your credit score is too low for loan eligibility. Minimum required: 400',
      });
    }

    // Check for active loans
    const activeLoans = await Loan.find({
      userId,
      status: { $in: ['pending', 'approved'] },
    });

    if (activeLoans.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have pending or approved loans. Please settle them first.',
      });
    }

    // Check amount limits
    if (amount > user.loanLimit) {
      return res.status(400).json({
        success: false,
        message: `Loan amount exceeds your limit of ${user.loanLimit}`,
      });
    }

    // Get application fee from system settings or default to 50
    const SystemSettings = require('../models/SystemSettings');
    const feeSetting = await SystemSettings.findOne({ key: 'applicationFee' });
    const feeAmount = feeSetting ? feeSetting.value : 50;

    // Create loan record with pending status
    const loan = await Loan.create({
      userId,
      amount,
      phoneNumber,
      description,
      paymentMethod,
      feeAmount,
      status: 'pending',
      feePaid: false,
    });

    // Initiate payment using selected method
    const { processLoanFeePayment } = require('../utils/paymentAlternatives');

    try {
      const paymentData = {
        phoneNumber,
        email: user.email,
        name: user.fullName,
        userId: user._id,
        loanId: loan._id,
      };

      const paymentResponse = await processLoanFeePayment(
        paymentMethod,
        paymentData,
        feeAmount,
        `Loan Application Fee - ${user.fullName}`
      );

      // Update loan with transaction ID
      loan.mpesaTransactionId = paymentResponse.transactionId || paymentResponse.checkoutRequestID;
      await loan.save();

      // For synchronous payment methods, mark fee as paid immediately if successful
      const synchronousMethods = ['mock', 'card', 'paypal', 'stripe', 'bank'];
      if (synchronousMethods.includes(paymentMethod.toLowerCase()) && paymentResponse.success) {
        loan.feePaid = true;
        await loan.save();

        // Notify admins
        const admins = await User.find({ role: 'admin' });
        for (const admin of admins) {
          await Notification.create({
            userId: admin._id,
            loanId: loan._id,
            type: 'loan_application_submitted',
            title: 'New Loan Application Submitted',
            message: `${user.fullName} has submitted a loan application for KES ${amount} with fee paid.`,
            metadata: {
              amount,
              userName: user.fullName,
              userEmail: user.email,
            },
          });
        }
      }

      // Return transaction details to frontend for status tracking
      res.status(200).json({
        success: true,
        message: `Payment initiated via ${paymentMethod.toUpperCase()}. Please complete the payment to submit your loan application.`,
        data: {
          transactionId: paymentResponse.transactionId || paymentResponse.checkoutRequestID,
          merchantRequestId: paymentResponse.merchantRequestID,
          amount: feeAmount,
          phoneNumber,
          paymentMethod,
          loanId: loan._id,
          applicationData: {
            amount,
            description,
            feeAmount,
          },
        },
      });
    } catch (paymentError) {
      console.error('Payment initiation failed:', paymentError);
      // Delete the created loan if payment initiation fails
      await Loan.findByIdAndDelete(loan._id);
      return res.status(500).json({
        success: false,
        message: 'Failed to initiate payment. Please try again.',
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Pay loan fee after approval
// @route   POST /api/loan/:id/pay-fee
// @access  Private
const payLoanFee = async (req, res, next) => {
  try {
    const { paymentMethod = 'mock', paymentData } = req.body;
    const loanId = req.params.id;
    const userId = req.user._id;

    const loan = await Loan.findById(loanId);

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found',
      });
    }

    if (loan.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    if (loan.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Loan must be approved before paying fee',
      });
    }

    if (loan.feePaid) {
      return res.status(400).json({
        success: false,
        message: 'Fee already paid',
      });
    }

    // Use alternative payment methods
    const { processLoanFeePayment } = require('../utils/paymentAlternatives');

    try {
      const paymentResponse = await processLoanFeePayment(
        paymentMethod,
        paymentData,
        loan.feeAmount,
        loan._id
      );

      // Create transaction record
      await Transaction.create({
        userId,
        loanId: loan._id,
        amount: loan.feeAmount,
        mpesaResponse: paymentResponse,
        phoneNumber: paymentData?.phoneNumber || paymentData?.reference,
      });

      // Update loan with transaction ID and mark fee as paid
      loan.mpesaTransactionId = paymentResponse.transactionId || paymentResponse.checkoutRequestID;
      loan.feePaid = true; // Mark as paid since we're using mock/demo payments
      await loan.save();

      res.json({
        success: true,
        message: `Fee payment initiated via ${paymentMethod.toUpperCase()}. Payment processed successfully.`,
        data: {
          paymentResponse,
          paymentMethod,
        },
      });
    } catch (paymentError) {
      console.error('Payment processing error:', paymentError);
      return res.status(500).json({
        success: false,
        message: 'Failed to initiate payment. Please try again.',
        error: paymentError.message,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Handle M-Pesa STK Push callback
// @route   POST /api/loan/stk-callback
// @access  Public (M-Pesa callback)
const handleStkCallback = async (req, res, next) => {
  try {
    const callbackData = req.body;

    // Log callback for debugging
    console.log('STK Callback received:', JSON.stringify(callbackData, null, 2));

    // Extract relevant data
    const { merchantRequestId, checkoutRequestId, resultCode, callbackMetadata } = callbackData.Body?.stkCallback || {};

    if (resultCode === 0) {
      // Payment successful
      const amount = callbackMetadata?.item?.find(item => item.name === 'Amount')?.value;
      const mpesaReceiptNumber = callbackMetadata?.item?.find(item => item.name === 'MpesaReceiptNumber')?.value;
      const transactionDate = callbackMetadata?.item?.find(item => item.name === 'TransactionDate')?.value;
      const phoneNumber = callbackMetadata?.item?.find(item => item.name === 'PhoneNumber')?.value;

      // Find the loan by checkoutRequestId stored in mpesaTransactionId
      const loan = await Loan.findOne({ mpesaTransactionId: checkoutRequestId });

      if (loan) {
        // Update loan fee status
        loan.feePaid = true;
        loan.mpesaTransactionId = mpesaReceiptNumber; // Update to receipt number
        await loan.save();

        // Notify admins
        const admins = await User.find({ role: 'admin' });
        const user = await User.findById(loan.userId);
        for (const admin of admins) {
          await Notification.create({
            userId: admin._id,
            loanId: loan._id,
            type: 'loan_application_submitted',
            title: 'New Loan Application Submitted',
            message: `${user.fullName} has submitted a loan application for KES ${loan.amount} with fee paid.`,
            metadata: {
              amount: loan.amount,
              userName: user.fullName,
              userEmail: user.email,
            },
          });
        }

        console.log('Loan application fee paid successfully for loan:', loan._id);
      } else {
        console.log('Loan not found for checkoutRequestId:', checkoutRequestId);
      }

      res.status(200).json({ success: true });
    } else {
      // Payment failed
      console.log('Payment failed for:', checkoutRequestId, 'Result code:', resultCode);

      // Optionally, delete the loan or mark as failed
      const loan = await Loan.findOne({ mpesaTransactionId: checkoutRequestId });
      if (loan && !loan.feePaid) {
        await Loan.findByIdAndDelete(loan._id);
        console.log('Deleted unpaid loan due to payment failure:', loan._id);
      }

      res.status(200).json({ success: false });
    }
  } catch (error) {
    console.error('STK Callback error:', error);
    next(error);
  }
};

module.exports = {
  applyForLoan,
  payLoanFee,
  handleStkCallback,
};
