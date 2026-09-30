const crypto = require('crypto');
const { db, admin } = require('../config/firebase');
const logger = require('../utils/logger');

// Charset without ambiguous characters (no 0, O, 1, I, L)
const KEY_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

class SecretKeyService {
  /**
   * Generate a cryptographically secure, unpredictable, random license key.
   * Format: RIV-XXXX-XXXX-XXXX-XXXX (e.g. RIV-9K7X-W3P8-2A4M-7Q6L)
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
   * Normalizes a user-input key (removes extra spaces, converts to uppercase).
   */
  static normalizeKey(keyString) {
    if (!keyString) return '';
    return keyString.trim().toUpperCase().replace(/[\s_]/g, '-');
  }

  /**
   * Generates and stores new secure keys in Firestore.
   */
  static async createSecretKey({
    tier = 'portfolio_premium', // 'portfolio_premium' | 'elite_pro' | 'lifetime'
    maxUses = 1,
    prefix = 'RIV',
    assignedEmail = null,
    expiresInDays = null,
    notes = '',
    createdBy = 'system_admin'
  } = {}) {
    const rawKey = this.generateRandomKeyString(prefix);
    const keyId = crypto.createHash('sha256').update(rawKey).digest('hex');

    const keyData = {
      key: rawKey,
      keyId,
      tier,
      maxUses: Number(maxUses) || 1,
      useCount: 0,
      status: 'active', // 'active' | 'redeemed' | 'revoked' | 'expired'
      isRevoked: false,
      revokedReason: null,
      assignedEmail: assignedEmail ? assignedEmail.toLowerCase().trim() : null,
      redeemedBy: [],
      notes,
      createdBy,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null
    };

    await db.collection('secret_keys').doc(keyId).set(keyData);
    logger.info(`Secure Secret Key created: ${rawKey.substring(0, 8)}... (Tier: ${tier}, MaxUses: ${maxUses})`);

    return {
      key: rawKey,
      keyId,
      tier,
      maxUses: keyData.maxUses,
      status: keyData.status,
      expiresAt: keyData.expiresAt
    };
  }

