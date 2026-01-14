const prisma = require('../config/prisma');
const { PrismaClientValidationError } = require('@prisma/client/runtime/library');

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private
const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        nationalId: true,
        isCitizen: true,
        creditScore: true,
        role: true,
        totalLoansApplied: true,
        totalLoansApproved: true,
        loanLimit: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check loan eligibility
// @route   GET /api/user/eligibility
// @access  Private
const checkEligibility = async (req, res, next) => {
  try {
    console.log('Checking eligibility for user:', req.user.userId);
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });
    console.log('User found:', user ? user.fullName : 'null');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user is Kenyan citizen
    if (!user.isCitizen) {
      return res.json({
        success: true,
        data: {
          eligible: false,
          reason: 'Only Kenyan citizens are eligible for loans',
          creditScore: user.creditScore,
          maxAmount: 0,
        },
      });
    }

    // Check for pending or approved loans
    const activeLoans = await prisma.loan.findMany({
      where: {
        userId: user.id,
        status: { in: ['pending', 'approved'] },
      },
    });

    if (activeLoans.length > 0) {
      return res.json({
        success: true,
        data: {
          eligible: false,
          reason: 'You have pending or approved loans. Please settle them first.',
          creditScore: user.creditScore,
          maxAmount: 0,
        },
      });
    }

    // Calculate max amount based on credit score
    let maxAmount = user.loanLimit;

    if (user.creditScore < 300) {
      maxAmount = Math.min(maxAmount, 10000);
    } else if (user.creditScore < 500) {
      maxAmount = Math.min(maxAmount, 25000);
    } else if (user.creditScore < 700) {
      maxAmount = Math.min(maxAmount, 50000);
    } else if (user.totalLoansApplied === 0) {
      // New users get up to 30,000 KSh
      maxAmount = Math.min(maxAmount, 30000);
    }
    // For credit score >= 700 and existing users, use full loan limit

    res.json({
      success: true,
      data: {
        eligible: true,
        creditScore: user.creditScore,
        maxAmount,
        loanLimit: user.loanLimit,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get loan history
// @route   GET /api/user/loans
// @access  Private
const getLoanHistory = async (req, res, next) => {
  try {
    const loans = await prisma.loan.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        approvedByAdmin: {
          select: { fullName: true },
        },
      },
    });

    res.json({
      success: true,
      data: loans,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user notifications
// @route   GET /api/user/notifications
// @access  Private
const getNotifications = async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        loan: {
          select: { amount: true, status: true },
        },
      },
    });

    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  checkEligibility,
  getLoanHistory,
  getNotifications,
};

