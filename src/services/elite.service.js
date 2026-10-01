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
    const PaymentService = require('./payment.service');
    return await PaymentService.createOrder({
      userId: uid,
      amountPaise: amount || 39900,
      plan: plan || 'elite_399'
    });
  }

  /**
   * Verifies payment and activates user Elite subscription in Firebase Firestore.
   */
  static async verifyPayment(uid, orderId) {
    if (!uid || !orderId) {
      throw ApiError.badRequest('User ID and Order ID are required.');
    }
    const PaymentService = require('./payment.service');
    return await PaymentService.verifyPayment({
      userId: uid,
      orderId
    });
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
      uid: uid,
      duration: numDuration,
      minutesBooked: numDuration,
      dateMillis,
      selectedDate: admin.firestore.Timestamp.fromMillis(dateMillis),
      selectedTime: time,
      timeSlot: time,
      status: 'confirmed',
      meetingLink: 'https://meet.google.com/riv-elite-advisory',
      createdAt: now
    });

    // Update remaining minutes in Firestore collections
    await admin.firestore().collection('therivdata').doc(uid).set({
      minutesRemaining: newMinutes,
      updatedAt: now
    }, { merge: true });

    await admin.firestore().collection('users').doc(uid).collection('subscription').doc('current').set({
      minutesRemaining: newMinutes,
      updatedAt: now
    }, { merge: true }).catch(() => {});

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
