const express = require('express');
const {
  register,
  login,
  refreshToken,
  logout,
  getMe
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Public routes
// @route   POST /api/auth/register
router.post('/register', register);

// @route   POST /api/auth/login
router.post('/login', login);

// @route   POST /api/auth/refresh
router.post('/refresh', refreshToken);

// Protected routes
// @route   POST /api/auth/logout
router.post('/logout', requireAuth, logout);

// @route   GET /api/auth/me
router.get('/me', requireAuth, getMe);

module.exports = router;
