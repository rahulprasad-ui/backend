const { admin } = require('../config/firebase');
const logger = require('../utils/logger');

class NotificationService {
  /**
   * Registers or updates a device FCM token for a user in Firebase Firestore.
   */
  static async registerToken(userId, token, device = 'Android') {
    if (!userId || !token) return false;
    const now = Date.now();
    await admin.firestore().collection('fcm_tokens').doc(token).set({
      userId,
      token,
      device,
      updatedAt: now
    });
    logger.info(`FCM token registered in Firebase Firestore for user: ${userId}`);
    return true;
  }

  /**
   * Removes an FCM token from Firestore.
   */
  static async unregisterToken(token) {
    if (!token) return false;
    await admin.firestore().collection('fcm_tokens').doc(token).delete().catch(() => {});
    return true;
  }

  /**
   * Sends a Push Notification via Firebase Cloud Messaging.
   */
  static async sendToUser(userId, { title, body, data = {} }) {
    if (!userId || !title) return false;

    const snap = await admin.firestore().collection('fcm_tokens').where('userId', '==', userId).get();

    if (snap.empty) {
      logger.info(`No active FCM tokens found in Firestore for user: ${userId}`);
      return false;
    }

    const registrationTokens = snap.docs.map(d => d.data().token);

    const message = {
      notification: {
        title,
        body
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      tokens: registrationTokens
    };

    try {
      if (admin && admin.messaging) {
        const response = await admin.messaging().sendEachForMulticast(message);
        logger.info(`FCM Push sent to user ${userId}: ${response.successCount} successful, ${response.failureCount} failed.`);

        if (response.failureCount > 0) {
          response.responses.forEach(async (resp, idx) => {
            if (!resp.success) {
              const badToken = registrationTokens[idx];
              const errorCode = resp.error?.code;
              if (errorCode === 'messaging/invalid-registration-token' ||
                  errorCode === 'messaging/registration-token-not-registered') {
                await admin.firestore().collection('fcm_tokens').doc(badToken).delete().catch(() => {});
                logger.warn(`Removed invalid FCM token from Firestore: ${badToken}`);
              }
            }
          });
        }
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Error sending FCM push notification to ${userId}:`, error.message);
      return false;
    }
  }

  /**
   * Broadcast push notification to topic.
   */
  static async sendToTopic(topic, { title, body, data = {} }) {
    if (!topic || !title) return false;

    const message = {
      notification: { title, body },
      data,
      topic
    };

    try {
      if (admin && admin.messaging) {
        const response = await admin.messaging().send(message);
        logger.info(`FCM Broadcast to topic ${topic} successful: ${response}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Error broadcasting to topic ${topic}:`, error.message);
      return false;
    }
  }
}

module.exports = NotificationService;
