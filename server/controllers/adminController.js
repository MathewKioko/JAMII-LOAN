const Loan = require('../models/Loan');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const Message = require('../models/Message');
const SystemSettings = require('../models/SystemSettings');
const AuditLog = require('../models/AuditLog');
const { initiateB2CDisbursement } = require('../utils/mpesa');
const { sendLoanApprovalEmail, sendLoanRejectionEmail, sendLoanDisbursementEmail } = require('../utils/email');

// @desc    Get all loans with filter
// @route   GET /api/admin/loans
// @access  Private/Admin
const getAllLoans = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let filter = {};
    if (status) {
      filter.status = status;
    }

    const loans = await Loan.find(filter)
      .populate('userId', 'fullName email nationalId')
      .populate('approvedBy', 'fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Loan.countDocuments(filter);

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
    const loan = await Loan.findById(req.params.id).populate('userId');

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
    loan.status = 'approved';
    loan.approvedBy = req.user._id;
    loan.approvalDate = new Date();
    await loan.save();

    // Update user credit score and approved loans count
    const user = loan.userId;
    user.creditScore = Math.min(user.creditScore + 50, 1000); // Increase by 50, max 1000
    user.totalLoansApproved += 1;
    await user.save();

    // Send approval email asynchronously
    sendLoanApprovalEmail(user, loan).catch(emailError => {
      console.error('Failed to send loan approval email:', emailError);
    });

    res.json({
      success: true,
      message: 'Loan approved successfully',
      data: loan,
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

    const loan = await Loan.findById(req.params.id);

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
    loan.status = 'rejected';
    loan.rejectionReason = rejectionReason;
    loan.rejectionRefundStatus = 'pending';
    loan.refundInitiatedAt = new Date();
    await loan.save();

    // Initiate refund for the fee
    try {
      const refundResult = await initiateRefund(loan.feeAmount, loan.mpesaTransactionId, `Refund for rejected loan ${loan._id}`);
      loan.rejectionRefundTransactionId = refundResult.transactionId;
      loan.rejectionRefundStatus = 'processed';
      await loan.save();
    } catch (refundError) {
      console.error('Refund initiation failed:', refundError);
      loan.rejectionRefundStatus = 'failed';
      await loan.save();
    }

    // Send rejection email asynchronously
    const user = await User.findById(loan.userId);
    if (user) {
      sendLoanRejectionEmail(user, loan).catch(emailError => {
        console.error('Failed to send loan rejection email:', emailError);
      });
    }

    res.json({
      success: true,
      message: 'Loan rejected successfully',
      data: loan,
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
    const loan = await Loan.findById(req.params.id).populate('userId');

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
    const user = loan.userId;
    const hasPaidFee = loan.feePaid;
    const hasValidId = user.isCitizen && user.nationalId;
    const hasGoodCredit = user.creditScore >= 600;
    const hasNoPendingLoans = await Loan.countDocuments({
      userId: user._id,
      status: 'pending'
    }) === 1; // Only this loan should be pending

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
    loan.status = 'approved';
    loan.isAutoApproved = true;
    loan.autoApprovedAt = new Date();
    await loan.save();

    // Update user credit score
    user.creditScore = Math.min(user.creditScore + 25, 1000); // Smaller increase for auto-approval
    user.totalLoansApproved += 1;
    await user.save();

    // Send notification
    await Notification.create({
      userId: user._id,
      loanId: loan._id,
      type: 'loan_approved',
      title: 'Loan Auto-Approved',
      message: `Your loan of KSh ${loan.amount.toLocaleString()} has been automatically approved. Funds will be disbursed shortly.`,
      metadata: {
        amount: loan.amount,
        autoApproved: true,
      },
    });

    res.json({
      success: true,
      message: 'Loan auto-approved successfully',
      data: loan,
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
    const loans = await Loan.find({ status: 'pending' })
      .populate('userId', 'fullName email nationalId creditScore')
      .sort({ createdAt: 1 }) // FIFO order
      .limit(50); // Limit to prevent overload

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
    const loan = await Loan.findById(req.params.id).populate('userId');

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
    loan.disbursementStatus = 'processing';
    await loan.save();

    // Initiate M-PESA B2C disbursement
    try {
      const disbursementResult = await initiateB2CDisbursement(
        loan.userId.nationalId, // Using nationalId as phone number for demo
        loan.amount,
        loan._id
      );

      loan.disbursementTransactionId = disbursementResult.transactionId;
      await loan.save();

      // Send notification
      await Notification.create({
        userId: loan.userId._id,
        loanId: loan._id,
        type: 'loan_disbursed',
        title: 'Loan Disbursed',
        message: `Your loan of KSh ${loan.amount.toLocaleString()} has been disbursed to your M-PESA account.`,
        metadata: {
          amount: loan.amount,
          transactionId: disbursementResult.transactionId,
        },
      });

      // Send disbursement email asynchronously
      sendLoanDisbursementEmail(loan.userId, loan).catch(emailError => {
        console.error('Failed to send loan disbursement email:', emailError);
      });

      res.json({
        success: true,
        message: 'Loan disbursement initiated successfully',
        data: {
          loan,
          transactionId: disbursementResult.transactionId,
        },
      });
    } catch (disbursementError) {
      // Revert status on failure
      loan.disbursementStatus = 'failed';
      await loan.save();

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
      totalDisbursed,
      recentLoans,
    ] = await Promise.all([
      Loan.countDocuments(),
      Loan.countDocuments({ status: 'pending' }),
      Loan.countDocuments({ status: 'approved' }),
      Loan.countDocuments({ status: 'rejected' }),
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Loan.aggregate([
        { $match: { status: 'approved', disbursementStatus: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Loan.find({ status: 'pending' })
        .populate('userId', 'fullName')
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    const disbursedAmount = totalDisbursed.length > 0 ? totalDisbursed[0].total : 0;

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
          totalAmount: disbursedAmount,
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
    const loan = await Loan.findById(req.params.id).populate('userId');

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
    const existingNotification = await Notification.findOne({
      userId: loan.userId._id,
      loanId: loan._id,
      type: 'loan_approved',
    });

    if (existingNotification) {
      return res.status(400).json({
        success: false,
        message: 'Approval notification already sent',
      });
    }

    // Send notification
    const notification = await Notification.create({
      userId: loan.userId._id,
      loanId: loan._id,
      type: 'loan_approved',
      title: 'Loan Approved',
      message: `Congratulations! Your loan application for KSh ${loan.amount.toLocaleString()} has been approved. ${loan.isAutoApproved ? 'This was automatically approved based on your eligibility.' : 'Please wait for disbursement.'}`,
      metadata: {
        amount: loan.amount,
        autoApproved: loan.isAutoApproved,
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
    const loan = await Loan.findById(req.params.id).populate('userId');

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
    loan.status = 'approved';
    loan.isSpecialApproved = true;
    loan.specialApprovedAt = new Date();
    loan.approvedBy = req.user._id;
    loan.approvalDate = new Date();
    await loan.save();

    // Update user credit score and approved loans count
    const user = loan.userId;
    user.creditScore = Math.min(user.creditScore + 100, 1000); // Higher increase for special approval
    user.totalLoansApproved += 1;
    await user.save();

    // Send special approval notification
    await Notification.create({
      userId: user._id,
      loanId: loan._id,
      type: 'loan_approved',
      title: 'Loan Specially Approved',
      message: `Congratulations! Your loan of KSh ${loan.amount.toLocaleString()} has been specially approved by our admin team. Funds will be disbursed shortly.`,
      metadata: {
        amount: loan.amount,
        specialApproved: true,
      },
    });

    // Send approval email asynchronously
    sendLoanApprovalEmail(user, loan).catch(emailError => {
      console.error('Failed to send loan approval email:', emailError);
    });

    res.json({
      success: true,
      message: 'Loan specially approved successfully',
      data: loan,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Process refund for rejected loan
// @route   POST /api/admin/loan/:id/refund
// @access  Private/Admin
const processRefund = async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id).populate('userId');

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found',
      });
    }

    if (loan.status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Refund can only be processed for rejected loans',
      });
    }

    if (!loan.feePaid) {
      return res.status(400).json({
        success: false,
        message: 'No fee was paid for this loan',
      });
    }

    if (loan.rejectionRefundStatus === 'processed') {
      return res.status(400).json({
        success: false,
        message: 'Refund already processed',
      });
    }

    // Initiate refund via M-Pesa (using B2C or reversal API)
    try {
      const refundResult = await initiateRefund(loan.feeAmount, loan.userId.nationalId, `Refund for rejected loan ${loan._id}`);

      // Create refund transaction record
      await Transaction.create({
        userId: loan.userId._id,
        loanId: loan._id,
        amount: loan.feeAmount,
        phoneNumber: loan.userId.nationalId,
        status: 'success', // Assume success for demo
        isRefund: true,
        originalTransactionId: loan.mpesaTransactionId,
        refundReason: 'Loan application rejected',
        mpesaResponse: refundResult,
      });

      loan.rejectionRefundStatus = 'processed';
      loan.rejectionRefundTransactionId = refundResult.transactionId;
      await loan.save();

      res.json({
        success: true,
        message: 'Refund processed successfully',
        data: {
          loan,
          refundTransactionId: refundResult.transactionId,
        },
      });
    } catch (refundError) {
      loan.rejectionRefundStatus = 'failed';
      await loan.save();

      throw refundError;
    }
  } catch (error) {
    next(error);
  }
};

// Helper function for refund (placeholder - implement actual M-Pesa refund logic)
const initiateRefund = async (amount, phoneNumber, reason) => {
  // In real implementation, use M-Pesa B2C or reversal API
  // For demo, return mock data
  return {
    transactionId: `REF${Date.now()}`,
    status: 'success',
  };
};

// Helper function to create audit log
const createAuditLog = async (userId, action, resource, resourceId = null, details = {}, req) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    await AuditLog.create({
      userId,
      action,
      resource,
      resourceId,
      details,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};

// @desc    Get all users with filter and pagination
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, role, isActive, search } = req.query;

    let filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { nationalId: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: users,
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

// @desc    Update user details
// @route   PATCH /api/admin/users/:id
// @access  Private/Admin
const updateUser = async (req, res, next) => {
  try {
    const { fullName, email, nationalId, role, isActive, creditScore, loanLimit } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update fields
    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (nationalId) user.nationalId = nationalId;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (creditScore !== undefined) user.creditScore = creditScore;
    if (loanLimit !== undefined) user.loanLimit = loanLimit;

    await user.save();

    // Create audit log
    await createAuditLog(req.user._id, 'USER_UPDATED', 'user', user._id, {
      updatedFields: Object.keys(req.body),
      oldValues: {}, // Could store old values if needed
      newValues: req.body,
    }, req);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Activate/Deactivate user
// @route   PATCH /api/admin/users/:id/status
// @access  Private/Admin
const toggleUserStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean',
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.isActive = isActive;
    await user.save();

    // Create audit log
    await createAuditLog(req.user._id, isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', 'user', user._id, {
      newStatus: isActive,
    }, req);

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get system settings
// @route   GET /api/admin/settings
// @access  Private/Admin
const getSystemSettings = async (req, res, next) => {
  try {
    const settings = await SystemSettings.find({}).sort({ category: 1, key: 1 });

    // Group by category
    const groupedSettings = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    }, {});

    res.json({
      success: true,
      data: groupedSettings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update system setting
// @route   PATCH /api/admin/settings/:key
// @access  Private/Admin
const updateSystemSetting = async (req, res, next) => {
  try {
    const { value } = req.body;

    const setting = await SystemSettings.findOne({ key: req.params.key });

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found',
      });
    }

    if (!setting.isEditable) {
      return res.status(403).json({
        success: false,
        message: 'This setting cannot be modified',
      });
    }

    const oldValue = setting.value;
    setting.value = value;
    setting.lastModifiedBy = req.user._id;
    await setting.save();

    // Create audit log
    await createAuditLog(req.user._id, 'SETTINGS_UPDATED', 'settings', setting._id, {
      key: setting.key,
      oldValue,
      newValue: value,
    }, req);

    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: setting,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get audit logs with filter
// @route   GET /api/admin/audit-logs
// @access  Private/Admin
const getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, action, resource, userId, startDate, endDate, severity } = req.query;

    let filter = {};
    if (action) filter.action = action;
    if (resource) filter.resource = resource;
    if (userId) filter.userId = userId;
    if (severity) filter.severity = severity;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(filter)
      .populate('userId', 'fullName email')
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await AuditLog.countDocuments(filter);

    res.json({
      success: true,
      data: logs,
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

// @desc    Get system status and health
// @route   GET /api/admin/system-status
// @access  Private/Admin
const getSystemStatus = async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalLoans,
      pendingLoans,
      approvedLoans,
      rejectedLoans,
      totalTransactions,
      recentLogs,
      systemUptime,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Loan.countDocuments(),
      Loan.countDocuments({ status: 'pending' }),
      Loan.countDocuments({ status: 'approved' }),
      Loan.countDocuments({ status: 'rejected' }),
      Transaction.countDocuments(),
      AuditLog.find({})
        .populate('userId', 'fullName')
        .sort({ timestamp: -1 })
        .limit(10),
      process.uptime(),
    ]);

    // Database connection status
    const dbStatus = 'connected'; // Assuming connection is working if we reach here

    // Memory usage
    const memUsage = process.memoryUsage();

    res.json({
      success: true,
      data: {
        system: {
          uptime: Math.floor(systemUptime),
          memoryUsage: {
            rss: Math.round(memUsage.rss / 1024 / 1024), // MB
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
          },
          nodeVersion: process.version,
          environment: process.env.NODE_ENV || 'development',
        },
        database: {
          status: dbStatus,
        },
        statistics: {
          users: {
            total: totalUsers,
            active: activeUsers,
          },
          loans: {
            total: totalLoans,
            pending: pendingLoans,
            approved: approvedLoans,
            rejected: rejectedLoans,
          },
          transactions: {
            total: totalTransactions,
          },
        },
        recentActivity: recentLogs,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send message to a specific user
// @route   POST /api/admin/messages/send
// @access  Private/Admin
const sendMessageToUser = async (req, res, next) => {
  try {
    const { recipientId, title, content } = req.body;

    if (!recipientId || !title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Recipient ID, title, and content are required',
      });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found',
      });
    }

    const message = await Message.create({
      senderId: req.user._id,
      recipientId,
      title,
      content,
      messageType: 'admin_message',
    });

    // Create audit log
    await createAuditLog(req.user._id, 'MESSAGE_SENT', 'message', message._id, {
      recipientId,
      recipientName: recipient.fullName,
      title,
    }, req);

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send message to all users
// @route   POST /api/admin/messages/send-all
// @access  Private/Admin
const sendMessageToAllUsers = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required',
      });
    }

    const users = await User.find({ role: 'user' });
    const messages = [];

    for (const user of users) {
      const message = await Message.create({
        senderId: req.user._id,
        recipientId: user._id,
        title,
        content,
        messageType: 'admin_message',
      });
      messages.push(message);
    }

    // Create audit log
    await createAuditLog(req.user._id, 'MESSAGE_SENT_ALL', 'message', null, {
      recipientCount: users.length,
      title,
    }, req);

    res.json({
      success: true,
      message: `Message sent to ${users.length} users successfully`,
      data: {
        sentCount: users.length,
        messages: messages.slice(0, 5), // Return first 5 for preview
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get sent messages
// @route   GET /api/admin/messages/sent
// @access  Private/Admin
const getSentMessages = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const messages = await Message.find({ senderId: req.user._id })
      .populate('recipientId', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Message.countDocuments({ senderId: req.user._id });

    res.json({
      success: true,
      data: messages,
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

// @desc    Get message by ID
// @route   GET /api/admin/messages/:id
// @access  Private/Admin
const getMessageById = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id)
      .populate('senderId', 'fullName')
      .populate('recipientId', 'fullName email');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Check if admin is the sender
    if (message.senderId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete message
// @route   DELETE /api/admin/messages/:id
// @access  Private/Admin
const deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Check if admin is the sender
    if (message.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    await Message.findByIdAndDelete(req.params.id);

    // Create audit log
    await createAuditLog(req.user._id, 'MESSAGE_DELETED', 'message', req.params.id, {
      title: message.title,
    }, req);

    res.json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get conversation with a specific user
// @route   GET /api/admin/messages/conversation/:userId
// @access  Private/Admin
const getConversationWithUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Verify the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get messages between admin and user (both directions)
    const messages = await Message.find({
      $or: [
        { senderId: req.user._id, recipientId: userId },
        { senderId: userId, recipientId: req.user._id }
      ]
    })
      .populate('senderId', 'fullName role')
      .populate('recipientId', 'fullName role')
      .sort({ createdAt: 1 }) // Oldest first for conversation
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Message.countDocuments({
      $or: [
        { senderId: req.user._id, recipientId: userId },
        { senderId: userId, recipientId: req.user._id }
      ]
    });

    res.json({
      success: true,
      data: messages,
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
};
