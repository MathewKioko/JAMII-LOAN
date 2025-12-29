const User = require('../models/User');
const Loan = require('../models/Loan');
const Notification = require('../models/Notification');
const Message = require('../models/Message');
const SystemSettings = require('../models/SystemSettings');

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      data: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        nationalId: user.nationalId,
        isCitizen: user.isCitizen,
        creditScore: user.creditScore,
        role: user.role,
        totalLoansApplied: user.totalLoansApplied,
        totalLoansApproved: user.totalLoansApproved,
        loanLimit: user.loanLimit,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check loan eligibility
// @route   GET /api/user/eligibility
// @access  Private
// @desc    Check loan eligibility
// @route   GET /api/user/eligibility
// @access  Private
const checkEligibility = async (req, res, next) => {
  try {
    console.log('Checking eligibility for user:', req.user._id);
    const user = await User.findById(req.user._id);
    console.log('User found:', user ? user.fullName : 'null');

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
    const activeLoans = await Loan.find({
      userId: user._id,
      status: { $in: ['pending', 'approved'] },
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
    console.log('getLoanHistory: req.user =', req.user);
    if (!req.user) {
      console.log('getLoanHistory: req.user is null');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }
    console.log('getLoanHistory: req.user._id =', req.user._id);
    const loans = await Loan.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('approvedBy', 'fullName');

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
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('loanId', 'amount status');

    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get public system settings
// @route   GET /api/user/settings
// @access  Private
const getSystemSettings = async (req, res, next) => {
  try {
    // Get settings that are relevant to users (loans category)
    const settings = await SystemSettings.find({
      category: 'loans',
      isEditable: true, // Only return settings that can be used
    }).select('key value description');

    // Convert to key-value object for easier frontend consumption
    const settingsObject = {};
    settings.forEach(setting => {
      settingsObject[setting.key] = setting.value;
    });

    // Add default values if settings don't exist
    const defaultSettings = {
      minLoanAmount: settingsObject.minLoanAmount || 1000,
      maxLoanAmount: settingsObject.maxLoanAmount || 500000,
      applicationFee: settingsObject.applicationFee || 50,
      interestRate: settingsObject.interestRate || 0,
      processingFee: settingsObject.processingFee || 50,
    };

    res.json({
      success: true,
      data: defaultSettings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user messages
// @route   GET /api/user/messages
// @access  Private
const getMessages = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const messages = await Message.find({ recipientId: req.user._id })
      .populate('senderId', 'fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Message.countDocuments({ recipientId: req.user._id });

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

// @desc    Send message to admin
// @route   POST /api/user/messages/send
// @access  Private
const sendMessage = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required',
      });
    }

    // Find an admin to send the message to (first active admin)
    const admin = await User.findOne({ role: 'admin', isActive: true });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'No admin available to receive messages',
      });
    }

    const message = await Message.create({
      senderId: req.user._id,
      recipientId: admin._id,
      title,
      content,
      messageType: 'user_message',
    });

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get conversation history with admin
// @route   GET /api/user/messages/conversation
// @access  Private
const getConversation = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    // Find admin
    const admin = await User.findOne({ role: 'admin', isActive: true });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'No admin available',
      });
    }

    // Get messages between user and admin (both directions)
    const messages = await Message.find({
      $or: [
        { senderId: req.user._id, recipientId: admin._id },
        { senderId: admin._id, recipientId: req.user._id }
      ]
    })
      .populate('senderId', 'fullName role')
      .populate('recipientId', 'fullName role')
      .sort({ createdAt: 1 }) // Oldest first for conversation
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Message.countDocuments({
      $or: [
        { senderId: req.user._id, recipientId: admin._id },
        { senderId: admin._id, recipientId: req.user._id }
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

// @desc    Mark message as read
// @route   PATCH /api/user/messages/:id/read
// @access  Private
const markMessageAsRead = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    if (message.recipientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    message.isRead = true;
    await message.save();

    res.json({
      success: true,
      message: 'Message marked as read',
      data: message,
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
  getSystemSettings,
  getMessages,
  sendMessage,
  getConversation,
  markMessageAsRead,
};