  /**
   * Atomically verifies and redeems a secret key for a specific user.
   */
  static async verifyAndRedeemKey({ keyString, userId, userEmail }) {
    if (!keyString || !keyString.trim()) {
      return { success: false, code: 'EMPTY_KEY', message: 'Please enter a valid secret key.' };
    }

    if (!userId) {
      return { success: false, code: 'UNAUTHORIZED', message: 'User authentication is required to redeem a key.' };
    }

    const normalizedKey = this.normalizeKey(keyString);
    const keyId = crypto.createHash('sha256').update(normalizedKey).digest('hex');
    const keyRef = db.collection('secret_keys').doc(keyId);

    try {
      const result = await db.runTransaction(async (transaction) => {
        const keyDoc = await transaction.get(keyRef);

        if (!keyDoc.exists) {
          return {
            success: false,
            code: 'INVALID_KEY',
            message: 'Invalid secret key. Please check and try again.'
          };
        }

        const data = keyDoc.data();

        // Check if revoked
        if (data.isRevoked || data.status === 'revoked') {
          return {
            success: false,
            code: 'KEY_REVOKED',
            message: data.revokedReason ? `Key revoked: ${data.revokedReason}` : 'This key has been revoked by an administrator.'
          };
        }

        // Check expiry
        if (data.expiresAt) {
          const expiryDate = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
          if (new Date() > expiryDate) {
            transaction.update(keyRef, { status: 'expired' });
            return {
              success: false,
              code: 'KEY_EXPIRED',
              message: 'This secret key has expired.'
            };
          }
        }

        // Check email assignment if restricted
        if (data.assignedEmail && userEmail) {
          if (data.assignedEmail.toLowerCase() !== userEmail.toLowerCase()) {
            return {
              success: false,
              code: 'EMAIL_MISMATCH',
              message: 'This key was issued for a different account.'
            };
          }
        }

        // Check redemption count
        const currentUses = data.useCount || 0;
        const maxUses = data.maxUses || 1;

        if (currentUses >= maxUses || data.status === 'redeemed') {
          return {
            success: false,
            code: 'ALREADY_REDEEMED',
            message: 'This secret key has already been redeemed and reached maximum uses.'
          };
        }

        // Check if this specific user already redeemed this key
        const redeemedList = data.redeemedBy || [];
        const alreadyRedeemedByUser = redeemedList.some(r => r.userId === userId);
        if (alreadyRedeemedByUser) {
          return {
            success: false,
            code: 'ALREADY_CLAIMED_BY_USER',
            message: 'You have already activated this key on your account.'
          };
        }

        // Key is valid - apply redemption updates
        const newUseCount = currentUses + 1;
        const newStatus = newUseCount >= maxUses ? 'redeemed' : 'active';
        const redemptionEntry = {
          userId,
          userEmail: userEmail || null,
          redeemedAt: new Date().toISOString()
        };

        transaction.update(keyRef, {
          useCount: newUseCount,
          status: newStatus,
          redeemedBy: admin.firestore.FieldValue.arrayUnion(redemptionEntry),
          lastRedeemedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update User Entitlements in Firestore
        const userRef = db.collection('users').doc(userId);
        transaction.set(userRef, {
          is_premium: true,
          premium_status: 'active',
          premium_source: 'secret_key',
          premium_tier: data.tier || 'portfolio_premium',
          premium_unlocked_at: admin.firestore.FieldValue.serverTimestamp(),
          unlocked_key_id: keyId
        }, { merge: true });

        // Update legacy collections for backward compatibility
        const therivRef = db.collection('therivdata').doc(userId);
        const therivavaRef = db.collection('therivavadata').doc(userId);
        transaction.set(therivRef, { premiumStatus: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        transaction.set(therivavaRef, { premiumStatus: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

        return {
          success: true,
          code: 'SUCCESS',
          tier: data.tier || 'portfolio_premium',
          message: 'Premium access successfully unlocked!'
        };
      });

      return result;
    } catch (error) {
      logger.error('Error during key redemption transaction:', error);
      return {
        success: false,
        code: 'TRANSACTION_ERROR',
        message: 'An error occurred while verifying the key. Please try again.'
      };
    }
  }

  /**
   * Revoke a key or revoke a user's entitlement.
   */
  static async revokeKey(keyString, reason = 'Administrative revocation') {
    const normalizedKey = this.normalizeKey(keyString);
    const keyId = crypto.createHash('sha256').update(normalizedKey).digest('hex');
    const keyRef = db.collection('secret_keys').doc(keyId);

    const doc = await keyRef.get();
    if (!doc.exists) {
      return { success: false, message: 'Key not found.' };
    }

    const data = doc.data();
    await keyRef.update({
      isRevoked: true,
      status: 'revoked',
      revokedReason: reason,
      revokedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Optionally revoke for users who redeemed it
    const users = data.redeemedBy || [];
    for (const u of users) {
      if (u.userId) {
        await db.collection('users').doc(u.userId).set({
          is_premium: false,
          premium_status: 'revoked',
          premium_revoked_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await db.collection('therivdata').doc(u.userId).set({ premiumStatus: false }, { merge: true });
        await db.collection('therivavadata').doc(u.userId).set({ premiumStatus: false }, { merge: true });
      }
    }

    logger.warn(`Secret key revoked: ${keyId} (Reason: ${reason})`);
    return { success: true, message: `Key successfully revoked. ${users.length} user(s) updated.` };
  }

  /**
   * Get metadata and status for a secret key.
   */
  static async getKeyStatus(keyString) {
    const normalizedKey = this.normalizeKey(keyString);
    const keyId = crypto.createHash('sha256').update(normalizedKey).digest('hex');
    const doc = await db.collection('secret_keys').doc(keyId).get();

    if (!doc.exists) {
      return { exists: false };
    }

    const data = doc.data();
    return {
      exists: true,
      keyId,
      tier: data.tier,
      status: data.status,
      isRevoked: data.isRevoked,
      maxUses: data.maxUses,
      useCount: data.useCount,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
      redeemedCount: (data.redeemedBy || []).length
    };
  }
}

module.exports = SecretKeyService;
