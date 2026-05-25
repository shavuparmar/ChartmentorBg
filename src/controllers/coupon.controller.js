const prisma = require('../utils/prisma');

// Admin only
const createCoupon = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    const { code, type, discountValue, minPurchase, expiryDate, maxUsage, planIds, isActive } = req.body;
    
    // Validate unique code
    const existing = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        type,
        discountValue: parseFloat(discountValue),
        minPurchase: minPurchase ? parseFloat(minPurchase) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        maxUsage: maxUsage ? parseInt(maxUsage) : null,
        planIds: planIds || [],
        isActive
      }
    });
    res.json({ success: true, data: coupon });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin only
const getAllCoupons = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: coupons });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin only
const updateCoupon = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    const { id } = req.params;
    const { code, type, discountValue, minPurchase, expiryDate, maxUsage, planIds, isActive } = req.body;

    const dataToUpdate = {};
    if (code !== undefined) {
      const existing = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
      if (existing && existing.id !== id) return res.status(400).json({ success: false, message: 'Coupon code already exists' });
      dataToUpdate.code = code.toUpperCase();
    }
    if (type !== undefined) dataToUpdate.type = type;
    if (discountValue !== undefined) dataToUpdate.discountValue = parseFloat(discountValue);
    if (minPurchase !== undefined) dataToUpdate.minPurchase = minPurchase ? parseFloat(minPurchase) : null;
    if (expiryDate !== undefined) dataToUpdate.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (maxUsage !== undefined) dataToUpdate.maxUsage = maxUsage ? parseInt(maxUsage) : null;
    if (planIds !== undefined) dataToUpdate.planIds = planIds;
    if (isActive !== undefined) dataToUpdate.isActive = isActive;

    const coupon = await prisma.coupon.update({ where: { id }, data: dataToUpdate });
    res.json({ success: true, data: coupon });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin only
const deleteCoupon = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    const { id } = req.params;
    await prisma.coupon.delete({ where: { id } });
    res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Public/Student Validation
const validateCoupon = async (req, res) => {
  try {
    const { code, planId } = req.body;
    
    if (!code) return res.status(400).json({ success: false, message: 'Coupon code required' });
    if (!planId) return res.status(400).json({ success: false, message: 'Plan ID required' });

    const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (!coupon) return res.status(404).json({ success: false, message: 'Invalid coupon code' });

    if (!coupon.isActive) return res.status(400).json({ success: false, message: 'Coupon is inactive' });
    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
      return res.status(400).json({ success: false, message: 'Coupon has expired' });
    }
    if (coupon.maxUsage && coupon.usedCount >= coupon.maxUsage) {
      return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
    }
    if (coupon.planIds && coupon.planIds.length > 0 && !coupon.planIds.includes(planId)) {
      return res.status(400).json({ success: false, message: 'Coupon is not applicable to this plan' });
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    const priceToUse = plan.discountPrice ? plan.discountPrice : plan.price;

    if (coupon.minPurchase && priceToUse < coupon.minPurchase) {
      return res.status(400).json({ success: false, message: `Minimum purchase amount of ₹${coupon.minPurchase} required` });
    }

    let finalAmount = priceToUse;
    let discountApplied = 0;

    if (coupon.type === 'PERCENTAGE') {
      discountApplied = (priceToUse * coupon.discountValue) / 100;
      finalAmount = priceToUse - discountApplied;
    } else {
      discountApplied = coupon.discountValue;
      finalAmount = priceToUse - discountApplied;
    }

    if (finalAmount < 0) finalAmount = 0;

    res.json({
      success: true,
      data: {
        originalAmount: priceToUse,
        finalAmount,
        discountApplied,
        couponId: coupon.id,
        couponCode: coupon.code,
        message: 'Coupon applied successfully'
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createCoupon, getAllCoupons, updateCoupon, deleteCoupon, validateCoupon };
