const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const prisma = require('./config/prisma');
const errorHandler = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

// Connect to database using Prisma
const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB via Prisma...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    
    await prisma.$connect();
    console.log(`MongoDB Connected via Prisma`);
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDB();
    
    // Seed super admin if environment variables are set
    if (process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD) {
      try {
        const seedSuperAdmin = require('./seedSuperAdmin');
        await seedSuperAdmin();
      } catch (seedError) {
        console.error('Error seeding super admin:', seedError.message);
      }
    }
    
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
        ? [process.env.FRONTEND_URL, 'https://jamii-loan.vercel.app', 'https://jamii-loan.netlify.app']
        : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3004', 'http://localhost:3007', 'https://jamii-loan.vercel.app', 'https://jamii-loan.netlify.app'],
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
    app.use('/api/notifications', require('./routes/notificationRoutes'));
    app.use('/api/transactions', require('./routes/transactionRoutes'));

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

    return app;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = { startServer };
