const express = require('express');
const { createCoupon, getAllCoupons, updateCoupon, deleteCoupon, validateCoupon } = require('../controllers/coupon.controller');
const { authMiddleware } = require('../middlewares/auth');
const router = express.Router();

router.post('/validate', authMiddleware, validateCoupon); // Needs to be public or at least for authenticated students checking out
router.get('/', authMiddleware, getAllCoupons);
router.post('/', authMiddleware, createCoupon);
router.put('/:id', authMiddleware, updateCoupon);
router.delete('/:id', authMiddleware, deleteCoupon);

module.exports = router;
