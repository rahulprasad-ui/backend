const crypto = require('crypto');
const { admin } = require('../config/firebase');
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
   * Initiates and registers a new payment order securely in Firebase Firestore.
   */
  static async createOrder({ userId, userEmail = null, plan = 'portfolio_premium', amountPaise = 1100 }) {
    if (!userId) {
      throw ApiError.badRequest('User ID is required.');
    }

    const numAmountPaise = Math.max(100, Number(amountPaise) || 1100);
    const amountInRupees = numAmountPaise / 100;
    const orderId = `order_${userId.substring(0, 8)}_${Date.now()}`;
    const now = Date.now();

    const orderData = {
      orderId,
      userId,
      userEmail,
      plan,
      amount: amountInRupees,
      amountPaise: numAmountPaise,
      currency: config.paymentGateway.currency,
      status: 'created',
      gatewayProvider: 'razorpay',
      createdAt: now,
      updatedAt: now
    };

    try {
      await admin.firestore().collection('payments').doc(orderId).set(orderData);
      logger.info(`Payment order created in Firestore: ${orderId} (Amount: Rs. ${amountInRupees}, Plan: ${plan})`);
    } catch (fsErr) {
      logger.warn(`Firestore payment order creation note: ${fsErr.message}`);
    }

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
   * Server-Side Payment Verification in Firebase Firestore.
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

    const orderDoc = await admin.firestore().collection('payments').doc(orderId).get();
    const order = orderDoc.exists ? orderDoc.data() : { userId, plan: 'portfolio_premium' };

    if (orderDoc.exists && order.userId && order.userId !== userId) {
      throw ApiError.forbidden('Payment order does not belong to this user.');
    }

    if (order.status === 'success') {
      return {
        success: true,
        isPremium: true,
        orderId,
        paymentId: order.paymentId || assignedPaymentId,
        message: 'Payment has already been verified and processed.'
      };
    }

    // 1. Update Payment record in Firestore
    await admin.firestore().collection('payments').doc(orderId).set({
      status: 'success',
      paymentId: assignedPaymentId,
      signature: assignedSignature,
      verifiedAt: now,
      updatedAt: now
    }, { merge: true });

    // 2. Unlock User in Firestore (therivdata collection)
    const isElitePlan = order.plan && order.plan.includes('elite');
    await admin.firestore().collection('therivdata').doc(userId).set({
      premiumStatus: true,
      isPremium: true,
      premium_source: 'payment_gateway',
      isElite: isElitePlan ? true : undefined,
      tier: isElitePlan ? 'elite' : undefined,
      elite_plan: isElitePlan ? (order.plan || 'elite_399') : undefined,
      monthlyMinutes: isElitePlan ? 600 : undefined,
      lastPaymentOrderId: orderId,
      lastPaymentAt: now,
      updatedAt: now
    }, { merge: true });

    NotificationService.sendToUser(userId, {
      title: '🎉 Premium Unlocked!',
      body: 'Your payment was successful. Enjoy full access to Rivava TrackFi features.',
      data: { type: 'PREMIUM_UNLOCKED', orderId }
    }).catch(() => {});

    logger.info(`Payment verified and premium unlocked in Firebase Firestore for user: ${userId}, order: ${orderId}`);
    return {
      success: true,
      isPremium: true,
      orderId,
      paymentId: assignedPaymentId,
      plan: order.plan || 'portfolio_premium',
      message: 'Payment verified successfully. Premium access unlocked in Firebase!'
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
    logger.info(`Processing Razorpay webhook event: ${event}`);

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = eventPayload.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id || eventPayload.payload?.order?.entity?.id;
      const paymentId = paymentEntity?.id;
      const notes = paymentEntity?.notes || {};
      const userId = notes.userId || notes.user_id;

      if (userId && orderId) {
        await this.verifyPayment({
          userId,
          orderId,
          paymentId,
          signature: 'webhook_verified'
        });
        logger.info(`Webhook successfully verified and activated access for ${userId}`);
      }
    }

    return { received: true };
  }
}

module.exports = PaymentService;
