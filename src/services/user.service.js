const { admin, db } = require('../config/firebase');
const EmailService = require('./email.service');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

class UserService {
  /**
   * Retrieves user profile
   */
  static async getProfile(uid) {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw ApiError.notFound('User profile not found.');
    }

    return {
      uid,
      ...userDoc.data()
    };
  }

  /**
   * Updates or initializes user profile in Firestore
   * Automatically triggers Welcome Email if user is verified and welcome email was not sent yet.
   */
  static async updateProfile(uid, profileData) {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const userRef = db.collection('users').doc(uid);
    const docSnap = await userRef.get();
    const existingData = docSnap.exists ? docSnap.data() : {};

    const updatedData = {
      ...profileData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(!docSnap.exists && { createdAt: admin.firestore.FieldValue.serverTimestamp() })
    };

    await userRef.set(updatedData, { merge: true });

    // Check Welcome Email Trigger (replacing Firebase Cloud Function trigger)
    const email = profileData.email || existingData.email;
    const isVerified = profileData.isVerified || existingData.isVerified || profileData.email_verified || existingData.email_verified;
    const welcomeEmailSent = profileData.welcomeEmailSentAt || existingData.welcomeEmailSentAt;
    const name = profileData.name || profileData.full_name || profileData.displayName || existingData.name || existingData.full_name || '';

    if (email && isVerified && !welcomeEmailSent) {
      logger.info(`Triggering welcome email for ${email} (UID: ${uid})`);
      const sent = await EmailService.sendWelcomeEmail(email, name);
      if (sent) {
        await userRef.set({
          welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    }

    return {
      uid,
      ...existingData,
      ...profileData
    };
  }
}

module.exports = UserService;
