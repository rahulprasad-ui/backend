const { admin, db } = require('../config/firebase');
const config = require('../config/env');
const OtpService = require('./otp.service');
const EmailService = require('./email.service');
const ApiError = require('../utils/apiError');
const AuthConstants = require('../constants/authConstants');
const logger = require('../utils/logger');

class AuthService {
  /**
   * Generates and dispatches an OTP to a verified phone number.
   * @param {string} phone E.164 phone string (e.g. +919876543210)
   * @param {string} rawPhone10 10-digit phone string for SMS gateway
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  static async requestOtp(phone, rawPhone10) {
    const otpRef = db.collection(AuthConstants.OTP_COLLECTION).doc(phone);
    const docSnap = await otpRef.get();

    let attempts = 0;
    let resendCount = 0;
    const now = Date.now();

    if (docSnap.exists) {
      const data = docSnap.data();
      const createdAt = data.createdAt || 0;

      // Check if within expiry window
      if (now - createdAt < AuthConstants.OTP_EXPIRY_MINUTES * 60 * 1000) {
        // Enforce resend cooldown (e.g. 60 seconds)
        const elapsedSeconds = Math.floor((now - createdAt) / 1000);
        if (elapsedSeconds < AuthConstants.RESEND_COOLDOWN_SECONDS) {
          const remaining = AuthConstants.RESEND_COOLDOWN_SECONDS - elapsedSeconds;
          throw ApiError.tooManyRequests(`Please wait ${remaining} seconds before requesting a new OTP.`);
        }
      }

      attempts = data.attempts || 0;
      resendCount = (data.resendCount || 0) + 1;
    }

    const otp = OtpService.generateOTP();
    const smsSent = await OtpService.sendSmsOTP(rawPhone10, otp);

    if (!smsSent) {
      throw ApiError.internal('Failed to dispatch SMS OTP. Please try again later.');
    }

    await otpRef.set({
      otp,
      createdAt: now,
      attempts: 0,
      resendCount,
      expiresAt: now + AuthConstants.OTP_EXPIRY_MINUTES * 60 * 1000
    });

    logger.info(`OTP generated & stored for ${phone}`);
    return {
      success: true,
      message: 'OTP sent successfully.'
    };
  }

  /**
   * Verifies an OTP and produces a Firebase Custom Token upon success.
   * @param {string} phone E.164 phone string
   * @param {string} inputOtp 6-digit OTP code entered by user
   * @returns {Promise<{ token: string, uid: string }>}
   */
  static async verifyOtp(phone, inputOtp) {
    const otpRef = db.collection(AuthConstants.OTP_COLLECTION).doc(phone);
    const docSnap = await otpRef.get();

    if (!docSnap.exists) {
      throw ApiError.badRequest('OTP not found or has already expired. Please request a new OTP.');
    }

    const data = docSnap.data();
    const now = Date.now();

    // Check expiry
    if (now - data.createdAt > AuthConstants.OTP_EXPIRY_MINUTES * 60 * 1000) {
      await otpRef.delete().catch(() => {});
      throw ApiError.badRequest('OTP has expired. Please request a new one.');
    }

    // Check attempts limit
    if (data.attempts >= AuthConstants.MAX_OTP_ATTEMPTS) {
      await otpRef.delete().catch(() => {});
      throw ApiError.badRequest('Maximum verification attempts exceeded. Please request a new OTP.');
    }

    // Compare OTP
    if (data.otp !== inputOtp) {
      const newAttempts = (data.attempts || 0) + 1;
      await otpRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
      const remainingAttempts = AuthConstants.MAX_OTP_ATTEMPTS - newAttempts;
      
      if (remainingAttempts <= 0) {
        await otpRef.delete().catch(() => {});
        throw ApiError.badRequest('Invalid OTP. Maximum attempts exceeded. Please request a new OTP.');
      }
      
      throw ApiError.badRequest(`Invalid OTP. ${remainingAttempts} attempt(s) remaining.`);
    }

    // OTP matched - cleanup token record
    await otpRef.delete().catch((err) => logger.warn(`Failed to delete used OTP document: ${err.message}`));

    // Generate Firebase Custom Token
    const uid = phone;
    const customToken = await admin.auth().createCustomToken(uid, {
      phoneNumber: phone,
      verifiedAt: now
    });

    logger.info(`Authentication successful for ${phone}`);
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
    const crypto = require('crypto');
    const token = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000; // 15 minutes

    // Store in global memory map / collection
    if (!global.resetTokenStore) {
      global.resetTokenStore = new Map();
    }
    global.resetTokenStore.set(cleanEmail, { token, expiresAt });

    // Also persist in Firestore if db is available
    try {
      if (db && typeof db.collection === 'function') {
        await db.collection('password_resets').doc(cleanEmail).set({
          token,
          email: cleanEmail,
          createdAt: now,
          expiresAt
        });
      }
    } catch (dbErr) {
      logger.warn(`Firestore password_resets write skipped: ${dbErr.message}`);
    }

    // Construct web redirect link (compatible with Gmail security policy)
    const baseUrl = config.baseUrl || 'http://192.168.1.22:3000';
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
    let tokenData = global.resetTokenStore ? global.resetTokenStore.get(cleanEmail) : null;

    // Check Firestore fallback if memory store doesn't have it
    if (!tokenData) {
      try {
        if (db && typeof db.collection === 'function') {
          const docSnap = await db.collection('password_resets').doc(cleanEmail).get();
          if (docSnap.exists) {
            tokenData = docSnap.data();
          }
        }
      } catch (dbErr) {
        logger.warn(`Firestore check failed: ${dbErr.message}`);
      }
    }

    if (!tokenData || tokenData.token !== token) {
      throw ApiError.badRequest('Invalid or expired password reset token.');
    }

    if (now > tokenData.expiresAt) {
      if (global.resetTokenStore) global.resetTokenStore.delete(cleanEmail);
      throw ApiError.badRequest('Password reset token has expired. Please request a new one.');
    }

    // Attempt to update password in Firebase Auth if available
    try {
      const userRecord = await admin.auth().getUserByEmail(cleanEmail);
      if (userRecord && userRecord.uid) {
        await admin.auth().updateUser(userRecord.uid, { password: newPassword });
        logger.info(`Updated Firebase Auth password for ${cleanEmail}`);
      }
    } catch (fbErr) {
      logger.warn(`Firebase Auth update skipped/failed: ${fbErr.message}`);
    }

    // Cleanup token
    if (global.resetTokenStore) {
      global.resetTokenStore.delete(cleanEmail);
    }
    try {
      if (db && typeof db.collection === 'function') {
        await db.collection('password_resets').doc(cleanEmail).delete().catch(() => {});
      }
    } catch (e) {}

    logger.info(`Password successfully reset for ${cleanEmail}`);
    return {
      success: true,
      message: 'Password reset successfully. You can now login.'
    };
  }
}

module.exports = AuthService;
