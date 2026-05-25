const express = require('express');
const { createOrder, verifyPayment, handleWebhook } = require('../controllers/payment.controller');
const { authMiddleware } = require('../middlewares/auth');
const router = express.Router();

router.post('/create-order', authMiddleware, createOrder);
// Verify payment status from frontend
router.post('/verify-payment', authMiddleware, verifyPayment);
// Webhook from Merchant UPI Gateway (POST for server-to-server)
router.post('/webhook', handleWebhook);
// If gateway redirects user to webhook URL via GET
router.get('/webhook', (req, res) => {
    const orderId = req.query.client_txn_id || req.query.orderId || req.query.merchantOrderId || '';
    res.redirect(`${process.env.FRONTEND_URL}/payment/status?orderId=${orderId}`);
});

module.exports = router;
