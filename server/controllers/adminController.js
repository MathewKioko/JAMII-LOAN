const prisma = require('../config/prisma');
const { initiateB2CDisbursement } = require('../utils/mpesa');
const { sendLoanApprovalEmail, sendLoanRejectionEmail, sendLoanDisbursementEmail } = require('../utils/email');

// @desc    Get all loans with filter
// @route   GET /api/admin/loans
// @access  Private/Admin
const getAllLoans = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let where = {};
    if (status) {
      where.status = status;
    }

    const loans = await prisma.loan.findMany({
      where,
      include: {
        user: {
          select: { fullName: true, email: true, nationalId: true },
        },
        approvedByAdmin: {
          select: { fullName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
    });

    const total = await prisma.loan.count({ where });

    res.json({
      success: true,
      data: loans,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve loan
// @route   PATCH /api/admin/loan/:id/approve
// @access  Private/Admin
const approveLoan = async (req, res, next) => {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: req.params.id },
      include: {
        user: true,
      },
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found',
      });
    }

    if (loan.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Loan is not in pending status',
      });
    }

    // Check if fee is paid
    if (!loan.feePaid) {
      return res.status(400).json({
        success: false,
        message: 'Loan fee must be paid before approval',
      });
    }

    // Update loan status
    const updatedLoan = await prisma.loan.update({
      where: { id: req.params.id },
      data: {
        status: 'approved',
        approvedBy: req.user.userId,
        approvalDate: new Date(),
      },
    });

    // Update user credit score and approved loans count
    const user = loan.user;
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        creditScore: Math.min(user.creditScore + 50, 1000), // Increase by 50, max 1000
        totalLoansApproved: user.totalLoansApproved + 1,
      },
    });

    // Send approval email asynchronously
    sendLoanApprovalEmail(updatedUser, updatedLoan).catch(emailError => {
      console.error('Failed to send loan approval email:', emailError);
    });

    res.json({
      success: true,
      message: 'Loan approved successfully',
      data: updatedLoan,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject loan
// @route   PATCH /api/admin/loan/:id/reject
// @access  Private/Admin
const rejectLoan = async (req, res, next) => {
  try {
    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required',
      });
    }

    const loan = await prisma.loan.findUnique({
      where: { id: req.params.id },
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found',
      });
    }

    if (loan.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Loan is not in pending status',
      });
    }

    // Update loan status
    const updatedLoan = await prisma.loan.update({
      where: { id: req.params.id },
      data: {
        status: 'rejected',
        rejectionReason,
      },
    });

    // Send rejection email asynchronously
    const user = await prisma.user.findUnique({
      where: { id: loan.userId },
    });
    if (user) {
      sendLoanRejectionEmail(user, updatedLoan).catch(emailError => {
        console.error('Failed to send loan rejection email:', emailError);
      });
    }

    res.json({
      success: true,
      message: 'Loan rejected successfully',
      data: updatedLoan,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Auto-approve loan based on criteria
// @route   PATCH /api/admin/loan/:id/auto-approve
// @access  Private/Admin
const autoApproveLoan = async (req, res, next) => {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: req.params.id },
      include: {
        user: true,
      },
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found',
      });
    }

    if (loan.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Loan is not in pending status',
      });
    }

    // Auto-approval criteria
    const user = loan.user;
    const hasPaidFee = loan.feePaid;
    const hasValidId = user.isCitizen && user.nationalId;
    const hasGoodCredit = user.creditScore >= 600;
    const pendingLoansCount = await prisma.loan.count({
      where: {
        userId: user.id,
        status: 'pending',
      },
    });
    const hasNoPendingLoans = pendingLoansCount === 1; // Only this loan should be pending

    if (!hasPaidFee || !hasValidId || !hasGoodCredit || !hasNoPendingLoans) {
      return res.status(400).json({
        success: false,
        message: 'Loan does not meet auto-approval criteria',
        criteria: {
          feePaid: hasPaidFee,
          validId: hasValidId,
          goodCredit: hasGoodCredit,
          noPendingLoans: hasNoPendingLoans,
        },
      });
    }

    // Auto-approve the loan
    const updatedLoan = await prisma.loan.update({
      where: { id: req.params.id },
      data: {
        status: 'approved',
        isAutoApproved: true,
        autoApprovedAt: new Date(),
      },
    });

    // Update user credit score
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        creditScore: Math.min(user.creditScore + 25, 1000), // Smaller increase for auto-approval
        totalLoansApproved: user.totalLoansApproved + 1,
      },
    });

    // Send notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        loanId: loan.id,
        title: 'Loan Auto-Approved',
        message: `Your loan of KSh ${loan.amount.toLocaleString()} has been automatically approved. Funds will be disbursed shortly.`,
      },
    });

    res.json({
      success: true,
      message: 'Loan auto-approved successfully',
      data: updatedLoan,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get loan queue for real-time updates
// @route   GET /api/admin/loan-queue
// @access  Private/Admin
const getLoanQueue = async (req, res, next) => {
  try {
    const loans = await prisma.loan.findMany({
      where: { status: 'pending' },
      include: {
        user: {
          select: { fullName: true, email: true, nationalId: true, creditScore: true },
        },
      },
      orderBy: { createdAt: 'asc' }, // FIFO order
      take: 50, // Limit to prevent overload
    });

    res.json({
      success: true,
      data: loans,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Initiate loan disbursement
// @route   POST /api/admin/loan/:id/disbursement
// @access  Private/Admin
const initiateLoanDisbursement = async (req, res, next) => {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: req.params.id },
      include: {
        user: true,
      },
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found',
      });
    }

    if (loan.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Loan must be approved before disbursement',
      });
    }

    if (loan.disbursementStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Disbursement already initiated or completed',
      });
    }

    // Update disbursement status
    await prisma.loan.update({
      where: { id: req.params.id },
      data: {
        disbursementStatus: 'processing',
      },
    });

    // Initiate M-PESA B2C disbursement
    try {
      const disbursementResult = await initiateB2CDisbursement(
        loan.user.nationalId, // Using nationalId as phone number for demo
        loan.amount,
        loan.id
      );

      const updatedLoan = await prisma.loan.update({
        where: { id: req.params.id },
        data: {
          disbursementTransactionId: disbursementResult.transactionId,
        },
      });

      // Send notification
      await prisma.notification.create({
        data: {
          userId: loan.user.id,
          loanId: loan.id,
          title: 'Loan Disbursed',
          message: `Your loan of KSh ${loan.amount.toLocaleString()} has been disbursed to your M-PESA account.`,
        },
      });

      // Send disbursement email asynchronously
      sendLoanDisbursementEmail(loan.user, updatedLoan).catch(emailError => {
        console.error('Failed to send loan disbursement email:', emailError);
      });

      res.json({
        success: true,
        message: 'Loan disbursement initiated successfully',
        data: {
          loan: updatedLoan,
          transactionId: disbursementResult.transactionId,
        },
      });
    } catch (disbursementError) {
      // Revert status on failure
      await prisma.loan.update({
        where: { id: req.params.id },
        data: {
          disbursementStatus: 'failed',
        },
      });

      throw disbursementError;
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
const getAdminStats = async (req, res, next) => {
  try {
    const [
      totalLoans,
      pendingLoans,
      approvedLoans,
      rejectedLoans,
      totalUsers,
      activeUsers,
      recentLoans,
    ] = await Promise.all([
      prisma.loan.count(),
      prisma.loan.count({ where: { status: 'pending' } }),
      prisma.loan.count({ where: { status: 'approved' } }),
      prisma.loan.count({ where: { status: 'rejected' } }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.loan.findMany({
        where: { status: 'pending' },
        include: {
          user: {
            select: { fullName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // Calculate total disbursed amount
    const disbursedLoans = await prisma.loan.findMany({
      where: {
        status: 'approved',
        disbursementStatus: 'completed',
      },
      select: { amount: true },
    });
    const totalDisbursed = disbursedLoans.reduce((sum, loan) => sum + loan.amount, 0);

    res.json({
      success: true,
      data: {
        loans: {
          total: totalLoans,
          pending: pendingLoans,
          approved: approvedLoans,
          rejected: rejectedLoans,
        },
        users: {
          total: totalUsers,
          active: activeUsers,
        },
        disbursements: {
          totalAmount: totalDisbursed,
        },
        recentPendingLoans: recentLoans,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send approval notification
// @route   POST /api/admin/loan/:id/notify-approval
// @access  Private/Admin
const sendApprovalNotification = async (req, res, next) => {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: req.params.id },
      include: {
        user: true,
      },
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found',
      });
    }

    if (loan.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Loan must be approved to send notification',
      });
    }

    // Check if notification already exists
    const existingNotification = await prisma.notification.findFirst({
      where: {
        userId: loan.user.id,
        loanId: loan.id,
      },
    });

    if (existingNotification) {
      return res.status(400).json({
        success: false,
        message: 'Approval notification already sent',
      });
    }

    // Send notification
    const notification = await prisma.notification.create({
      data: {
        userId: loan.user.id,
        loanId: loan.id,
        title: 'Loan Approved',
        message: `Congratulations! Your loan application for KSh ${loan.amount.toLocaleString()} has been approved. ${loan.isAutoApproved ? 'This was automatically approved based on your eligibility.' : 'Please wait for disbursement.'}`,
      },
    });

    res.json({
      success: true,
      message: 'Approval notification sent successfully',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Special approve loan (bypasses normal criteria)
// @route   PATCH /api/admin/loan/:id/special-approve
// @access  Private/Admin
const specialApproveLoan = async (req, res, next) => {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: req.params.id },
      include: {
        user: true,
      },
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found',
      });
    }

    if (loan.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Loan is not in pending status',
      });
    }

    // Update loan status for special approval
    const updatedLoan = await prisma.loan.update({
      where: { id: req.params.id },
      data: {
        status: 'approved',
        isSpecialApproved: true,
        specialApprovedAt: new Date(),
        approvedBy: req.user.userId,
        approvalDate: new Date(),
      },
    });

    // Update user credit score and approved loans count
    const user = loan.user;
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        creditScore: Math.min(user.creditScore + 100, 1000), // Higher increase for special approval
        totalLoansApproved: user.totalLoansApproved + 1,
      },
    });

    // Send special approval notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        loanId: loan.id,
        title: 'Loan Specially Approved',
        message: `Congratulations! Your loan of KSh ${loan.amount.toLocaleString()} has been specially approved by our admin team. Funds will be disbursed shortly.`,
      },
    });

    // Send approval email asynchronously
    sendLoanApprovalEmail(updatedUser, updatedLoan).catch(emailError => {
      console.error('Failed to send loan approval email:', emailError);
    });

    res.json({
      success: true,
      message: 'Loan specially approved successfully',
      data: updatedLoan,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllLoans,
  approveLoan,
  rejectLoan,
  autoApproveLoan,
  specialApproveLoan,
  getLoanQueue,
  initiateLoanDisbursement,
  getAdminStats,
  sendApprovalNotification,
};

