const crypto = require('crypto');
const db = require('../config/database');
const config = require('../config/env');
const logger = require('../utils/logger');
const ApiError = require('../utils/apiError');
const NotificationService = require('./notification.service');

class PaymentService {
  /**
   * Generates a cryptographically secure HMAC signature for Razorpay verification.
   */
  static generateSignature(orderId, paymentId, secret = config.paymentGateway.keySecret) {
    return crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  }

  /**
   * Constant-time comparison to prevent timing attacks.
   */
  static verifySignature(orderId, paymentId, signature, secret = config.paymentGateway.keySecret) {
    if (!orderId || !paymentId || !signature) return false;
    try {
      const generated = this.generateSignature(orderId, paymentId, secret);
      const generatedBuffer = Buffer.from(generated, 'utf8');
      const signatureBuffer = Buffer.from(signature, 'utf8');

      if (generatedBuffer.length !== signatureBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(generatedBuffer, signatureBuffer);
    } catch (e) {
      logger.error('Signature comparison error:', e);
      return false;
    }
  }

  /**
   * Initiates and registers a new payment order securely in SQLite.
   */
  static async createOrder({ userId, userEmail = null, plan = 'portfolio_premium', amountPaise = 1100 }) {
    if (!userId) {
      throw ApiError.badRequest('User ID is required.');
    }

    const numAmountPaise = Math.max(100, Number(amountPaise) || 1100);
    const amountInRupees = numAmountPaise / 100;
    const orderId = `order_${userId.substring(0, 8)}_${Date.now()}`;
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO payments (order_id, user_id, user_email, plan, amount, amount_paise, currency, status, gateway_provider, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'created', 'razorpay', ?)
    `);
    stmt.run(orderId, userId, userEmail, plan, amountInRupees, numAmountPaise, config.paymentGateway.currency, now);

    logger.info(`Payment order created: ${orderId} in SQLite (Amount: Rs. ${amountInRupees}, Plan: ${plan})`);

    const paymentUrl = `${config.baseUrl}/pay/${orderId}`;

    return {
      orderId,
      amount: amountInRupees,
      amountPaise: numAmountPaise,
      currency: config.paymentGateway.currency,
      keyId: config.paymentGateway.keyId,
      paymentUrl,
      plan,
      notes: {
        userId,
        plan
      }
    };
  }

  /**
   * Server-Side Payment Verification:
   * Validates signature and updates user's premium entitlement in SQLite atomically.
   */
  static async verifyPayment({ userId, orderId, paymentId, signature }) {
    if (!userId || !orderId) {
      throw ApiError.badRequest('User ID and Order ID are required.');
    }

    const isMock = config.env !== 'production' && (!signature || signature.startsWith('mock_'));
    const isSignatureValid = isMock ? true : this.verifySignature(orderId, paymentId, signature);

    if (!isSignatureValid) {
      logger.warn(`Signature verification failed for order: ${orderId}, paymentId: ${paymentId}`);
      throw ApiError.badRequest('Invalid payment signature. Payment cannot be verified.');
    }

    const assignedPaymentId = paymentId || `txn_${Date.now()}`;
    const assignedSignature = signature || this.generateSignature(orderId, assignedPaymentId);
    const now = Date.now();

    const verifyTransaction = db.transaction(() => {
      const order = db.prepare(`SELECT * FROM payments WHERE order_id = ?`).get(orderId);

      if (!order) {
        throw ApiError.notFound('Payment order record not found.');
      }

      if (order.user_id !== userId) {
        throw ApiError.forbidden('Payment order does not belong to this user.');
      }

      if (order.status === 'success') {
        return {
          success: true,
          isPremium: true,
          orderId,
          paymentId: order.payment_id,
          message: 'Payment has already been verified and processed.'
        };
      }

      // Update payment record
      db.prepare(`
        UPDATE payments
        SET status = 'success', payment_id = ?, signature = ?, verified_at = ?
        WHERE order_id = ?
      `).run(assignedPaymentId, assignedSignature, now, orderId);

      // Update user premium status in SQLite
      db.prepare(`
        INSERT INTO users (id, is_premium, premium_status, premium_source, premium_plan, premium_unlocked_at, updated_at)
        VALUES (?, 1, 'active', 'payment_gateway', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          is_premium = 1,
          premium_status = 'active',
          premium_source = 'payment_gateway',
          premium_plan = excluded.premium_plan,
          premium_unlocked_at = excluded.premium_unlocked_at,
          updated_at = excluded.updated_at
      `).run(userId, order.plan || 'portfolio_premium', now, now);

      return {
        success: true,
        isPremium: true,
        orderId,
        paymentId: assignedPaymentId,
        plan: order.plan || 'portfolio_premium',
        message: 'Payment verified successfully. Premium access unlocked!'
      };
    });

    const result = verifyTransaction();

    // Send FCM Push Notification via Firebase
    NotificationService.sendToUser(userId, {
      title: '🎉 Premium Unlocked!',
      body: 'Your payment was successful. Enjoy full access to Rivava TrackFi features.',
      data: { type: 'PREMIUM_UNLOCKED', orderId }
    }).catch(err => logger.warn(`FCM notification error: ${err.message}`));

    logger.info(`Payment verified and premium unlocked in SQLite for user: ${userId}, order: ${orderId}`);
    return result;
  }

  /**
   * Webhook event processor for asynchronous Razorpay webhook notifications.
   */
  static async processWebhook({ rawBody, signatureHeader, eventPayload }) {
    if (signatureHeader && config.paymentGateway.webhookSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', config.paymentGateway.webhookSecret)
        .update(rawBody || JSON.stringify(eventPayload))
        .digest('hex');

      const isMatch = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf8'),
        Buffer.from(signatureHeader, 'utf8')
      );

      if (!isMatch) {
        logger.warn('Webhook signature mismatch rejected.');
        throw ApiError.unauthorized('Invalid webhook signature.');
      }
    }

    const event = eventPayload.event;
    logger.info(`Razorpay webhook received: ${event}`);

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = eventPayload.payload?.payment?.entity || eventPayload.payment;
      const orderId = paymentEntity?.order_id || eventPayload.order_id;
      const paymentId = paymentEntity?.id || eventPayload.payment_id;
      const userId = paymentEntity?.notes?.userId || eventPayload.userId;

      if (orderId && userId) {
        const now = Date.now();
        const order = db.prepare(`SELECT * FROM payments WHERE order_id = ?`).get(orderId);

        if (order && order.status !== 'success') {
          db.prepare(`
            UPDATE payments SET status = 'success', payment_id = ?, verified_at = ? WHERE order_id = ?
          `).run(paymentId || `webhook_${now}`, now, orderId);

          db.prepare(`
            INSERT INTO users (id, is_premium, premium_status, premium_source, premium_unlocked_at, updated_at)
            VALUES (?, 1, 'active', 'payment_webhook', ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              is_premium = 1,
              premium_status = 'active',
              premium_source = 'payment_webhook',
              premium_unlocked_at = excluded.premium_unlocked_at,
              updated_at = excluded.updated_at
          `).run(userId, now, now);

          NotificationService.sendToUser(userId, {
            title: '🎉 Premium Activated!',
            body: 'Your payment was processed successfully.',
            data: { type: 'PREMIUM_ACTIVATED', orderId }
          }).catch(() => {});

          logger.info(`Webhook successfully processed in SQLite for user: ${userId}`);
        }
      }
    }

    return { received: true, event };
  }

  /**
   * Retrieves payment records for a user.
   */
  static async getPaymentsByUser(userId) {
    if (!userId) throw ApiError.badRequest('User ID is required.');
    return db.prepare(`
      SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
    `).all(userId);
  }
}

module.exports = PaymentService;
