const prisma = require('../utils/prisma');
const { hashPassword, comparePassword } = require('../utils/hash');
const { generateToken } = require('../utils/jwt');
const crypto = require('crypto');
// Assuming resend is initialized somewhere, we can mock it here for now or implement it fully.
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const hashedPassword = await hashPassword(password);
    
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
      }
    });

    const token = generateToken({ id: user.id, role: 'student' });

    // Send verification email via resend
    try {
      await resend.emails.send({
        from: 'ChartMentor <noreply@chartmentor.com>', // Requires a verified domain in Resend
        to: email,
        subject: 'Welcome to ChartMentor - Verify your Email',
        html: `<p>Hi ${firstName},</p><p>Welcome to ChartMentor! Please click <a href="${process.env.FRONTEND_URL}/verify-email?token=${token}">here</a> to verify your email.</p>`
      });
    } catch (emailError) {
      console.error("Failed to send welcome email", emailError);
    }
    
    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        token
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const userRole = user.role === 'ADMIN' ? 'admin' : 'student';
    const token = generateToken({ id: user.id, role: userRole });
    
    res.json({
      success: true,
      data: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: userRole,
        token
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'ADMIN') {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    const token = generateToken({ id: user.id, role: 'admin' });
    
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        token
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry }
    });

    try {
      await resend.emails.send({
        from: 'ChartMentor <noreply@chartmentor.com>',
        to: email,
        subject: 'Password Reset Request',
        html: `<p>You requested a password reset.</p><p>Click <a href="${process.env.FRONTEND_URL}/student/reset-password?token=${resetToken}">here</a> to reset your password.</p>`
      });
    } catch (err) {
      console.error(err);
    }

    res.json({ success: true, message: 'Password reset link sent to email' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    res.json({ success: true, message: 'Password successfully reset' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { register, login, adminLogin, getMe, forgotPassword, resetPassword };
