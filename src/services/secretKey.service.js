const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../utils/logger');
const NotificationService = require('./notification.service');

const KEY_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

class SecretKeyService {
  /**
   * Generate a cryptographically secure, unpredictable, random license key.
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
   * Generates and stores new secure keys in Turso.
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

    await db.execute({
      sql: `
        INSERT INTO secret_keys (key_string, tier, max_uses, current_uses, assigned_email, expires_at, notes, created_by, is_active, created_at)
        VALUES (?, ?, ?, 0, ?, ?, ?, ?, 1, ?)
      `,
      args: [rawKey, tier, Number(maxUses) || 1, cleanEmail, expiresAt, notes, createdBy, now]
    });

    logger.info(`Secure Secret Key created in Turso: ${rawKey.substring(0, 8)}... (Tier: ${tier}, MaxUses: ${maxUses})`);

    return {
      key: rawKey,
      tier,
      maxUses: Number(maxUses) || 1,
      expiresAt
    };
  }

  /**
   * Atomically verifies and redeems a secret key for a specific user in Turso.
   */
  static async verifyAndRedeemKey({ keyString, userId, userEmail }) {
    if (!keyString || !keyString.trim()) {
      return { success: false, code: 'EMPTY_KEY', message: 'Please enter a valid secret key.' };
    }

    if (!userId) {
      return { success: false, code: 'UNAUTHORIZED', message: 'User authentication is required to redeem a key.' };
    }

    const normalizedKey = this.normalizeKey(keyString);
    const now = Date.now();

    try {
      const keyRes = await db.execute({
        sql: 'SELECT * FROM secret_keys WHERE key_string = ?',
        args: [normalizedKey]
      });
      const keyRecord = keyRes.rows[0];

      if (!keyRecord) {
        return {
          success: false,
          code: 'INVALID_KEY',
          message: 'Invalid secret key. Please check and try again.'
        };
      }

      if (!keyRecord.is_active) {
        return {
          success: false,
          code: 'KEY_REVOKED',
          message: 'This key has been revoked or deactivated.'
        };
      }

      if (keyRecord.expires_at && now > Number(keyRecord.expires_at)) {
        return {
          success: false,
          code: 'KEY_EXPIRED',
          message: 'This secret key has expired.'
        };
      }

      if (keyRecord.assigned_email && userEmail) {
        if (keyRecord.assigned_email.toLowerCase() !== userEmail.toLowerCase()) {
          return {
            success: false,
            code: 'EMAIL_MISMATCH',
            message: 'This key was issued for a different account.'
          };
        }
      }

      const currentUses = Number(keyRecord.current_uses) || 0;
      const maxUses = Number(keyRecord.max_uses) || 1;

      if (currentUses >= maxUses) {
        return {
          success: false,
          code: 'ALREADY_REDEEMED',
          message: 'This secret key has reached its maximum uses.'
        };
      }

      const existingClaimRes = await db.execute({
        sql: 'SELECT * FROM secret_key_redemptions WHERE key_string = ? AND user_id = ?',
        args: [normalizedKey, userId]
      });

      if (existingClaimRes.rows.length > 0) {
        return {
          success: false,
          code: 'ALREADY_CLAIMED_BY_USER',
          message: 'You have already activated this key on your account.'
        };
      }

      // Apply redemption updates via batch
      const newUses = currentUses + 1;
      await db.batch([
        {
          sql: 'UPDATE secret_keys SET current_uses = ? WHERE key_string = ?',
          args: [newUses, normalizedKey]
        },
        {
          sql: 'INSERT INTO secret_key_redemptions (key_string, user_id, user_email, redeemed_at) VALUES (?, ?, ?, ?)',
          args: [normalizedKey, userId, userEmail || null, now]
        },
        {
          sql: `
            INSERT INTO users (id, is_premium, premium_status, premium_source, premium_plan, premium_unlocked_at, updated_at)
            VALUES (?, 1, 'active', 'secret_key', ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              is_premium = 1,
              premium_status = 'active',
              premium_source = 'secret_key',
              premium_plan = excluded.premium_plan,
              premium_unlocked_at = excluded.premium_unlocked_at,
              updated_at = excluded.updated_at
          `,
          args: [userId, keyRecord.tier || 'portfolio_premium', now, now]
        }
      ]);

      // Direct Firebase Firestore sync to therivdata
      try {
        const { admin } = require('../config/firebase');
        if (admin && admin.apps && admin.apps.length > 0) {
          await admin.firestore().collection('therivdata').doc(userId).set({
            premiumStatus: true,
            isPremium: true,
            premium_source: 'secret_key',
            redeemedSecretKey: normalizedKey,
            updatedAt: now
          }, { merge: true });
          logger.info(`Firebase Firestore therivdata secret key unlocked for user: ${userId}`);
        }
      } catch (fsErr) {
        logger.warn(`Firebase Firestore Secret Key sync note: ${fsErr.message}`);
      }

      NotificationService.sendToUser(userId, {
        title: '🎉 Secret Key Activated!',
        body: `Your account has been upgraded to ${String(keyRecord.tier).toUpperCase()} tier.`,
        data: { type: 'KEY_REDEEMED', tier: keyRecord.tier }
      }).catch(() => {});

      return {
        success: true,
        code: 'SUCCESS',
        tier: keyRecord.tier || 'portfolio_premium',
        message: 'Premium access successfully unlocked!'
      };
    } catch (error) {
      logger.error('Error during key redemption in Turso:', error);
      return {
        success: false,
        code: 'TRANSACTION_ERROR',
        message: 'An error occurred while verifying the key. Please try again.'
      };
    }
  }

  /**
   * Revoke a key.
   */
  static async revokeKey(keyString) {
    const normalizedKey = this.normalizeKey(keyString);
    const result = await db.execute({
      sql: 'UPDATE secret_keys SET is_active = 0 WHERE key_string = ?',
      args: [normalizedKey]
    });
    return { success: result.rowsAffected > 0, message: result.rowsAffected > 0 ? 'Key revoked.' : 'Key not found.' };
  }

  /**
   * Get metadata and status for a secret key.
   */
  static async getKeyStatus(keyString) {
    const normalizedKey = this.normalizeKey(keyString);
    const keyRes = await db.execute({
      sql: 'SELECT * FROM secret_keys WHERE key_string = ?',
      args: [normalizedKey]
    });
    const key = keyRes.rows[0];

    if (!key) {
      return { exists: false };
    }

    const redemptionsRes = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM secret_key_redemptions WHERE key_string = ?',
      args: [normalizedKey]
    });

    return {
      exists: true,
      key: key.key_string,
      tier: key.tier,
      isActive: Boolean(key.is_active),
      maxUses: key.max_uses,
      currentUses: key.current_uses,
      redeemedCount: redemptionsRes.rows[0]?.count || 0,
      createdAt: key.created_at,
      expiresAt: key.expires_at
    };
  }
}

module.exports = SecretKeyService;
