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
   * Initiates and registers a new payment order securely in Turso.
   */
  static async createOrder({ userId, userEmail = null, plan = 'portfolio_premium', amountPaise = 1100 }) {
    if (!userId) {
      throw ApiError.badRequest('User ID is required.');
    }

    const numAmountPaise = Math.max(100, Number(amountPaise) || 1100);
    const amountInRupees = numAmountPaise / 100;
    const orderId = `order_${userId.substring(0, 8)}_${Date.now()}`;
    const now = Date.now();

    await db.execute({
      sql: `
        INSERT INTO payments (order_id, user_id, user_email, plan, amount, amount_paise, currency, status, gateway_provider, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'created', 'razorpay', ?)
      `,
      args: [orderId, userId, userEmail, plan, amountInRupees, numAmountPaise, config.paymentGateway.currency, now]
    });

    logger.info(`Payment order created: ${orderId} in Turso Cloud SQLite (Amount: Rs. ${amountInRupees}, Plan: ${plan})`);

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
   * Server-Side Payment Verification in Turso Cloud SQLite.
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

    const orderRes = await db.execute({
      sql: 'SELECT * FROM payments WHERE order_id = ?',
      args: [orderId]
    });
    const order = orderRes.rows[0];

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

    // Update payment record & user in Turso batch
    await db.batch([
      {
        sql: `UPDATE payments SET status = 'success', payment_id = ?, signature = ?, verified_at = ? WHERE order_id = ?`,
        args: [assignedPaymentId, assignedSignature, now, orderId]
      },
      {
        sql: `
          INSERT INTO users (id, is_premium, premium_status, premium_source, premium_plan, premium_unlocked_at, updated_at)
          VALUES (?, 1, 'active', 'payment_gateway', ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            is_premium = 1,
            premium_status = 'active',
            premium_source = 'payment_gateway',
            premium_plan = excluded.premium_plan,
            premium_unlocked_at = excluded.premium_unlocked_at,
            updated_at = excluded.updated_at
        `,
        args: [userId, order.plan || 'portfolio_premium', now, now]
      }
    ]);

    // Direct Firebase Firestore sync to therivdata
    try {
      const { admin } = require('../config/firebase');
      if (admin && admin.apps && admin.apps.length > 0) {
        await admin.firestore().collection('therivdata').doc(userId).set({
          premiumStatus: true,
          isPremium: true,
          isElite: (order.plan && order.plan.includes('elite')) ? true : undefined,
          tier: (order.plan && order.plan.includes('elite')) ? 'elite' : undefined,
          premium_source: 'payment_gateway',
          lastPaymentOrderId: orderId,
          lastPaymentAt: now,
          updatedAt: now
        }, { merge: true });
        logger.info(`Firebase Firestore therivdata updated for user: ${userId}`);
      }
    } catch (fsErr) {
      logger.warn(`Firebase Firestore sync note: ${fsErr.message}`);
    }

    NotificationService.sendToUser(userId, {
      title: '🎉 Premium Unlocked!',
      body: 'Your payment was successful. Enjoy full access to Rivava TrackFi features.',
      data: { type: 'PREMIUM_UNLOCKED', orderId }
    }).catch(() => {});

    logger.info(`Payment verified and premium unlocked in Turso for user: ${userId}, order: ${orderId}`);
    return {
      success: true,
      isPremium: true,
      orderId,
      paymentId: assignedPaymentId,
      plan: order.plan || 'portfolio_premium',
      message: 'Payment verified successfully. Premium access unlocked!'
    };
  }

  /**
   * Webhook event processor for Razorpay.
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
        const orderRes = await db.execute({
          sql: 'SELECT * FROM payments WHERE order_id = ?',
          args: [orderId]
        });
        const order = orderRes.rows[0];

        if (order && order.status !== 'success') {
          await db.batch([
            {
              sql: `UPDATE payments SET status = 'success', payment_id = ?, verified_at = ? WHERE order_id = ?`,
              args: [paymentId || `webhook_${now}`, now, orderId]
            },
            {
              sql: `
                INSERT INTO users (id, is_premium, premium_status, premium_source, premium_unlocked_at, updated_at)
                VALUES (?, 1, 'active', 'payment_webhook', ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  is_premium = 1,
                  premium_status = 'active',
                  premium_source = 'payment_webhook',
                  premium_unlocked_at = excluded.premium_unlocked_at,
                  updated_at = excluded.updated_at
              `,
              args: [userId, now, now]
            }
          ]);

          NotificationService.sendToUser(userId, {
            title: '🎉 Premium Activated!',
            body: 'Your payment was processed successfully.',
            data: { type: 'PREMIUM_ACTIVATED', orderId }
          }).catch(() => {});

          logger.info(`Webhook successfully processed in Turso for user: ${userId}`);
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
    const result = await db.execute({
      sql: 'SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      args: [userId]
    });
    return result.rows;
  }
}

module.exports = PaymentService;
