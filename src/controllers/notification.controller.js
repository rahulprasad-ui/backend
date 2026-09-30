const NotificationService = require('../services/notification.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

class NotificationController {
  /**
   * POST /api/v1/notifications/register-token
   */
  static registerToken = asyncHandler(async (req, res) => {
    const { token, device } = req.body;
    const userId = req.user?.uid || req.body.userId;

    if (!userId || !token) {
      throw ApiError.badRequest('userId and token are required.');
    }

    NotificationService.registerToken(userId, token, device || 'Android');
    return ApiResponse.ok(res, { registered: true }, 'FCM token registered successfully.');
  });

  /**
   * POST /api/v1/notifications/send
   * (Admin / trigger test endpoint)
   */
  static sendNotification = asyncHandler(async (req, res) => {
    const { userId, title, body, data } = req.body;

    if (!userId || !title || !body) {
      throw ApiError.badRequest('userId, title, and body are required.');
    }

    const result = await NotificationService.sendToUser(userId, { title, body, data });
    return ApiResponse.ok(res, { success: result }, 'Push notification processed.');
  });
}

module.exports = NotificationController;
