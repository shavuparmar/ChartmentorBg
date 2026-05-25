const express = require('express');
const { downloadInvoice } = require('../controllers/invoice.controller');
const { authMiddleware } = require('../middlewares/auth');
const router = express.Router();

router.get('/:invoiceId/download', authMiddleware, downloadInvoice);

module.exports = router;
