const PaymentService = require('../services/payment.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

class PaymentController {
  /**
   * POST /api/payments/create-order
   */
  static createOrder = asyncHandler(async (req, res) => {
    const userId = req.user ? req.user.uid : req.body.userId || req.body.uid;
    const userEmail = req.user ? req.user.email : req.body.userEmail || req.body.email;
    const { plan, amountPaise, amount } = req.body;

    if (!userId) {
      throw ApiError.badRequest('User ID is required.');
    }

    const calculatedPaise = amountPaise || (amount ? amount * 100 : 1100);

    const order = await PaymentService.createOrder({
      userId,
      userEmail,
      plan: plan || 'portfolio_premium',
      amountPaise: calculatedPaise
    });

    return ApiResponse.created(res, order, 'Payment order created successfully.');
  });

  /**
   * POST /api/payments/verify
   * Secure server-side payment verification endpoint.
   */
  static verifyPayment = asyncHandler(async (req, res) => {
    const userId = req.user ? req.user.uid : req.body.userId || req.body.uid;
    const orderId = req.body.order_id || req.body.orderId;
    const paymentId = req.body.payment_id || req.body.paymentId || req.body.razorpay_payment_id;
    const signature = req.body.signature || req.body.razorpay_signature;

    if (!userId) {
      throw ApiError.badRequest('User ID is required.');
    }
    if (!orderId) {
      throw ApiError.badRequest('Order ID is required.');
    }

    const result = await PaymentService.verifyPayment({
      userId,
      orderId,
      paymentId,
      signature
    });

    return ApiResponse.ok(res, result, result.message || 'Payment verified and premium unlocked.');
  });

  /**
   * POST /api/payments/webhook
   * Webhook listener for payment gateway callbacks.
   */
  static handleWebhook = asyncHandler(async (req, res) => {
    const signatureHeader = req.headers['x-razorpay-signature'] || req.headers['x-webhook-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    const result = await PaymentService.processWebhook({
      rawBody,
      signatureHeader,
      eventPayload: req.body
    });

    return res.status(200).json(result);
  });

  /**
   * GET /api/payments/history
   */
  static getHistory = asyncHandler(async (req, res) => {
    const userId = req.user ? req.user.uid : req.query.userId || req.query.uid;
    if (!userId) {
      throw ApiError.badRequest('User ID is required.');
    }

    const history = await PaymentService.getPaymentsByUser(userId);
    return ApiResponse.ok(res, history, 'Payment history retrieved.');
  });
}

module.exports = PaymentController;
