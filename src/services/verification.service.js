const crypto = require('crypto');
const { admin, db } = require('../config/firebase');
const EmailService = require('./email.service');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

class VerificationService {
  /**
   * Generates and dispatches an email verification token.
   * Rate limits to 1 email every 60 seconds per UID.
   */
  static async sendVerificationEmail(uid, email) {
    if (!uid || !email) {
      throw ApiError.badRequest('Missing email or user ID.');
    }

    const verificationRef = db.collection('email_verifications').doc(uid);
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await db.runTransaction(async (transaction) => {
      const existingDoc = await transaction.get(verificationRef);
      if (existingDoc.exists) {
        const data = existingDoc.data();
        const now = new Date();
        const createdAt = data.createdAt ? data.createdAt.toDate() : new Date(0);
        const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000;

        if (diffSeconds < 60) {
          throw ApiError.tooManyRequests('Please wait 60 seconds before requesting another email verification.');
        }
      }

      transaction.set(verificationRef, {
        uid,
        email,
        tokenHash,
        expiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    const appBaseUrl = process.env.APP_BASE_URL || 'https://rivava.in';
    const verifyLink = `${appBaseUrl}/verify?token=${token}`;
    const sent = await EmailService.sendVerificationEmail(email, verifyLink);

    if (!sent) {
      throw ApiError.internal('Failed to deliver verification email. Please check email address.');
    }

    logger.info(`Verification email dispatched to ${email} (UID: ${uid})`);
    return { success: true, message: 'Verification email sent successfully.' };
  }

  /**
   * Verifies an email token and marks user profile as verified.
   */
  static async verifyToken(token) {
    if (!token) {
      throw ApiError.badRequest('Missing verification token.');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const snapshot = await db.collection('email_verifications')
      .where('tokenHash', '==', tokenHash)
      .limit(1)
      .get();

    if (snapshot.empty) {
      throw ApiError.badRequest('Invalid or expired verification token.');
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
      await doc.ref.delete().catch(() => {});
      throw ApiError.badRequest('Verification token has expired.');
    }

    // Mark user verified in Firestore
    await db.collection('users').doc(data.uid).set({
      isVerified: true,
      email_verified: true,
      email: data.email,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Update Firebase Auth user
    try {
      await admin.auth().updateUser(data.uid, {
        emailVerified: true
      });
    } catch (authErr) {
      logger.warn(`Could not update emailVerified in Firebase Auth: ${authErr.message}`);
    }

    // Clean up verification token
    await doc.ref.delete().catch(() => {});

    // Send Welcome Email if not sent
    await EmailService.sendWelcomeEmail(data.email, '').catch(() => {});

    return {
      success: true,
      uid: data.uid,
      email: data.email,
      message: 'Email verified successfully.'
    };
  }

  /**
   * Checks current verification status of a user
   */
  static async checkStatus(uid) {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw ApiError.notFound('User record not found.');
    }

    const userData = userDoc.data() || {};
    const isVerified = userData.isVerified === true || userData.email_verified === true;

    return {
      uid,
      isVerified,
      email: userData.email || null
    };
  }
}

module.exports = VerificationService;
