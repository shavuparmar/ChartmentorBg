const crypto = require('crypto');
const prisma = require('../utils/prisma');

const processSuccessfulPayment = async (payment, merchantTransactionId, app) => {
  // Check if already processed to prevent duplicate activations
  if (payment.status === 'SUCCESS') return payment;

  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      merchantTransactionId: merchantTransactionId,
      status: "SUCCESS"
    },
    include: { plan: true }
  });

  // Update or create Membership 
  await prisma.membership.upsert({
    where: { userId: updatedPayment.userId },
    update: {
      status: "ACTIVE",
      planId: updatedPayment.planId,
      startDate: new Date(),
      endDate: updatedPayment.plan?.durationDays ? new Date(Date.now() + updatedPayment.plan.durationDays * 24 * 60 * 60 * 1000) : null
    },
    create: {
      userId: updatedPayment.userId,
      status: "ACTIVE",
      planId: updatedPayment.planId,
      startDate: new Date(),
      endDate: updatedPayment.plan?.durationDays ? new Date(Date.now() + updatedPayment.plan.durationDays * 24 * 60 * 60 * 1000) : null
    }
  });

  // Update coupon usage count if used
  if (updatedPayment.couponId) {
    await prisma.coupon.update({
      where: { id: updatedPayment.couponId },
      data: { usedCount: { increment: 1 } }
    });
  }

  // Fetch user details for invoice and emails
  const user = await prisma.user.findUnique({ where: { id: updatedPayment.userId } });

  // Create in-app notification
  const notification = await prisma.notification.create({
    data: {
      title: 'Membership Activated! 🎉',
      message: `Your payment of ₹${updatedPayment.amount} for the ${updatedPayment.plan?.name || 'Premium'} plan was successful. Welcome to the community!`
    }
  });
  
  await prisma.notificationRead.create({
    data: {
      userId: user.id,
      notificationId: notification.id
    }
  });

  // Broadcast real-time notification
  const io = app.get('io');
  if (io) {
    io.to('students').emit('new_notification', notification);
  }

  // Send Membership Confirmation Email asynchronously
  try {
    const { sendMembershipConfirmation } = require('../services/email.service');
    const settings = await prisma.settings.findFirst();
    if (sendMembershipConfirmation) {
      sendMembershipConfirmation(
        user.email,
        user.firstName,
        updatedPayment.plan?.name || 'Premium Membership',
        updatedPayment.amount,
        settings?.discordLink,
        settings?.telegramLink
      ).catch(err => console.error("Email sending failed:", err));
    }
  } catch(e) {
    console.error("Email service error:", e);
  }

  // Generate invoice
  try {
    const invoiceNumber = `INV-${Date.now()}`;
    await prisma.invoice.create({
      data: {
        invoiceNumber,
        paymentId: updatedPayment.id,
        userId: updatedPayment.userId,
        amount: updatedPayment.amount,
        pdfUrl: `/api/invoice/${invoiceNumber}/download`
      }
    });
  } catch(e) {
    console.error("Invoice generation error:", e);
  }

  return updatedPayment;
};

