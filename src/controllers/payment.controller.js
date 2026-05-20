const Razorpay = require('razorpay');
const crypto = require('crypto');
const prisma = require('../utils/prisma');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
});

const createOrder = async (req, res) => {
  try {
    const { planId, amount } = req.body;
    
    // Fallback if Razorpay API fails due to dummy keys
    if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_SECRET === 'rzp_secret_placeholder') {
      return res.status(500).json({ success: false, message: 'Razorpay keys are missing or invalid in .env' });
    }

    const options = {
      amount: amount * 100, // amount in the smallest currency unit
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    
    // Save pending payment in DB
    await prisma.payment.create({
      data: {
        userId: req.user.id,
        razorpayOrderId: order.id,
        amount: amount,
        status: "PENDING"
      }
    });

    res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      data: order
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      // Payment is successful
      const payment = await prisma.payment.update({
        where: { razorpayOrderId: razorpay_order_id },
        data: {
          razorpayPaymentId: razorpay_payment_id,
          status: "SUCCESS"
        }
      });

      // Update or create Membership
      await prisma.membership.upsert({
        where: { userId: payment.userId },
        update: {
          status: "ACTIVE",
          startDate: new Date(),
          endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) // 1 year membership
        },
        create: {
          userId: payment.userId,
          status: "ACTIVE",
          startDate: new Date(),
          endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
        }
      });

      // Generate invoice
      const invoiceNumber = `INV-${Date.now()}`;
      const newInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          paymentId: payment.id,
          userId: payment.userId,
          amount: payment.amount
        }
      });

      // Assuming user details are needed for PDF
      const user = await prisma.user.findUnique({ where: { id: payment.userId } });
      const invoiceData = {
        invoiceNumber,
        date: new Date(),
        paymentId: payment.razorpayPaymentId,
        studentName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        amount: payment.amount
      };

      const path = require('path');
      const { generateInvoicePDF } = require('../services/invoice.service');
      const pdfPath = path.join(__dirname, '..', '..', 'public', 'invoices', `${invoiceNumber}.pdf`);
      
      await generateInvoicePDF(invoiceData, pdfPath);
      
      await prisma.invoice.update({
        where: { id: newInvoice.id },
        data: { pdfUrl: `/invoices/${invoiceNumber}.pdf` }
      });

      return res.json({ success: true, message: "Payment verified successfully" });
    } else {
      await prisma.payment.update({
        where: { razorpayOrderId: razorpay_order_id },
        data: { status: "FAILED" }
      });
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createOrder, verifyPayment };
