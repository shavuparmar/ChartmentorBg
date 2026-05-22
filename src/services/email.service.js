const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
// For unverified domains in Resend, you MUST use onboarding@resend.dev
// Otherwise, the email is silently dropped or returns a validation error.
const fromEmail = process.env.EMAIL_FROM || 'ChartMentor <noreply@deyzora.online>';

/**
 * Send an OTP verification email
 */
const sendOTPEmail = async (to, firstName, otp) => {
  try {
    console.log(`[Email Service] Attempting to send OTP to ${to} from ${fromEmail}...`);

    // Resend SDK returns { data, error } instead of throwing an exception
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: 'Welcome to ChartMentor - Verify your Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px; background-color: #ffffff;">
          <h2 style="color: #3b82f6; text-align: center;">Verify Your Email Address</h2>
          <p style="color: #333333; font-size: 16px;">Hi ${firstName},</p>
          <p style="color: #555555; font-size: 15px; line-height: 1.5;">Welcome to ChartMentor! To complete your registration and secure your account, please use the following 6-digit code. This code will expire in 15 minutes.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0; border: 1px dashed #cbd5e1;">
            <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #1e293b;">${otp}</span>
          </div>
          
          <p style="color: #ef4444; font-size: 13px; text-align: center; margin-bottom: 20px;">
            ⚠️ Do not share this code with anyone. Our team will never ask for your OTP.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            If you did not request this verification, please ignore this email or contact support.
          </p>
        </div>
      `,
      text: `Hi ${firstName}, Welcome to ChartMentor! Your verification code is: ${otp}. It expires in 15 minutes.`
    });

    if (error) {
      console.error(`[Email Service] Resend API Error for ${to}:`, error);
      throw new Error(error.message || 'Failed to send OTP email via Resend API');
    }

    console.log(`[Email Service] OTP successfully sent to ${to}. Message ID: ${data?.id}`);
    return data;
  } catch (error) {
    console.error(`[Email Service] Exception sending OTP to ${to}:`, error);
    // Throw error so the controller can catch it and abort registration
    throw error;
  }
};

/**
 * Send a membership confirmation email
 */
const sendMembershipConfirmation = async (to, firstName, planName, amount, discordLink, telegramLink) => {
  try {
    await resend.emails.send({
      from: fromEmail,
      to,
      subject: 'Your ChartMentor Membership is Active! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #10b981; margin: 0;">Payment Successful!</h2>
            <p style="color: #64748b; margin-top: 5px;">Welcome to ChartMentor Premium</p>
          </div>
          
          <p style="color: #333333; font-size: 16px;">Hi ${firstName},</p>
          <p style="color: #555555; font-size: 15px; line-height: 1.5;">Thank you for your purchase! Your payment of <strong>₹${amount}</strong> for the <strong>${planName}</strong> plan has been received and your membership is now active.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 30px 0; border: 1px solid #e2e8f0;">
            <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">Your Exclusive Community Links</h3>
            <p style="color: #64748b; font-size: 14px; margin-bottom: 15px;">Join our private trading communities to get real-time setups and mentoring:</p>
            
            ${telegramLink ? `
              <a href="${telegramLink}" style="display: block; width: 100%; text-align: center; background-color: #229ED9; color: #ffffff; padding: 12px 0; border-radius: 6px; text-decoration: none; font-weight: bold; margin-bottom: 10px;">
                Join VIP Telegram Channel
              </a>
            ` : ''}
            
            ${discordLink ? `
              <a href="${discordLink}" style="display: block; width: 100%; text-align: center; background-color: #5865F2; color: #ffffff; padding: 12px 0; border-radius: 6px; text-decoration: none; font-weight: bold;">
                Join Private Discord Server
              </a>
            ` : ''}
          </div>
          
          <p style="color: #333333; font-size: 15px;">You can view your invoice and manage your subscription anytime from your student dashboard.</p>
          
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            Need help? Reply to this email or contact our support team from your dashboard.
          </p>
        </div>
      `
    });
    console.log(`[Email Service] Membership confirmation sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`[Email Service] Failed to send membership confirmation to ${to}:`, error);
    return false;
  }
};

/**
 * Send a password reset email
 */
const sendPasswordResetEmail = async (to, resetLink) => {
  try {
    console.log(`[Email Service] Attempting to send Password Reset to ${to} from ${fromEmail}...`);
    
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: 'ChartMentor - Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px; background-color: #ffffff;">
          <h2 style="color: #3b82f6; text-align: center;">Reset Your Password</h2>
          <p style="color: #333333; font-size: 16px;">Hello,</p>
          <p style="color: #555555; font-size: 15px; line-height: 1.5;">We received a request to reset your password for your ChartMentor account. If you didn't make this request, you can safely ignore this email.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="display: inline-block; padding: 14px 28px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Reset Password</a>
          </div>
          
          <p style="color: #94a3b8; font-size: 13px; text-align: center;">
            This link will expire in 1 hour.
          </p>
        </div>
      `,
      text: `Hello, You requested a password reset. Please copy and paste this link in your browser to reset your password: ${resetLink}`
    });

    if (error) {
      console.error(`[Email Service] Resend API Error for ${to}:`, error);
      throw new Error(error.message || 'Failed to send password reset email via Resend API');
    }

    console.log(`[Email Service] Password Reset successfully sent to ${to}. Message ID: ${data?.id}`);
    return data;
  } catch (error) {
    console.error(`[Email Service] Exception sending Password Reset to ${to}:`, error);
    throw error; 
  }
};

module.exports = {
  sendOTPEmail,
  sendMembershipConfirmation,
  sendPasswordResetEmail
};
