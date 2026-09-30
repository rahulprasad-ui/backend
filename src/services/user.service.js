const { admin } = require('../config/firebase');
const EmailService = require('./email.service');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

class UserService {
  /**
   * Retrieves user profile from Firebase Firestore (therivdata collection).
   */
  static async getProfile(uid) {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    try {
      const doc = await admin.firestore().collection('therivdata').doc(uid).get();
      if (!doc.exists) {
        throw ApiError.notFound('User profile not found in Firebase Firestore.');
      }
      const data = doc.data() || {};

      return {
        uid,
        id: uid,
        email: data.email || null,
        phone: data.phone || data.phoneno || null,
        name: data.name || data.username || '',
        isPremium: Boolean(data.premiumStatus || data.isPremium),
        is_premium: Boolean(data.premiumStatus || data.isPremium),
        premiumStatus: data.premiumStatus ? 'active' : 'inactive',
        premium_status: data.premiumStatus ? 'active' : 'inactive',
        premiumSource: data.premium_source || null,
        isElite: Boolean(data.isElite),
        tier: data.tier || 'free',
        createdAt: data.createdAt || Date.now(),
        updatedAt: data.updatedAt || Date.now()
      };
    } catch (e) {
      if (e.statusCode) throw e;
      logger.error('Error fetching user profile from Firestore:', e);
      throw ApiError.internal('Failed to retrieve user profile.');
    }
  }

  /**
   * Updates or creates user profile in Firebase Firestore (therivdata collection).
   */
  static async updateProfile(uid, profileData) {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const now = Date.now();
    const updatePayload = {
      updatedAt: now
    };

    if (profileData.email) updatePayload.email = profileData.email;
    if (profileData.phone || profileData.phoneNumber) updatePayload.phoneno = profileData.phone || profileData.phoneNumber;
    if (profileData.name || profileData.full_name || profileData.displayName) updatePayload.name = profileData.name || profileData.full_name || profileData.displayName;
    if (profileData.is_premium !== undefined || profileData.premiumStatus !== undefined) {
      const isPrem = profileData.is_premium || profileData.premiumStatus;
      updatePayload.premiumStatus = Boolean(isPrem);
      updatePayload.isPremium = Boolean(isPrem);
    }
    if (profileData.premium_source) updatePayload.premium_source = profileData.premium_source;

    try {
      await admin.firestore().collection('therivdata').doc(uid).set(updatePayload, { merge: true });
      logger.info(`User profile updated in Firestore (therivdata/${uid})`);

      const email = updatePayload.email;
      const name = updatePayload.name || '';
      const isVerified = profileData.isVerified || profileData.email_verified;

      if (email && isVerified) {
        logger.info(`Sending welcome email via Resend to ${email} (UID: ${uid})`);
        await EmailService.sendWelcomeEmail(email, name).catch(err => {
          logger.error(`Welcome email dispatch error: ${err.message}`);
        });
      }

      return this.getProfile(uid);
    } catch (e) {
      if (e.statusCode) throw e;
      logger.error('Error updating user profile in Firestore:', e);
      throw ApiError.internal('Failed to update user profile.');
    }
  }
}

module.exports = UserService;
