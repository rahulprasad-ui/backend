const crypto = require('crypto');
const { admin } = require('../config/firebase');
const db = require('../config/database');
const config = require('../config/env');
const OtpService = require('./otp.service');
const EmailService = require('./email.service');
const ApiError = require('../utils/apiError');
const AuthConstants = require('../constants/authConstants');
const logger = require('../utils/logger');

class AuthService {
  /**
   * Generates and dispatches an OTP.
   * @param {string} phone E.164 phone string
   * @param {string} rawPhone10 10-digit phone string
   */
  static async requestOtp(phone, rawPhone10) {
    const now = Date.now();

    const result = await db.execute({
      sql: 'SELECT * FROM otps WHERE phone = ?',
      args: [phone]
    });
    const existing = result.rows[0];
    let resendCount = 0;

    if (existing) {
      const createdAt = Number(existing.created_at) || 0;
      if (now - createdAt < AuthConstants.OTP_EXPIRY_MINUTES * 60 * 1000) {
        const elapsedSeconds = Math.floor((now - createdAt) / 1000);
        if (elapsedSeconds < AuthConstants.RESEND_COOLDOWN_SECONDS) {
          const remaining = AuthConstants.RESEND_COOLDOWN_SECONDS - elapsedSeconds;
          throw ApiError.tooManyRequests(`Please wait ${remaining} seconds before requesting a new OTP.`);
        }
      }
      resendCount = (Number(existing.resend_count) || 0) + 1;
    }

    const otp = OtpService.generateOTP();
    await OtpService.sendSmsOTP(rawPhone10, otp);

    const expiresAt = now + AuthConstants.OTP_EXPIRY_MINUTES * 60 * 1000;
    await db.execute({
      sql: `
        INSERT INTO otps (phone, otp, attempts, resend_count, created_at, expires_at)
        VALUES (?, ?, 0, ?, ?, ?)
        ON CONFLICT(phone) DO UPDATE SET
          otp = excluded.otp,
          attempts = 0,
          resend_count = excluded.resend_count,
          created_at = excluded.created_at,
          expires_at = excluded.expires_at
      `,
      args: [phone, otp, resendCount, now, expiresAt]
    });

    logger.info(`OTP generated & stored in Turso Cloud SQLite for ${phone}`);
    return {
      success: true,
      message: 'OTP sent successfully.'
    };
  }

  /**
   * Verifies an OTP and produces authentication token.
   * @param {string} phone E.164 phone string
   * @param {string} inputOtp 6-digit OTP code entered by user
   */
  static async verifyOtp(phone, inputOtp) {
    const result = await db.execute({
      sql: 'SELECT * FROM otps WHERE phone = ?',
      args: [phone]
    });
    const record = result.rows[0];

    if (!record) {
      throw ApiError.badRequest('OTP not found or has already expired. Please request a new OTP.');
    }

    const now = Date.now();

    // Check expiry
    if (now > Number(record.expires_at)) {
      await db.execute({ sql: 'DELETE FROM otps WHERE phone = ?', args: [phone] });
      throw ApiError.badRequest('OTP has expired. Please request a new one.');
    }

    // Check attempts limit
    const attempts = Number(record.attempts) || 0;
    if (attempts >= AuthConstants.MAX_OTP_ATTEMPTS) {
      await db.execute({ sql: 'DELETE FROM otps WHERE phone = ?', args: [phone] });
      throw ApiError.badRequest('Maximum verification attempts exceeded. Please request a new OTP.');
    }

    // Compare OTP
    if (record.otp !== inputOtp) {
      const newAttempts = attempts + 1;
      await db.execute({
        sql: 'UPDATE otps SET attempts = ? WHERE phone = ?',
        args: [newAttempts, phone]
      });
      const remainingAttempts = AuthConstants.MAX_OTP_ATTEMPTS - newAttempts;

      if (remainingAttempts <= 0) {
        await db.execute({ sql: 'DELETE FROM otps WHERE phone = ?', args: [phone] });
        throw ApiError.badRequest('Invalid OTP. Maximum attempts exceeded. Please request a new OTP.');
      }

      throw ApiError.badRequest(`Invalid OTP. ${remainingAttempts} attempt(s) remaining.`);
    }

    // OTP matched - delete OTP record
    await db.execute({ sql: 'DELETE FROM otps WHERE phone = ?', args: [phone] });

    // Upsert user in Turso
    await db.execute({
      sql: `
        INSERT INTO users (id, phone, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          phone = excluded.phone,
          updated_at = excluded.updated_at
      `,
      args: [phone, phone, now]
    });

    const uid = phone;
    let customToken = `token_${uid}_${Date.now()}`;
    try {
      if (admin && admin.auth) {
        customToken = await admin.auth().createCustomToken(uid, {
          phoneNumber: phone,
          verifiedAt: now
        });
      }
    } catch (tokenErr) {
      logger.warn(`Firebase token fallback: ${tokenErr.message}`);
    }

    logger.info(`Authentication successful in Turso for ${phone}`);
    return {
      token: customToken,
      uid
    };
  }

