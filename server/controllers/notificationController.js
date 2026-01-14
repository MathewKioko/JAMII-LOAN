const prisma = require('../config/prisma');

// @desc    Create notification
// @route   POST /api/notifications
// @access  Private (Admin)
const createNotification = async (req, res, next) => {
  try {
    const { userId, loanId, title, message } = req.body;

    const notification = await prisma.notification.create({
      data: {
        userId,
        loanId,
        title,
        message,
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
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all notifications (Admin)
// @route   GET /api/notifications
// @access  Private (Admin)
const getAllNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, userId, isRead } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (userId) where.userId = userId;
    if (isRead !== undefined) where.isRead = isRead === 'true';

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
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
      prisma.notification.count({ where }),
    ]);

    res.json({
      success: true,
      data: notifications,
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

// @desc    Get notification by ID
// @route   GET /api/notifications/:id
// @access  Private
const getNotificationById = async (req, res, next) => {
  try {
    const notification = await prisma.notification.findUnique({
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

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update notification
// @route   PUT /api/notifications/:id
// @access  Private
const updateNotification = async (req, res, next) => {
  try {
    const { title, message, isRead } = req.body;

    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(message && { message }),
        ...(isRead !== undefined && { isRead }),
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
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res, next) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res, next) => {
  try {
    await prisma.notification.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createNotification,
  getAllNotifications,
  getNotificationById,
  updateNotification,
  markAsRead,
  deleteNotification,
};

