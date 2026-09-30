const express = require('express');
const EliteController = require('../controllers/elite.controller');
const { requireAuth, optionalAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

// Order creation & payment verification
router.post('/create-order', optionalAuth, EliteController.createOrder);
router.post('/verify-payment', optionalAuth, EliteController.verifyPayment);

// Session booking & subscription management
router.post('/book-session', optionalAuth, EliteController.bookSession);
router.post('/cancel-subscription', optionalAuth, EliteController.cancelSubscription);
router.get('/subscription', optionalAuth, EliteController.getSubscription);

module.exports = router;
