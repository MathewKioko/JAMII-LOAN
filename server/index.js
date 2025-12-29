const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const SystemSettings = require('./models/SystemSettings');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Initialize default system settings
const initializeSystemSettings = async () => {
  try {
    const defaultSettings = [
      {
        key: 'app_name',
        value: 'JAMII LOAN',
        description: 'Application name displayed throughout the system',
        category: 'general',
        isEditable: true,
      },
      {
        key: 'max_loan_amount',
        value: 500000,
        description: 'Maximum loan amount allowed (in KSh)',
        category: 'loans',
        isEditable: true,
      },
      {
        key: 'min_loan_amount',
        value: 1000,
        description: 'Minimum loan amount allowed (in KSh)',
        category: 'loans',
        isEditable: true,
      },
      {
        key: 'loan_fee_percentage',
        value: 5,
        description: 'Loan processing fee percentage',
        category: 'loans',
        isEditable: true,
      },
      {
        key: 'auto_approval_enabled',
        value: true,
        description: 'Enable automatic loan approval for eligible users',
        category: 'loans',
        isEditable: true,
      },
      {
        key: 'min_credit_score_auto_approve',
        value: 600,
        description: 'Minimum credit score required for auto-approval',
        category: 'loans',
        isEditable: true,
      },
      {
        key: 'email_notifications_enabled',
        value: true,
        description: 'Enable email notifications for loan status updates',
        category: 'notifications',
        isEditable: true,
      },
      {
        key: 'sms_notifications_enabled',
        value: false,
        description: 'Enable SMS notifications (requires SMS service integration)',
        category: 'notifications',
        isEditable: true,
      },
      {
        key: 'session_timeout_minutes',
        value: 60,
        description: 'User session timeout in minutes',
        category: 'security',
        isEditable: true,
      },
      {
        key: 'max_login_attempts',
        value: 5,
        description: 'Maximum failed login attempts before account lockout',
        category: 'security',
        isEditable: true,
      },
      {
        key: 'audit_log_retention_days',
        value: 365,
        description: 'Number of days to retain audit logs',
        category: 'system',
        isEditable: true,
      },
      {
        key: 'maintenance_mode',
        value: false,
        description: 'Enable maintenance mode (users cannot access the system)',
        category: 'system',
        isEditable: true,
      },
    ];

    for (const setting of defaultSettings) {
      await SystemSettings.findOneAndUpdate(
        { key: setting.key },
        setting,
        { upsert: true, new: true }
      );
    }

    console.log('System settings initialized successfully');
  } catch (error) {
    console.error('Failed to initialize system settings:', error);
  }
};

// Initialize system settings after DB connection
initializeSystemSettings();

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://jamii-loan-i2yo.onrender.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:3000', 'http://localhost:3004', 'http://localhost:3007', 'https://jamii-loan.netlify.app'],
  credentials: true,
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root endpoint - serve React app in production, API info in development
app.get('/', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    const indexPath = path.join(__dirname, '../client/dist/index.html');
    res.sendFile(indexPath);
  } else {
    res.json({
      success: true,
      message: 'JAMII LOAN API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'JAMII LOAN API is running',
    timestamp: new Date().toISOString(),
  });
});

// Serve static files from the React app build directory
console.log('NODE_ENV:', process.env.NODE_ENV);
if (process.env.NODE_ENV === 'production') {
  console.log('Serving static files from:', path.join(__dirname, '../client/dist'));
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/user', require('./routes/userRoutes'));
app.use('/api/loan', require('./routes/loanRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/mpesa', require('./routes/mpesaRoutes'));
app.use('/api/payment', require('./routes/paymentRoutes'));

// Catch all handler: send back React's index.html file for client-side routing
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '../client/dist/index.html');
    console.log('Serving index.html from:', indexPath);
    res.sendFile(indexPath);
  });
} else {
  // In development, serve static files but ensure API routes are handled first
  console.log('Development mode: serving static files');
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '../client/dist/index.html');
    console.log('Serving index.html from:', indexPath);
    res.sendFile(indexPath);
  });
}

// Error handler middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/api/health`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;
