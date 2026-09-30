const express = require('express');
const PaymentController = require('../controllers/payment.controller');
const { optionalAuth, requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

// Order creation & server-side verification
router.post('/create-order', optionalAuth, PaymentController.createOrder);
router.post('/verify', optionalAuth, PaymentController.verifyPayment);
router.post('/verify-payment', optionalAuth, PaymentController.verifyPayment); // Alias

// Webhook listener (called directly by Gateway)
router.post('/webhook', PaymentController.handleWebhook);

// User payment history
router.get('/history', optionalAuth, PaymentController.getHistory);

module.exports = router;
