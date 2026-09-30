const crypto = require('crypto');
const { admin } = require('../config/firebase');
const logger = require('../utils/logger');
const NotificationService = require('./notification.service');

const KEY_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

class SecretKeyService {
  /**
   * Generate a cryptographically secure license key string.
   */
  static generateRandomKeyString(prefix = 'RIV') {
    const segments = 4;
    const segmentLength = 4;
    const parts = [prefix];

    for (let s = 0; s < segments; s++) {
      let part = '';
      const randomBytes = crypto.randomBytes(segmentLength);
      for (let i = 0; i < segmentLength; i++) {
        const index = randomBytes[i] % KEY_CHARSET.length;
        part += KEY_CHARSET[index];
      }
      parts.push(part);
    }

    return parts.join('-');
  }

  /**
   * Normalizes a user-input key.
   */
  static normalizeKey(keyString) {
    if (!keyString) return '';
    return keyString.trim().toUpperCase().replace(/[\s_]/g, '-');
  }

  /**
   * Generates and stores new secure keys in Firebase Firestore.
   */
  static async createSecretKey({
    tier = 'portfolio_premium',
    maxUses = 1,
    prefix = 'RIV',
    assignedEmail = null,
    expiresInDays = null,
    notes = '',
    createdBy = 'system_admin'
  } = {}) {
    const rawKey = this.generateRandomKeyString(prefix);
    const now = Date.now();
    const expiresAt = expiresInDays ? (now + expiresInDays * 24 * 60 * 60 * 1000) : null;
    const cleanEmail = assignedEmail ? assignedEmail.toLowerCase().trim() : null;

    const keyData = {
      keyString: rawKey,
      tier,
      maxUses: Number(maxUses) || 1,
      currentUses: 0,
      assignedEmail: cleanEmail,
      expiresAt,
      notes,
      createdBy,
      isActive: true,
      status: 'active',
      redeemedBy: [],
      createdAt: now
    };

    await admin.firestore().collection('secret_keys').doc(rawKey).set(keyData);
    logger.info(`Secret key generated in Firebase Firestore: ${rawKey}`);

    return {
      key: rawKey,
      tier,
      maxUses: Number(maxUses) || 1,
      assignedEmail: cleanEmail,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      createdAt: new Date(now).toISOString()
    };
  }

  /**
   * Validates a secret key in Firebase Firestore without redeeming it.
   */
  static async validateSecretKey(rawKey, userEmail = null) {
    const normalizedKey = this.normalizeKey(rawKey);
    if (!normalizedKey || normalizedKey.length < 8) {
      return { isValid: false, code: 'INVALID_FORMAT', message: 'Invalid key format.' };
    }

    const doc = await admin.firestore().collection('secret_keys').doc(normalizedKey).get();
    if (!doc.exists) {
      return { isValid: false, code: 'NOT_FOUND', message: 'Secret key not found.' };
    }

    const keyRecord = doc.data();

    if (!keyRecord.isActive || keyRecord.status === 'revoked') {
      return { isValid: false, code: 'KEY_REVOKED', message: 'This secret key has been revoked.' };
    }

    if (keyRecord.expiresAt && Date.now() > keyRecord.expiresAt) {
      return { isValid: false, code: 'KEY_EXPIRED', message: 'This secret key has expired.' };
    }

    if (keyRecord.assignedEmail && userEmail) {
      if (keyRecord.assignedEmail.toLowerCase() !== userEmail.toLowerCase()) {
        return { isValid: false, code: 'EMAIL_MISMATCH', message: 'This key was assigned to a different account.' };
      }
    }

    const currentUses = Number(keyRecord.currentUses) || 0;
    const maxUses = Number(keyRecord.maxUses) || 1;

    if (currentUses >= maxUses) {
      return { isValid: false, code: 'ALREADY_REDEEMED', message: 'This key has reached maximum uses.' };
    }

    return {
      isValid: true,
      key: normalizedKey,
      tier: keyRecord.tier || 'portfolio_premium',
      usesRemaining: maxUses - currentUses
    };
  }

  /**
   * Atomically redeems a secret key and unlocks user in Firebase Firestore.
   */
  static async redeemSecretKey({ keyString, userId, userEmail = null }) {
    if (!keyString || !userId) {
      return { success: false, code: 'INVALID_REQUEST', message: 'Key and User ID are required.' };
    }

    const normalizedKey = this.normalizeKey(keyString);
    const firestore = admin.firestore();
    const keyRef = firestore.collection('secret_keys').doc(normalizedKey);
    const userRef = firestore.collection('therivdata').doc(userId);
    const now = Date.now();

    try {
      const result = await firestore.runTransaction(async (transaction) => {
        const keyDoc = await transaction.get(keyRef);
        if (!keyDoc.exists) {
          return { success: false, code: 'NOT_FOUND', message: 'Secret key not found.' };
        }

        const keyData = keyDoc.data();
        if (!keyData.isActive || keyData.status === 'revoked') {
          return { success: false, code: 'KEY_REVOKED', message: 'This secret key has been revoked.' };
        }

        if (keyData.expiresAt && now > keyData.expiresAt) {
          return { success: false, code: 'KEY_EXPIRED', message: 'This secret key has expired.' };
        }

        if (keyData.assignedEmail && userEmail) {
          if (keyData.assignedEmail.toLowerCase() !== userEmail.toLowerCase()) {
            return { success: false, code: 'EMAIL_MISMATCH', message: 'This key was issued for a different account.' };
          }
        }

        const currentUses = Number(keyData.currentUses) || 0;
        const maxUses = Number(keyData.maxUses) || 1;

        if (currentUses >= maxUses) {
          return { success: false, code: 'ALREADY_REDEEMED', message: 'This secret key has reached maximum uses.' };
        }

        const redeemedBy = keyData.redeemedBy || [];
        if (redeemedBy.some(r => r.userId === userId)) {
          return { success: false, code: 'ALREADY_CLAIMED', message: 'You have already activated this key.' };
        }

        const newUses = currentUses + 1;
        const newStatus = newUses >= maxUses ? 'redeemed' : 'active';
        const redemptionEntry = {
          userId,
          userEmail: userEmail || '',
          redeemedAt: now
        };

        // 1. Update key document in Firestore
        transaction.update(keyRef, {
          currentUses: newUses,
          status: newStatus,
          redeemedBy: [...redeemedBy, redemptionEntry],
          lastRedeemedAt: now,
          updatedAt: now
        });

        // 2. Unlock User in Firestore therivdata collection
        transaction.set(userRef, {
          premiumStatus: true,
          isPremium: true,
          premium_source: 'secret_key',
          redeemedSecretKey: normalizedKey,
          updatedAt: now
        }, { merge: true });

        return {
          success: true,
          tier: keyData.tier || 'portfolio_premium',
          message: 'Secret key redeemed successfully. Access unlocked!'
        };
      });

      if (result.success) {
        NotificationService.sendToUser(userId, {
          title: '🎉 Secret Key Activated!',
          body: `Your account has been upgraded to ${String(result.tier).toUpperCase()} tier.`,
          data: { type: 'KEY_REDEEMED', key: normalizedKey }
        }).catch(() => {});
        logger.info(`Secret key ${normalizedKey} redeemed in Firestore for user ${userId}`);
      }

      return result;
    } catch (err) {
      logger.error('Error in redeemSecretKey Firestore transaction:', err);
      return { success: false, code: 'ERROR', message: 'Failed to redeem secret key.' };
    }
  }
}

module.exports = SecretKeyService;
