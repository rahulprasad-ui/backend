const { admin, db } = require('../config/firebase');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

class EliteService {
  /**
   * Creates an Elite / Premium payment order in Firestore
   * @param {string} uid User ID
   * @param {number} amount Amount in paise (e.g. 330000 = Rs. 3300)
   * @param {string} [plan='elite_3300']
   */
  static async createOrder(uid, amount, plan = 'elite_3300') {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const orderId = `elite_order_${uid}_${Date.now()}`;
    const paymentRef = db.collection('elite_payment_events').doc();

    const orderRecord = {
      uid,
      orderId,
      amount: amount ? amount / 100 : 3300,
      currency: 'INR',
      status: 'created',
      plan,
      rawEventType: 'created',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedAt: null
    };

    await paymentRef.set(orderRecord);
    logger.info(`Elite order created: ${orderId} for UID: ${uid}`);

    return {
      orderId,
      amount: orderRecord.amount,
      currency: 'INR',
      paymentUrl: `https://mock-uropay.example.com/pay/${orderId}`
    };
  }

  /**
   * Verifies payment and activates user Elite subscription inside an atomic Firestore transaction.
   */
  static async verifyPayment(uid, orderId) {
    if (!uid || !orderId) {
      throw ApiError.badRequest('User ID and Order ID are required.');
    }

    const result = await db.runTransaction(async (transaction) => {
      // Find matching payment document
      const paymentsQuery = db.collection('elite_payment_events')
        .where('orderId', '==', orderId)
        .where('uid', '==', uid)
        .limit(1);

      const paymentsSnapshot = await transaction.get(paymentsQuery);

      if (paymentsSnapshot.empty) {
        throw ApiError.notFound('Payment order record not found.');
      }

      const paymentDoc = paymentsSnapshot.docs[0];
      const paymentData = paymentDoc.data();

      if (paymentData.status === 'success') {
        return { success: true, isElite: true, message: 'Payment has already been processed and verified.' };
      }

      // Check Elite membership seat configuration
      const configRef = db.collection('elite_membership_meta').doc('config');
      const configDoc = await transaction.get(configRef);

      let occupiedSeats = 0;
      let totalSeats = 100;

      if (configDoc.exists) {
        const configData = configDoc.data();
        occupiedSeats = configData.occupiedSeats || 0;
        totalSeats = configData.totalSeats || 100;
      } else {
        transaction.set(configRef, {
          totalSeats: 100,
          occupiedSeats: 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      if (occupiedSeats >= totalSeats) {
        transaction.update(paymentDoc.ref, {
          status: 'failed_limit_reached',
          rawEventType: 'failed_limit_reached',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        throw ApiError.badRequest('Elite Membership cohort is currently full.');
      }

      // Increment occupied seats
      transaction.update(configRef, {
        occupiedSeats: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update payment document to success
      const paymentId = `txn_${Date.now()}`;
      transaction.update(paymentDoc.ref, {
        status: 'success',
        paymentId,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        rawEventType: 'success'
      });

      // Update user subscription
      const subscriptionRef = db.collection('users').doc(uid).collection('subscription').doc('current');
      const now = new Date();
      const nextBilling = new Date(now);
      nextBilling.setMonth(now.getMonth() + 1);

      transaction.set(subscriptionRef, {
        isElite: true,
        plan: 'elite_3300',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(nextBilling),
        minutesRemaining: 600,
        monthlyMinutes: 600,
        autoRenew: true,
        paymentStatus: 'active',
        mandateId: `mandate_${uid}`,
        recurringStatus: 'active',
        nextBillingDate: admin.firestore.Timestamp.fromDate(nextBilling),
        lastPaymentId: paymentId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return {
        success: true,
        isElite: true,
        plan: 'elite_3300',
        expiresAt: nextBilling.toISOString(),
        minutesRemaining: 600
      };
    });

    logger.info(`Elite payment verified for user ${uid}, order: ${orderId}`);
    return result;
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

    const result = await db.runTransaction(async (transaction) => {
      const subscriptionRef = db.collection('users').doc(uid).collection('subscription').doc('current');
      const subscriptionDoc = await transaction.get(subscriptionRef);

      if (!subscriptionDoc.exists) {
        throw ApiError.badRequest('No active Elite subscription found.');
      }

      const subscriptionData = subscriptionDoc.data();
      if (!subscriptionData.isElite || subscriptionData.paymentStatus !== 'active') {
        throw ApiError.badRequest('Your Elite subscription is not active.');
      }

      if ((subscriptionData.minutesRemaining || 0) < numDuration) {
        throw ApiError.badRequest(`Insufficient minutes. You have ${subscriptionData.minutesRemaining || 0} minutes available.`);
      }

      // Deduct minutes
      transaction.update(subscriptionRef, {
        minutesRemaining: admin.firestore.FieldValue.increment(-numDuration),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Create booking document
      const sessionRef = db.collection('elite_sessions').doc();
      const sessionDate = typeof date === 'number' ? admin.firestore.Timestamp.fromMillis(date) : admin.firestore.Timestamp.fromDate(new Date(date));

      transaction.set(sessionRef, {
        uid,
        selectedDate: sessionDate,
        selectedTime: time,
        slotId: slotId || `slot_${Date.now()}`,
        status: 'pending',
        minutesBooked: numDuration,
        meetingLink: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedAt: null,
        completedAt: null,
        cancelledAt: null
      });

      return {
        success: true,
        sessionId: sessionRef.id,
        minutesBooked: numDuration,
        minutesRemaining: (subscriptionData.minutesRemaining || 0) - numDuration
      };
    });

    logger.info(`Session booked for UID: ${uid}, session ID: ${result.sessionId}`);
    return result;
  }

  /**
   * Cancels recurring subscription auto-renewal
   */
  static async cancelSubscription(uid) {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const subscriptionRef = db.collection('users').doc(uid).collection('subscription').doc('current');
    const docSnap = await subscriptionRef.get();

    if (!docSnap.exists) {
      throw ApiError.notFound('No subscription found to cancel.');
    }

    await subscriptionRef.update({
      autoRenew: false,
      recurringStatus: 'cancelled',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info(`Subscription cancelled for user: ${uid}`);
    return { success: true, message: 'Subscription auto-renew cancelled successfully.' };
  }

  /**
   * Retrieves user current subscription details
   */
  static async getSubscriptionStatus(uid) {
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const subscriptionRef = db.collection('users').doc(uid).collection('subscription').doc('current');
    const docSnap = await subscriptionRef.get();

    if (!docSnap.exists) {
      return {
        isElite: false,
        plan: 'free',
        status: 'none'
      };
    }

    return docSnap.data();
  }
}

module.exports = EliteService;
