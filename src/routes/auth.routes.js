const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, resendOTP, verifyEmail, login, adminLogin, getMe, forgotPassword, resetPassword, changePassword } = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth');
const { 
  validateRegister, 
  validateLogin, 
  validateForgotPassword, 
  validateResetPassword, 
  handleValidationErrors 
} = require('../middlewares/validation');

const router = express.Router();

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts from this IP, please try again after 15 minutes' }
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests from this IP' }
});

router.post('/register', authLimiter, validateRegister, handleValidationErrors, register);
router.post('/resend-otp', otpLimiter, resendOTP);
router.post('/verify-email', authLimiter, verifyEmail); // Added for OTP
router.post('/login', authLimiter, validateLogin, handleValidationErrors, login);
router.post('/admin/login', authLimiter, validateLogin, handleValidationErrors, adminLogin);
router.get('/me', authMiddleware, getMe);
router.post('/forgot-password', authLimiter, validateForgotPassword, handleValidationErrors, forgotPassword);
router.post('/reset-password', authLimiter, validateResetPassword, handleValidationErrors, resetPassword);
router.post('/change-password', authLimiter, authMiddleware, changePassword);

module.exports = router;
