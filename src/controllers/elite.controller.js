const EliteService = require('../services/elite.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

class EliteController {
  /**
   * POST /api/v1/elite/create-order or POST /api/v1/payments/create-order
   */
  static createOrder = asyncHandler(async (req, res) => {
    const uid = req.user ? req.user.uid : req.body.uid;
    const { amount, plan } = req.body;

    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const order = await EliteService.createOrder(uid, amount, plan);
    return ApiResponse.created(res, order, 'Payment order created successfully.');
  });

  /**
   * POST /api/v1/elite/verify-payment or POST /api/v1/payments/verify
   */
  static verifyPayment = asyncHandler(async (req, res) => {
    const uid = req.user ? req.user.uid : req.body.uid;
    const orderId = req.body.order_id || req.body.orderId;

    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }
    if (!orderId) {
      throw ApiError.badRequest('Order ID is required.');
    }

    const result = await EliteService.verifyPayment(uid, orderId);
    return ApiResponse.ok(res, result, 'Payment verified and Elite membership activated.');
  });

  /**
   * POST /api/v1/elite/book-session
   */
  static bookSession = asyncHandler(async (req, res) => {
    const uid = req.user ? req.user.uid : req.body.uid;
    const { duration, date, time, slotId } = req.body;

    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const booking = await EliteService.bookSession(uid, { duration, date, time, slotId });
    return ApiResponse.created(res, booking, 'Session booked successfully.');
  });

  /**
   * POST /api/v1/elite/cancel-subscription
   */
  static cancelSubscription = asyncHandler(async (req, res) => {
    const uid = req.user ? req.user.uid : req.body.uid;

    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const result = await EliteService.cancelSubscription(uid);
    return ApiResponse.ok(res, result, result.message);
  });

  /**
   * GET /api/v1/elite/subscription or GET /api/v1/payments/subscription
   */
  static getSubscription = asyncHandler(async (req, res) => {
    const uid = req.user ? req.user.uid : req.query.uid;

    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const subscription = await EliteService.getSubscriptionStatus(uid);
    return ApiResponse.ok(res, subscription, 'Subscription status retrieved.');
  });
}

module.exports = EliteController;
