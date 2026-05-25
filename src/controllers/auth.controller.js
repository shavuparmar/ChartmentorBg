const prisma = require('../utils/prisma');
const { hashPassword, comparePassword } = require('../utils/hash');
const { generateToken } = require('../utils/jwt');
const crypto = require('crypto');
const { sendOTPEmail, sendPasswordResetEmail } = require('../services/email.service');

const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    
    let user = await prisma.user.findUnique({ where: { email } });
    
    if (user) {
      if (user.isVerified) {
        return res.status(400).json({ success: false, message: 'User already exists and is verified. Please login.' });
      }
      
      // Enforce 60-second cooldown for existing unverified users
      if (user.updatedAt && (Date.now() - new Date(user.updatedAt).getTime() < 60000)) {
        return res.status(429).json({ success: false, message: 'Please wait 60 seconds before requesting a new OTP.' });
      }
    }

    const hashedPassword = await hashPassword(password);
    const otp = generateOTP();
    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
    const otpExpiry = new Date(Date.now() + 15 * 60000); // 15 mins

    if (!user) {
      user = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email,
          password: hashedPassword,
          resetToken: hashedOTP,
          resetTokenExpiry: otpExpiry
        }
      });
    } else {
      user = await prisma.user.update({
        where: { email },
        data: {
          firstName,
          lastName,
          password: hashedPassword, // Overwrite password if they register again before verifying
          resetToken: hashedOTP,
          resetTokenExpiry: otpExpiry
        }
      });
    }

    await sendOTPEmail(email, firstName, otp);
    
    res.status(201).json({
      success: true,
      message: 'OTP sent to email successfully. Please verify to complete registration.',
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified' });
    }

    // 60-second cooldown enforcement
    if (user.updatedAt && (Date.now() - new Date(user.updatedAt).getTime() < 60000)) {
      return res.status(429).json({ success: false, message: 'Please wait 60 seconds before requesting a new OTP.' });
    }

    const otp = generateOTP();
    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
    const otpExpiry = new Date(Date.now() + 15 * 60000); // 15 mins

    await prisma.user.update({
      where: { email },
      data: {
        resetToken: hashedOTP,
        resetTokenExpiry: otpExpiry
      }
    });

    await sendOTPEmail(email, user.firstName, otp);

    res.json({
      success: true,
      message: 'A new OTP has been sent to your email.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified' });
    }

    const hashedInputOTP = crypto.createHash('sha256').update(otp).digest('hex');

    if (user.resetToken !== hashedInputOTP || new Date() > user.resetTokenExpiry) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Invalidate OTP immediately upon success
    await prisma.user.update({
      where: { email },
      data: {
        isVerified: true,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    // We do NOT generate a token here, because we want the user to log in manually!
    res.json({
      success: true,
      message: 'Email verified successfully. You can now login.'
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

    if (!user.isVerified && user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Please verify your email before logging in.', unverified: true });
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
      // Don't leak whether the user exists
      return res.json({ success: true, message: 'If that email is registered, we have sent a password reset link.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: hashedResetToken, resetTokenExpiry }
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    await sendPasswordResetEmail(email, resetLink);

    res.json({ success: true, message: 'If that email is registered, we have sent a password reset link.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    const hashedResetToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedResetToken,
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

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password' });
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    res.json({ success: true, message: 'Password successfully updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { register, resendOTP, verifyEmail, login, adminLogin, getMe, forgotPassword, resetPassword, changePassword };
