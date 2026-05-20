const express = require('express');
const { register, login, adminLogin, getMe, forgotPassword, resetPassword } = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth');
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/admin/login', adminLogin);
router.get('/me', authMiddleware, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
