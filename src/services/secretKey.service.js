const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../utils/logger');
const NotificationService = require('./notification.service');

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
   * Generates and stores new secure keys in SQLite.
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

    const stmt = db.prepare(`
      INSERT INTO secret_keys (key_string, tier, max_uses, current_uses, assigned_email, expires_at, notes, created_by, is_active, created_at)
      VALUES (?, ?, ?, 0, ?, ?, ?, ?, 1, ?)
    `);
    stmt.run(rawKey, tier, Number(maxUses) || 1, cleanEmail, expiresAt, notes, createdBy, now);

    logger.info(`Secure Secret Key created in SQLite: ${rawKey.substring(0, 8)}... (Tier: ${tier}, MaxUses: ${maxUses})`);

    return {
      key: rawKey,
      tier,
      maxUses: Number(maxUses) || 1,
      expiresAt
    };
  }

  /**
   * Atomically verifies and redeems a secret key for a specific user in SQLite.
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
      const redeemTx = db.transaction(() => {
        const keyRecord = db.prepare(`SELECT * FROM secret_keys WHERE key_string = ?`).get(normalizedKey);

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

        if (keyRecord.expires_at && now > keyRecord.expires_at) {
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

        if (keyRecord.current_uses >= keyRecord.max_uses) {
          return {
            success: false,
            code: 'ALREADY_REDEEMED',
            message: 'This secret key has reached its maximum uses.'
          };
        }

        const existingClaim = db.prepare(`
          SELECT * FROM secret_key_redemptions WHERE key_string = ? AND user_id = ?
        `).get(normalizedKey, userId);

        if (existingClaim) {
          return {
            success: false,
            code: 'ALREADY_CLAIMED_BY_USER',
            message: 'You have already activated this key on your account.'
          };
        }

        // Apply redemption
        const newUses = keyRecord.current_uses + 1;
        db.prepare(`UPDATE secret_keys SET current_uses = ? WHERE key_string = ?`).run(newUses, normalizedKey);

        db.prepare(`
          INSERT INTO secret_key_redemptions (key_string, user_id, user_email, redeemed_at)
          VALUES (?, ?, ?, ?)
        `).run(normalizedKey, userId, userEmail || null, now);

        // Update User Entitlement in SQLite
        db.prepare(`
          INSERT INTO users (id, is_premium, premium_status, premium_source, premium_plan, premium_unlocked_at, updated_at)
          VALUES (?, 1, 'active', 'secret_key', ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            is_premium = 1,
            premium_status = 'active',
            premium_source = 'secret_key',
            premium_plan = excluded.premium_plan,
            premium_unlocked_at = excluded.premium_unlocked_at,
            updated_at = excluded.updated_at
        `).run(userId, keyRecord.tier || 'portfolio_premium', now, now);

        return {
          success: true,
          code: 'SUCCESS',
          tier: keyRecord.tier || 'portfolio_premium',
          message: 'Premium access successfully unlocked!'
        };
      });

      const result = redeemTx();

      if (result.success) {
        NotificationService.sendToUser(userId, {
          title: '🎉 Secret Key Activated!',
          body: `Your account has been upgraded to ${result.tier.toUpperCase()} tier.`,
          data: { type: 'KEY_REDEEMED', tier: result.tier }
        }).catch(() => {});
      }

      return result;
    } catch (error) {
      logger.error('Error during key redemption in SQLite:', error);
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
  static async revokeKey(keyString) {
    const normalizedKey = this.normalizeKey(keyString);
    const result = db.prepare(`UPDATE secret_keys SET is_active = 0 WHERE key_string = ?`).run(normalizedKey);
    return { success: result.changes > 0, message: result.changes > 0 ? 'Key revoked.' : 'Key not found.' };
  }

  /**
   * Get metadata and status for a secret key.
   */
  static async getKeyStatus(keyString) {
    const normalizedKey = this.normalizeKey(keyString);
    const key = db.prepare(`SELECT * FROM secret_keys WHERE key_string = ?`).get(normalizedKey);

    if (!key) {
      return { exists: false };
    }

    const redemptions = db.prepare(`SELECT COUNT(*) as count FROM secret_key_redemptions WHERE key_string = ?`).get(normalizedKey);

    return {
      exists: true,
      key: key.key_string,
      tier: key.tier,
      isActive: Boolean(key.is_active),
      maxUses: key.max_uses,
      currentUses: key.current_uses,
      redeemedCount: redemptions?.count || 0,
      createdAt: key.created_at,
      expiresAt: key.expires_at
    };
  }
}

module.exports = SecretKeyService;
