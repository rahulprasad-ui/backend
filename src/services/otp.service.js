const crypto = require('crypto');
const config = require('../config/env');
const logger = require('../utils/logger');
const AuthConstants = require('../constants/authConstants');
const EmailService = require('./email.service');

class OtpService {
  /**
   * Generates a cryptographically secure numeric OTP of specified length.
   * @param {number} [length=6]
   * @returns {string}
   */
  static generateOTP(length = AuthConstants.OTP_LENGTH) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return crypto.randomInt(min, max + 1).toString();
  }

  /**
   * Dispatches OTP via Resend Email.
   * @param {string} email Target email address
   * @param {string} otp 6-digit OTP code
   * @returns {Promise<boolean>}
   */
  static async sendEmailOTP(email, otp) {
    try {
      return await EmailService.sendOtpEmail(email, otp);
    } catch (error) {
      logger.error(`Failed to send Email OTP via Resend to ${email}:`, error.message);
      return false;
    }
  }

  /**
   * Phone verification handler (Logs securely in dev; Resend configured for live email OTPs).
   * @param {string} phone Phone number
   * @param {string} otp OTP code
   * @returns {Promise<boolean>}
   */
  static async sendSmsOTP(phone, otp) {
    const maskedOtp = config.env === 'development' ? otp : `${otp.substring(0, 2)}****`;
    logger.info(`[Auth] Verification OTP for ${phone}: ${maskedOtp} (Resend active for email delivery)`);
    return true;
  }
}

module.exports = OtpService;
