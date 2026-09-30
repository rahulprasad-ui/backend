const { admin } = require('../config/firebase');
const db = require('../config/database');
const logger = require('../utils/logger');

class NotificationService {
  /**
   * Registers or updates a device FCM token for a user.
   */
  static async registerToken(userId, token, device = 'Android') {
    if (!userId || !token) return false;
    const now = Date.now();
    await db.execute({
      sql: `
        INSERT INTO fcm_tokens (user_id, token, device, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(token) DO UPDATE SET
          user_id = excluded.user_id,
          device = excluded.device,
          updated_at = excluded.updated_at
      `,
      args: [userId, token, device, now]
    });
    logger.info(`FCM token registered in Turso for user: ${userId}`);
    return true;
  }

  /**
   * Removes an FCM token.
   */
  static async unregisterToken(token) {
    if (!token) return false;
    await db.execute({
      sql: 'DELETE FROM fcm_tokens WHERE token = ?',
      args: [token]
    });
    return true;
  }

  /**
   * Sends a Push Notification via Firebase Cloud Messaging.
   */
  static async sendToUser(userId, { title, body, data = {} }) {
    if (!userId || !title) return false;

    const result = await db.execute({
      sql: 'SELECT token FROM fcm_tokens WHERE user_id = ?',
      args: [userId]
    });
    const tokens = result.rows;

    if (!tokens || tokens.length === 0) {
      logger.info(`No active FCM tokens found in Turso for user: ${userId}`);
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

        if (response.failureCount > 0) {
          response.responses.forEach(async (resp, idx) => {
            if (!resp.success) {
              const badToken = registrationTokens[idx];
              const errorCode = resp.error?.code;
              if (errorCode === 'messaging/invalid-registration-token' ||
                  errorCode === 'messaging/registration-token-not-registered') {
                await db.execute({ sql: 'DELETE FROM fcm_tokens WHERE token = ?', args: [badToken] }).catch(() => {});
                logger.warn(`Removed dead FCM token from Turso: ${badToken}`);
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
   * Broadcast push notification to topic.
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