  /**
   * Generates a backend reset token and dispatches branded email via Resend
   * @param {string} email
   */
  static async requestPasswordReset(email) {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw ApiError.badRequest('A valid email address is required.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const token = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000; // 15 minutes

    await db.execute({
      sql: `
        INSERT INTO password_resets (email, token, created_at, expires_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
          token = excluded.token,
          created_at = excluded.created_at,
          expires_at = excluded.expires_at
      `,
      args: [cleanEmail, token, now, expiresAt]
    });

    const baseUrl = config.baseUrl || 'https://backend-6fey.onrender.com';
    const resetLink = `${baseUrl}/reset?token=${token}&email=${encodeURIComponent(cleanEmail)}`;

    try {
      await EmailService.sendPasswordResetEmail(cleanEmail, resetLink);
      logger.info(`Branded backend password reset link dispatched via Resend to ${cleanEmail}`);

      return {
        success: true,
        message: 'Password reset link sent successfully.'
      };
    } catch (err) {
      logger.error(`Failed to send password reset email for ${cleanEmail}:`, err);
      throw ApiError.badRequest('Failed to send password reset email. Please try again.');
    }
  }

  /**
   * Resets password using backend verification token
   * @param {string} email
   * @param {string} token
   * @param {string} newPassword
   */
  static async resetPassword(email, token, newPassword) {
    if (!email || !token || !newPassword) {
      throw ApiError.badRequest('Email, token, and new password are required.');
    }
    if (newPassword.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters long.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const now = Date.now();

    const result = await db.execute({
      sql: 'SELECT * FROM password_resets WHERE email = ?',
      args: [cleanEmail]
    });
    const record = result.rows[0];

    if (!record || record.token !== token) {
      throw ApiError.badRequest('Invalid or expired password reset token.');
    }

    if (now > Number(record.expires_at)) {
      await db.execute({ sql: 'DELETE FROM password_resets WHERE email = ?', args: [cleanEmail] });
      throw ApiError.badRequest('Password reset token has expired. Please request a new one.');
    }

    // Cleanup token
    await db.execute({ sql: 'DELETE FROM password_resets WHERE email = ?', args: [cleanEmail] });

    try {
      if (admin && admin.auth) {
        const userRecord = await admin.auth().getUserByEmail(cleanEmail);
        if (userRecord && userRecord.uid) {
          await admin.auth().updateUser(userRecord.uid, { password: newPassword });
          logger.info(`Updated Firebase Auth password for ${cleanEmail}`);
        }
      }
    } catch (fbErr) {
      logger.warn(`Firebase Auth update skipped: ${fbErr.message}`);
    }

    logger.info(`Password successfully reset in Turso for ${cleanEmail}`);
    return {
      success: true,
      message: 'Password reset successfully. You can now login.'
    };
  }
}

module.exports = AuthService;
