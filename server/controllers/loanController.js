const Loan = require('../models/Loan');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { initiateStkPush } = require('../utils/mpesa');
const { sendLoanApplicationEmail } = require('../utils/email');

// @desc    Apply for loan
// @route   POST /api/loan/apply
// @access  Private
const applyForLoan = async (req, res, next) => {
  try {
    const { amount, phoneNumber, description } = req.body;
    const userId = req.user._id;

    // Check eligibility
    const user = await User.findById(userId);

    if (!user.isCitizen) {
      return res.status(400).json({
        success: false,
        message: 'Only Kenyan citizens are eligible for loans',
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

    // Calculate fee (10% of loan amount)
    const feeAmount = Math.round(amount * 0.1);

    // Create loan record - NO M-PESA payment at application time
    const loan = await Loan.create({
      userId,
      amount,
      feeAmount,
      description,
    });

    // Update user loan count
    user.totalLoansApplied += 1;
    await user.save();

    // Send loan application confirmation email asynchronously
    sendLoanApplicationEmail(user, loan).catch(emailError => {
      console.error('Failed to send loan application email:', emailError);
    });

    res.status(201).json({
      success: true,
      message: 'Loan application submitted successfully. Your application will be reviewed by our admin team.',
      data: {
        loan: {
          _id: loan._id,
          amount: loan.amount,
          feeAmount: loan.feeAmount,
          status: loan.status,
          description: loan.description,
          createdAt: loan.createdAt,
        },
      },
    });
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

module.exports = {
  applyForLoan,
  payLoanFee,
};
