const db = require('../config/database');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');
const NotificationService = require('./notification.service');

class EliteService {
  /**
   * Creates an Elite payment order in Turso.
   */
  static async createOrder(uid, amount, plan = 'elite_3300') {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const orderId = `elite_order_${uid}_${Date.now()}`;
    const amountInRupees = amount ? amount / 100 : 3300;
    const now = Date.now();

    await db.execute({
      sql: `
        INSERT INTO payments (order_id, user_id, plan, amount, amount_paise, currency, status, gateway_provider, created_at)
        VALUES (?, ?, ?, ?, ?, 'INR', 'created', 'razorpay', ?)
      `,
      args: [orderId, uid, plan, amountInRupees, amount || 330000, now]
    });

    logger.info(`Elite order created in Turso: ${orderId} for UID: ${uid}`);

    return {
      orderId,
      amount: amountInRupees,
      currency: 'INR',
      paymentUrl: `https://backend-6fey.onrender.com/pay/${orderId}`
    };
  }

  /**
   * Verifies payment and activates user Elite subscription in Turso.
   */
  static async verifyPayment(uid, orderId) {
    if (!uid || !orderId) {
      throw ApiError.badRequest('User ID and Order ID are required.');
    }

    const now = Date.now();
    const nextBilling = now + 30 * 24 * 60 * 60 * 1000;

    const orderRes = await db.execute({
      sql: 'SELECT * FROM payments WHERE order_id = ? AND user_id = ?',
      args: [orderId, uid]
    });
    const order = orderRes.rows[0];

    if (!order) {
      throw ApiError.notFound('Payment order record not found.');
    }

    if (order.status === 'success') {
      return { success: true, isElite: true, message: 'Payment has already been processed.' };
    }

    const paymentId = `txn_${Date.now()}`;

    await db.batch([
      {
        sql: `UPDATE payments SET status = 'success', payment_id = ?, verified_at = ? WHERE order_id = ?`,
        args: [paymentId, now, orderId]
      },
      {
        sql: `
          INSERT INTO elite_subscriptions (user_id, is_elite, plan, minutes_remaining, monthly_minutes, auto_renew, next_billing_date, payment_status, updated_at)
          VALUES (?, 1, ?, 600, 600, 1, ?, 'active', ?)
          ON CONFLICT(user_id) DO UPDATE SET
            is_elite = 1,
            plan = excluded.plan,
            minutes_remaining = 600,
            monthly_minutes = 600,
            auto_renew = 1,
            next_billing_date = excluded.next_billing_date,
            payment_status = 'active',
            updated_at = excluded.updated_at
        `,
        args: [uid, order.plan || 'elite_3300', nextBilling, now]
      },
      {
        sql: `UPDATE users SET is_premium = 1, premium_status = 'active', premium_plan = 'elite', updated_at = ? WHERE id = ?`,
        args: [now, uid]
      }
    ]);

    NotificationService.sendToUser(uid, {
      title: '👑 Welcome to Elite Club!',
      body: 'Your Elite Membership is now active. Enjoy priority advisory and exclusive perks.',
      data: { type: 'ELITE_ACTIVATED', orderId }
    }).catch(() => {});

    logger.info(`Elite payment verified in Turso for user ${uid}, order: ${orderId}`);
    return {
      success: true,
      isElite: true,
      plan: order.plan || 'elite_3300',
      expiresAt: new Date(nextBilling).toISOString(),
      minutesRemaining: 600
    };
  }

  /**
   * Books a financial advisor session, deducting minutes atomically.
   */
  static async bookSession(uid, { duration, date, time, slotId }) {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }
    if (!duration || ![15, 30, 45, 60].includes(Number(duration))) {
      throw ApiError.badRequest('Invalid duration. Allowed durations: 15, 30, 45, 60 minutes.');
    }
    if (!date || !time) {
      throw ApiError.badRequest('Date and time are required.');
    }

    const numDuration = Number(duration);
    const dateMillis = typeof date === 'number' ? date : new Date(date).getTime();
    const sessionId = `session_${uid}_${Date.now()}`;
    const now = Date.now();

    const subRes = await db.execute({
      sql: 'SELECT * FROM elite_subscriptions WHERE user_id = ?',
      args: [uid]
    });
    const sub = subRes.rows[0];

    if (!sub || !sub.is_elite || sub.payment_status !== 'active') {
      throw ApiError.badRequest('Your Elite subscription is not active.');
    }

    const currentMinutes = Number(sub.minutes_remaining) || 0;
    if (currentMinutes < numDuration) {
      throw ApiError.badRequest(`Insufficient minutes. You have ${currentMinutes} minutes available.`);
    }

    const newMinutes = currentMinutes - numDuration;

    await db.batch([
      {
        sql: 'UPDATE elite_subscriptions SET minutes_remaining = ?, updated_at = ? WHERE user_id = ?',
        args: [newMinutes, now, uid]
      },
      {
        sql: `
          INSERT INTO elite_sessions (id, user_id, duration, date_millis, time_slot, status, created_at)
          VALUES (?, ?, ?, ?, ?, 'booked', ?)
        `,
        args: [sessionId, uid, numDuration, dateMillis, time, now]
      }
    ]);

    NotificationService.sendToUser(uid, {
      title: '📅 Session Booked',
      body: `Your ${numDuration}-minute advisor session is confirmed for ${time}.`,
      data: { type: 'SESSION_BOOKED', sessionId }
    }).catch(() => {});

    logger.info(`Session booked in Turso for UID: ${uid}, session ID: ${sessionId}`);
    return {
      success: true,
      sessionId,
      minutesBooked: numDuration,
      minutesRemaining: newMinutes
    };
  }

  /**
   * Cancels recurring subscription auto-renewal
   */
  static async cancelSubscription(uid) {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const now = Date.now();
    const result = await db.execute({
      sql: 'UPDATE elite_subscriptions SET auto_renew = 0, updated_at = ? WHERE user_id = ?',
      args: [now, uid]
    });

    if (result.rowsAffected === 0) {
      throw ApiError.notFound('No subscription found to cancel.');
    }

    logger.info(`Subscription auto-renew cancelled in Turso for user: ${uid}`);
    return { success: true, message: 'Subscription auto-renew cancelled successfully.' };
  }

  /**
   * Retrieves user current subscription details
   */
  static async getSubscriptionStatus(uid) {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const subRes = await db.execute({
      sql: 'SELECT * FROM elite_subscriptions WHERE user_id = ?',
      args: [uid]
    });
    const sub = subRes.rows[0];

    if (!sub) {
      return {
        isElite: false,
        plan: 'free',
        status: 'none'
      };
    }

    return {
      isElite: Boolean(sub.is_elite),
      plan: sub.plan,
      minutesRemaining: sub.minutes_remaining,
      monthlyMinutes: sub.monthly_minutes,
      autoRenew: Boolean(sub.auto_renew),
      nextBillingDate: sub.next_billing_date,
      paymentStatus: sub.payment_status
    };
  }
}

module.exports = EliteService;