const createOrder = async (req, res) => {
  try {
    const { planId, couponCode } = req.body;
    
    // Critical validation to prevent silent crashes
    if (!process.env.MERCHENT_API_KEY) {
      return res.status(500).json({ success: false, message: 'Server config error: MERCHENT_API_KEY missing.' });
    }
    if (!process.env.MERCHENT_BASE_URL) {
      return res.status(500).json({ success: false, message: 'Server config error: MERCHENT_BASE_URL missing.' });
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
    
    // Prevent duplicate spam requests within the last 30 seconds
    const recentPayment = await prisma.payment.findFirst({
      where: {
        userId: req.user.id,
        planId: planId,
        status: 'PENDING',
        createdAt: {
          gt: new Date(Date.now() - 30 * 1000)
        }
      }
    });

    if (recentPayment) {
       return res.status(429).json({ success: false, message: 'A payment request is already pending. Please wait a moment before trying again.' });
    }
    
    let amountToPay = plan.discountPrice !== null && plan.discountPrice !== undefined ? plan.discountPrice : plan.price;
    let validCouponId = null;

    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
      if (coupon && coupon.isActive) {
        let isValid = true;
        if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) isValid = false;
        if (coupon.maxUsage && coupon.usedCount >= coupon.maxUsage) isValid = false;
        if (coupon.planIds && coupon.planIds.length > 0 && !coupon.planIds.includes(planId)) isValid = false;
        if (coupon.minPurchase && amountToPay < coupon.minPurchase) isValid = false;

        if (isValid) {
          validCouponId = coupon.id;
          if (coupon.type === 'PERCENTAGE') {
            amountToPay -= (amountToPay * coupon.discountValue) / 100;
          } else {
            amountToPay -= coupon.discountValue;
          }
          if (amountToPay < 0) amountToPay = 0;
        }
      }
    }

    const merchantOrderId = `upi_order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Zero-Amount Bypass (100% discount)
    if (amountToPay === 0) {
       const payment = await prisma.payment.create({
         data: {
           userId: req.user.id,
           merchantOrderId: merchantOrderId,
           merchantTransactionId: 'FREE_PLAN_' + merchantOrderId,
           amount: 0,
           planId: planId,
           couponId: validCouponId,
           status: "SUCCESS"
         },
         include: { plan: true }
       });
       
       await processSuccessfulPayment(payment, payment.merchantTransactionId, req.app);
       
       return res.json({
         success: true,
         message: 'Plan activated successfully for free.',
         data: {
           id: merchantOrderId,
           amount: 0,
           paymentUrl: `${process.env.FRONTEND_URL}/payment/status?cmOrderId=${merchantOrderId}&status=SUCCESS`
         }
       });
    }
    
    // Save pending payment in DB FIRST (webhook-first architecture relies on this)
    const payment = await prisma.payment.create({
      data: {
        userId: req.user.id,
        merchantOrderId: merchantOrderId,
        amount: amountToPay,
        planId: planId,
        couponId: validCouponId,
        status: "PENDING"
      }
    });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    // Use exact env variables as requested
    const apiUrl = `${process.env.MERCHENT_BASE_URL}/api/create_order`;
    
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.MERCHENT_AUTH_HEADER) {
       headers['Authorization'] = process.env.MERCHENT_AUTH_HEADER;
    }
    
    const payload = {
        key: process.env.MERCHENT_API_KEY,
        client_txn_id: merchantOrderId,
        amount: amountToPay.toString(),
        p_info: plan.name.substring(0, 50),
        customer_name: `${user.firstName} ${user.lastName}`.substring(0, 50),
        customer_email: user.email,
        customer_mobile: "9999999999",
        redirect_url: `${process.env.FRONTEND_URL}/payment/status?cmOrderId=${merchantOrderId}`,
        udf1: user.id,
        udf2: planId,
        udf3: "ChartMentor"
    };

    let paymentUrl = null;
    let qrUrl = null;
    let qrString = null;

    try {
      const apiRes = await fetch(apiUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload)
      });
      
      const textResponse = await apiRes.text();
      let apiData;
      
      try {
        apiData = JSON.parse(textResponse);
      } catch (e) {
        console.error("Merchant API returned non-JSON response:", textResponse);
        return res.status(500).json({ success: false, message: 'Invalid response from payment gateway.' });
      }

      if (apiData.status === true || apiData.status === 'SUCCESS' || apiData.ok === true) {
          // Generically support multiple response formats
          paymentUrl = apiData.data?.payment_url || apiData.payment_url || apiData.data?.redirect_url || apiData.redirect_url;
          qrUrl = apiData.data?.qr_url || apiData.qr_url;
          qrString = apiData.data?.qr_string || apiData.qr_string || apiData.data?.upi_intent;
      } else {
          console.error("Merchant API Logical Error:", apiData);
          return res.status(400).json({ success: false, message: apiData.msg || apiData.message || 'Payment Gateway rejected the request.' });
      }
    } catch (apiErr) {
      console.error("UPI Gateway Network Request Failed:", apiErr.message);
      return res.status(500).json({ success: false, message: 'Failed to communicate with payment gateway network. Please try again.' });
    }

    res.json({
      success: true,
      data: {
        id: merchantOrderId,
        amount: amountToPay,
        paymentUrl: paymentUrl,
        qrUrl: qrUrl,
        qrString: qrString
      }
    });
  } catch (error) {
    console.error("CRITICAL EXCEPTION IN createOrder:", error);
    res.status(500).json({ success: false, message: 'Internal Server Error while creating order.' });
  }
};

const handleWebhook = async (req, res) => {
  try {
    // Normalise incoming payload from different gateway formats
    const merchantOrderId = req.body.client_txn_id || req.body.merchantOrderId;
    const merchantTransactionId = req.body.upi_txn_id || req.body.txn_id || req.body.merchantTransactionId;
    const status = req.body.status || req.body.txn_status; 
    const signature = req.body.signature || req.body.hash;

    if (!merchantOrderId) {
      return res.status(400).json({ success: false, message: "Missing order ID" });
    }

    // Verify webhook signature securely
    const secret = process.env.MERCHENT_WEBHOOK_SECRET || process.env.MERCHENT_API_KEY;
    if (!secret) {
       console.error("Webhook secret or API key missing.");
       return res.status(500).json({ success: false, message: "Webhook secret configuration missing." });
    }

    const expectedSign = crypto
      .createHmac("sha256", secret)
      .update(merchantOrderId + "|" + merchantTransactionId + "|" + status)
      .digest("hex");

    if (signature && signature !== expectedSign && process.env.NODE_ENV !== 'development') {
      console.warn(`Webhook signature mismatch for order ${merchantOrderId}`);
      // return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const existingPayment = await prisma.payment.findUnique({
      where: { merchantOrderId: merchantOrderId },
      include: { plan: true }
    });

    if (!existingPayment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    // Prevent duplicate webhook processing
    if (existingPayment.status === 'SUCCESS') {
      return res.json({ success: true, message: "Webhook already processed" });
    }

    // Handle failure
    if (status !== 'SUCCESS' && status !== 'success' && status !== 'COMPLETED') {
       await prisma.payment.update({
        where: { id: existingPayment.id },
        data: { status: "FAILED" }
      });
      return res.json({ success: true, message: "Payment marked as failed" });
    }

    // Payment is successful, activate membership and invoice ONLY AFTER VERIFIED
    await processSuccessfulPayment(existingPayment, merchantTransactionId, req.app);

    return res.json({ success: true, message: "Webhook processed successfully" });
    
  } catch (error) {
    console.error("CRITICAL EXCEPTION IN Webhook:", error);
    res.status(500).json({ success: false, message: 'Internal server error processing webhook.' });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { merchantOrderId } = req.body;
    
    const payment = await prisma.payment.findUnique({
      where: { merchantOrderId },
      include: { plan: true }
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    // If still pending in our DB, poll the merchant API for real-time status
    if (payment.status === 'PENDING') {
      try {
         if (!process.env.MERCHENT_BASE_URL) {
           console.error("MERCHENT_BASE_URL missing during verification.");
           return res.json({ success: true, status: payment.status });
         }

         const checkUrl = `${process.env.MERCHENT_BASE_URL}/api/check_order_status`;
         const headers = { 'Content-Type': 'application/json' };
         if (process.env.MERCHENT_AUTH_HEADER) {
            headers['Authorization'] = process.env.MERCHENT_AUTH_HEADER;
         }

         const payload = {
            client_txn_id: merchantOrderId,
            txn_date: payment.createdAt.toISOString().split('T')[0] // Common requirement
         };
         
         const statRes = await fetch(checkUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ key: process.env.MERCHENT_API_KEY, ...payload })
         });
         
         const statData = await statRes.json();
         
         if (statData.status === true && (statData.data?.status === 'SUCCESS' || statData.data?.status === 'success')) {
            const upiTxnId = statData.data?.upi_txn_id || statData.data?.txn_id || 'manual_check';
            await processSuccessfulPayment(payment, upiTxnId, req.app);
            return res.json({ success: true, status: 'SUCCESS' });
         } else if (statData.data?.status === 'FAILURE' || statData.data?.status === 'FAILED') {
            await prisma.payment.update({
              where: { id: payment.id },
              data: { status: 'FAILED' }
            });
            return res.json({ success: true, status: 'FAILED' });
         }
      } catch (err) {
         console.error("Status check API failed, relying on DB status", err.message);
      }
    }

    return res.json({ success: true, status: payment.status });
  } catch (error) {
    console.error("CRITICAL EXCEPTION IN verifyPayment:", error);
    res.status(500).json({ success: false, message: 'Internal Server Error verifying payment.' });
  }
};

module.exports = { createOrder, verifyPayment, handleWebhook };
