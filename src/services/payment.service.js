const crypto = require('crypto');
const { db, admin } = require('../config/firebase');
const config = require('../config/env');
const logger = require('../utils/logger');
const ApiError = require('../utils/apiError');

class PaymentService {
  /**
   * Generates a cryptographically secure HMAC signature for Razorpay / payment verification.
   */
  static generateSignature(orderId, paymentId, secret = config.paymentGateway.keySecret) {
    return crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  }

  /**
   * Constant-time comparison to prevent timing attack vulnerabilities.
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
   * Initiates and registers a new payment order securely on the backend.
   */
  static async createOrder({ userId, userEmail = null, plan = 'portfolio_premium', amountPaise = 1100 }) {
    if (!userId) {
      throw ApiError.badRequest('User ID is required.');
    }

    const numAmountPaise = Math.max(100, Number(amountPaise) || 1100);
    const amountInRupees = numAmountPaise / 100;
    const orderId = `order_${userId.substring(0, 8)}_${Date.now()}`;
    const keyRef = db.collection('payments').doc(orderId);

    const paymentRecord = {
      orderId,
      userId,
      userEmail,
      plan,
      amount: amountInRupees,
      amountPaise: numAmountPaise,
      currency: config.paymentGateway.currency,
      status: 'created',
      gatewayProvider: config.paymentGateway.provider,
      paymentId: null,
      signature: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedAt: null
    };

    await keyRef.set(paymentRecord);
    logger.info(`Payment order created: ${orderId} for User: ${userId} (Amount: Rs. ${amountInRupees}, Plan: ${plan})`);

    // Generate secure mock payment URL or Razorpay checkout params
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
   * Validates signature and updates user's premium entitlement atomically.
   */
  static async verifyPayment({ userId, orderId, paymentId, signature }) {
    if (!userId || !orderId) {
      throw ApiError.badRequest('User ID and Order ID are required.');
    }

    // In production with gateway signature, verify HMAC
    const isMock = config.env !== 'production' && (!signature || signature.startsWith('mock_'));
    const isSignatureValid = isMock ? true : this.verifySignature(orderId, paymentId, signature);

    if (!isSignatureValid) {
      logger.warn(`Signature verification failed for order: ${orderId}, paymentId: ${paymentId}`);
      throw ApiError.badRequest('Invalid payment signature. Payment cannot be verified.');
    }

    const assignedPaymentId = paymentId || `txn_${Date.now()}`;
    const assignedSignature = signature || this.generateSignature(orderId, assignedPaymentId);

    const result = await db.runTransaction(async (transaction) => {
      const orderRef = db.collection('payments').doc(orderId);
      const orderDoc = await transaction.get(orderRef);

      if (!orderDoc.exists) {
        throw ApiError.notFound('Payment order record not found.');
      }

      const orderData = orderDoc.data();

      // Ensure order matches the authenticated user
      if (orderData.userId !== userId) {
        throw ApiError.forbidden('Payment order does not belong to this user.');
      }

      // Check if already processed
      if (orderData.status === 'success') {
        return {
          success: true,
          isPremium: true,
          orderId,
          paymentId: orderData.paymentId,
          message: 'Payment has already been verified and processed.'
        };
      }

      // Update payment record to success
      transaction.update(orderRef, {
        status: 'success',
        paymentId: assignedPaymentId,
        signature: assignedSignature,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update user document to grant premium entitlement
      const userRef = db.collection('users').doc(userId);
      transaction.set(userRef, {
        is_premium: true,
        premium_status: 'active',
        premium_source: 'payment_gateway',
        premium_plan: orderData.plan || 'portfolio_premium',
        premium_unlocked_at: admin.firestore.FieldValue.serverTimestamp(),
        last_payment_id: assignedPaymentId,
        last_order_id: orderId
      }, { merge: true });

      // Update legacy tables for sync
      const therivRef = db.collection('therivdata').doc(userId);
      const therivavaRef = db.collection('therivavadata').doc(userId);
      transaction.set(therivRef, { premiumStatus: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(therivavaRef, { premiumStatus: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

      return {
        success: true,
        isPremium: true,
        orderId,
        paymentId: assignedPaymentId,
        plan: orderData.plan || 'portfolio_premium',
        message: 'Payment verified successfully. Premium access unlocked!'
      };
    });

    logger.info(`Payment verified and premium unlocked for user: ${userId}, order: ${orderId}`);
    return result;
  }

  /**
   * Webhook event processor for asynchronous payment notifications from gateway.
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
    logger.info(`Payment gateway webhook received: ${event}`);

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = eventPayload.payload?.payment?.entity || eventPayload.payment;
      const orderId = paymentEntity?.order_id || eventPayload.order_id;
      const paymentId = paymentEntity?.id || eventPayload.payment_id;
      const userId = paymentEntity?.notes?.userId || eventPayload.userId;

      if (orderId && userId) {
        const orderRef = db.collection('payments').doc(orderId);
        const orderDoc = await orderRef.get();

        if (orderDoc.exists && orderDoc.data().status !== 'success') {
          await orderRef.update({
            status: 'success',
            paymentId: paymentId || `webhook_${Date.now()}`,
            verifiedVia: 'webhook',
            verifiedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          await db.collection('users').doc(userId).set({
            is_premium: true,
            premium_status: 'active',
            premium_source: 'payment_webhook',
            premium_unlocked_at: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          await db.collection('therivdata').doc(userId).set({ premiumStatus: true }, { merge: true });
          await db.collection('therivavadata').doc(userId).set({ premiumStatus: true }, { merge: true });
          logger.info(`Webhook successfully processed and unlocked premium for user: ${userId}`);
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
    const snapshot = await db.collection('payments')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}

module.exports = PaymentService;
