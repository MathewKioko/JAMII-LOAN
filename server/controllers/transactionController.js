const prisma = require('../config/prisma');

// @desc    Create transaction
// @route   POST /api/transactions
// @access  Private
const createTransaction = async (req, res, next) => {
  try {
    const { userId, loanId, amount, type, status, transactionId, mpesaReceiptNumber, phoneNumber, description } = req.body;

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        loanId,
        amount,
        type,
        status,
        transactionId,
        mpesaReceiptNumber,
        phoneNumber,
        description,
      },
      include: {
        user: {
          select: { fullName: true, email: true },
        },
        loan: {
          select: { amount: true, status: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all transactions (Admin)
// @route   GET /api/transactions
// @access  Private (Admin)
const getAllTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, userId, type, status } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (userId) where.userId = userId;
    if (type) where.type = type;
    if (status) where.status = status;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { fullName: true, email: true },
          },
          loan: {
            select: { amount: true, status: true },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      success: true,
      data: transactions,
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

// @desc    Get transaction by ID
// @route   GET /api/transactions/:id
// @access  Private
const getTransactionById = async (req, res, next) => {
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: { fullName: true, email: true },
        },
        loan: {
          select: { amount: true, status: true },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user transactions
// @route   GET /api/transactions/user/:userId
// @access  Private
const getUserTransactions = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          loan: {
            select: { amount: true, status: true },
          },
        },
      }),
      prisma.transaction.count({ where: { userId } }),
    ]);

    res.json({
      success: true,
      data: transactions,
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

// @desc    Update transaction
// @route   PUT /api/transactions/:id
// @access  Private
const updateTransaction = async (req, res, next) => {
  try {
    const { status, mpesaReceiptNumber, transactionId } = req.body;

    const transaction = await prisma.transaction.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(mpesaReceiptNumber && { mpesaReceiptNumber }),
        ...(transactionId && { transactionId }),
      },
      include: {
        user: {
          select: { fullName: true, email: true },
        },
        loan: {
          select: { amount: true, status: true },
        },
      },
    });

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
// @access  Private (Admin)
const deleteTransaction = async (req, res, next) => {
  try {
    await prisma.transaction.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get transaction statistics (Admin)
// @route   GET /api/transactions/stats
// @access  Private (Admin)
const getTransactionStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [totalTransactions, totalAmount, byType, byStatus] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.aggregate({
        where,
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ['type'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.groupBy({
        by: ['status'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalTransactions,
        totalAmount: totalAmount._sum.amount || 0,
        byType,
        byStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTransaction,
  getAllTransactions,
  getTransactionById,
  getUserTransactions,
  updateTransaction,
  deleteTransaction,
  getTransactionStats,
};

