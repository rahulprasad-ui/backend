const { admin } = require('../config/firebase');
const db = require('../config/database');
const logger = require('../utils/logger');

class NotificationService {
  /**
   * Registers or updates a device FCM token for a user.
   * @param {string} userId
   * @param {string} token FCM Registration Token
   * @param {string} [device='Android']
   */
  static registerToken(userId, token, device = 'Android') {
    if (!userId || !token) return false;
    const now = Date.now();
    const stmt = db.prepare(`
      INSERT INTO fcm_tokens (user_id, token, device, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(token) DO UPDATE SET
        user_id = excluded.user_id,
        device = excluded.device,
        updated_at = excluded.updated_at
    `);
    stmt.run(userId, token, device, now);
    logger.info(`FCM token registered for user: ${userId}`);
    return true;
  }

  /**
   * Removes an FCM token (e.g. on logout).
   * @param {string} token
   */
  static unregisterToken(token) {
    if (!token) return false;
    const stmt = db.prepare(`DELETE FROM fcm_tokens WHERE token = ?`);
    stmt.run(token);
    return true;
  }

  /**
   * Sends a Push Notification to all active devices of a user via Firebase Cloud Messaging.
   * @param {string} userId
   * @param {Object} payload
   * @param {string} payload.title
   * @param {string} payload.body
   * @param {Object} [payload.data={}]
   */
  static async sendToUser(userId, { title, body, data = {} }) {
    if (!userId || !title) return false;

    const tokens = db.prepare(`SELECT token FROM fcm_tokens WHERE user_id = ?`).all(userId);
    if (!tokens || tokens.length === 0) {
      logger.info(`No active FCM tokens found for user: ${userId}`);
      return false;
    }

    const registrationTokens = tokens.map(t => t.token);

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
        
        // Clean up invalid/expired tokens
        if (response.failureCount > 0) {
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const badToken = registrationTokens[idx];
              const errorCode = resp.error?.code;
              if (errorCode === 'messaging/invalid-registration-token' ||
                  errorCode === 'messaging/registration-token-not-registered') {
                db.prepare(`DELETE FROM fcm_tokens WHERE token = ?`).run(badToken);
                logger.warn(`Removed dead FCM token: ${badToken}`);
              }
            }
          });
        }
        return true;
      } else {
        logger.warn('[FCM] Firebase messaging not initialized. Notification skipped.');
        return false;
      }
    } catch (error) {
      logger.error(`Error sending FCM push notification to ${userId}:`, error.message);
      return false;
    }
  }

  /**
   * Broadcast push notification to topic or all users.
   */
  static async sendTopic(topic, { title, body, data = {} }) {
    if (!topic || !title) return false;
    try {
      if (admin && admin.messaging) {
        await admin.messaging().send({
          topic,
          notification: { title, body },
          data
        });
        logger.info(`Broadcast FCM notification sent to topic: ${topic}`);
        return true;
      }
    } catch (error) {
      logger.error(`Failed to send topic notification to ${topic}:`, error.message);
      return false;
    }
  }
}

module.exports = NotificationService;
