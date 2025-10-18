const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:3000', 'http://localhost:3004', 'http://localhost:3007'],
  credentials: true,
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'JAMII LOAN API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'JAMII LOAN API is running',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/user', require('./routes/userRoutes'));
app.use('/api/loan', require('./routes/loanRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/mpesa', require('./routes/mpesaRoutes'));

// Serve static files from the React app build directory
console.log('NODE_ENV:', process.env.NODE_ENV);
if (process.env.NODE_ENV === 'production') {
  console.log('Serving static files from:', path.join(__dirname, '../client/dist'));
  app.use(express.static(path.join(__dirname, '../client/dist')));

  // Catch all handler: send back React's index.html file for client-side routing
  app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '../client/dist/index.html');
    console.log('Serving index.html from:', indexPath);
    res.sendFile(indexPath);
  });
} else {
  console.log('Development mode: static files not served');
}

// Error handler middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
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
