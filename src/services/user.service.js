const db = require('../config/database');
const EmailService = require('./email.service');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

class UserService {
  /**
   * Retrieves user profile from Turso Cloud SQLite.
   */
  static async getProfile(uid) {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [uid]
    });
    const user = result.rows[0];

    if (!user) {
      throw ApiError.notFound('User profile not found.');
    }

    return {
      uid: user.id,
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      isPremium: Boolean(user.is_premium),
      is_premium: Boolean(user.is_premium),
      premiumStatus: user.premium_status,
      premium_status: user.premium_status,
      premiumSource: user.premium_source,
      premiumPlan: user.premium_plan,
      premium_plan: user.premium_plan,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  }

  /**
   * Updates or creates user profile in Turso Cloud SQLite.
   */
  static async updateProfile(uid, profileData) {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const now = Date.now();
    const existingRes = await db.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [uid]
    });
    const existing = existingRes.rows[0];

    const email = profileData.email || existing?.email || null;
    const phone = profileData.phone || profileData.phoneNumber || existing?.phone || null;
    const name = profileData.name || profileData.full_name || profileData.displayName || existing?.name || '';
    const isPremium = profileData.is_premium !== undefined ? (profileData.is_premium ? 1 : 0) : (existing?.is_premium ? 1 : 0);
    const premiumStatus = profileData.premium_status || existing?.premium_status || 'inactive';
    const premiumPlan = profileData.premium_plan || existing?.premium_plan || 'free';
    const premiumSource = profileData.premium_source || existing?.premium_source || null;

    await db.execute({
      sql: `
        INSERT INTO users (id, email, phone, name, is_premium, premium_status, premium_source, premium_plan, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          email = COALESCE(excluded.email, users.email),
          phone = COALESCE(excluded.phone, users.phone),
          name = COALESCE(excluded.name, users.name),
          is_premium = excluded.is_premium,
          premium_status = excluded.premium_status,
          premium_source = COALESCE(excluded.premium_source, users.premium_source),
          premium_plan = excluded.premium_plan,
          updated_at = excluded.updated_at
      `,
      args: [uid, email, phone, name, isPremium, premiumStatus, premiumSource, premiumPlan, now]
    });

    const isVerified = profileData.isVerified || profileData.email_verified;
    if (email && isVerified) {
      logger.info(`Sending welcome email via Resend to ${email} (UID: ${uid})`);
      await EmailService.sendWelcomeEmail(email, name).catch(err => {
        logger.error(`Welcome email dispatch error: ${err.message}`);
      });
    }

    return this.getProfile(uid);
  }
}

module.exports = UserService;
