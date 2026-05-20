const express = require('express');
const { createOrder, verifyPayment } = require('../controllers/payment.controller');
const { authMiddleware } = require('../middlewares/auth');
const router = express.Router();

router.post('/create-order', authMiddleware, createOrder);
router.post('/verify-payment', authMiddleware, verifyPayment);

module.exports = router;
