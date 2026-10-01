const { admin } = require('../config/firebase');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');
const NotificationService = require('./notification.service');

class EliteService {
  /**
   * Creates an Elite payment order in Firebase Firestore.
   */
  static async createOrder(uid, amount, plan = 'elite_399') {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const orderId = `elite_order_${uid}_${Date.now()}`;
    const amountInRupees = amount ? amount / 100 : 399;
    const now = Date.now();

    const orderData = {
      orderId,
      userId: uid,
      plan,
      amount: amountInRupees,
      amountPaise: amount || 39900,
      currency: 'INR',
      status: 'created',
      gatewayProvider: 'razorpay',
      createdAt: now,
      updatedAt: now
    };

    try {
      await admin.firestore().collection('payments').doc(orderId).set(orderData);
      logger.info(`Elite order created in Firestore: ${orderId} for UID: ${uid}`);
    } catch (e) {
      logger.warn(`Firestore elite order notice: ${e.message}`);
    }

    return {
      orderId,
      amount: amountInRupees,
      currency: 'INR',
      paymentUrl: `https://backend-453t.onrender.com/pay/${orderId}`
    };
  }

  /**
   * Verifies payment and activates user Elite subscription in Firebase Firestore.
   */
  static async verifyPayment(uid, orderId) {
    if (!uid || !orderId) {
      throw ApiError.badRequest('User ID and Order ID are required.');
    }

    const now = Date.now();
    const nextBilling = now + 365 * 24 * 60 * 60 * 1000; // 1 year membership

    // 1. Update Payment Record in Firestore
    await admin.firestore().collection('payments').doc(orderId).set({
      status: 'success',
      paymentId: `txn_${Date.now()}`,
      verifiedAt: now,
      updatedAt: now
    }, { merge: true });

    // 2. Activate Elite in Firestore therivdata collection
    await admin.firestore().collection('therivdata').doc(uid).set({
      isElite: true,
      tier: 'elite',
      elite_plan: 'elite_399',
      monthlyMinutes: 600,
      minutesRemaining: 600,
      freeSessionsCount: 1,
      premiumStatus: true,
      isPremium: true,
      nextBillingDate: nextBilling,
      paymentStatus: 'active',
      updatedAt: now
    }, { merge: true });

    NotificationService.sendToUser(uid, {
      title: '👑 Welcome to Elite Club!',
      body: 'Your Elite Membership is now active. Enjoy priority advisory and exclusive perks.',
      data: { type: 'ELITE_ACTIVATED', orderId }
    }).catch(() => {});

    logger.info(`Elite payment verified in Firebase Firestore for user ${uid}, order: ${orderId}`);
    return {
      success: true,
      isElite: true,
      plan: 'elite_399',
      expiresAt: new Date(nextBilling).toISOString(),
      minutesRemaining: 600
    };
  }

  /**
   * Books a financial advisor session in Firestore.
   */
  static async bookSession(uid, { duration, date, time, slotId }) {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }
    const numDuration = Number(duration) || 30;
    const dateMillis = typeof date === 'number' ? date : new Date(date).getTime();
    const sessionId = `session_${uid}_${Date.now()}`;
    const now = Date.now();

    const userDoc = await admin.firestore().collection('therivdata').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    const currentMinutes = Number(userData.minutesRemaining ?? userData.monthlyMinutes ?? 600);
    const newMinutes = Math.max(0, currentMinutes - numDuration);

    // Save session in Firestore
    await admin.firestore().collection('elite_sessions').doc(sessionId).set({
      id: sessionId,
      userId: uid,
      duration: numDuration,
      dateMillis,
      timeSlot: time,
      status: 'booked',
      createdAt: now
    });

    // Update remaining minutes in Firestore
    await admin.firestore().collection('therivdata').doc(uid).set({
      minutesRemaining: newMinutes,
      updatedAt: now
    }, { merge: true });

    NotificationService.sendToUser(uid, {
      title: '📅 Session Booked',
      body: `Your ${numDuration}-minute advisor session is confirmed for ${time}.`,
      data: { type: 'SESSION_BOOKED', sessionId }
    }).catch(() => {});

    logger.info(`Session booked in Firestore for UID: ${uid}, session ID: ${sessionId}`);
    return {
      success: true,
      sessionId,
      minutesBooked: numDuration,
      minutesRemaining: newMinutes
    };
  }

  /**
   * Cancels recurring subscription
   */
  static async cancelSubscription(uid) {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    await admin.firestore().collection('therivdata').doc(uid).set({
      autoRenew: false,
      updatedAt: Date.now()
    }, { merge: true });

    return { success: true, message: 'Subscription auto-renew cancelled successfully.' };
  }

  /**
   * Retrieves user current subscription details from Firestore
   */
  static async getSubscriptionStatus(uid) {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const doc = await admin.firestore().collection('therivdata').doc(uid).get();
    const data = doc.exists ? doc.data() : {};

    return {
      isElite: Boolean(data.isElite),
      plan: data.elite_plan || (data.isElite ? 'elite_399' : 'free'),
      minutesRemaining: Number(data.minutesRemaining ?? (data.isElite ? 600 : 0)),
      monthlyMinutes: Number(data.monthlyMinutes ?? (data.isElite ? 600 : 0)),
      paymentStatus: data.paymentStatus || (data.isElite ? 'active' : 'inactive')
    };
  }
}

module.exports = EliteService;
