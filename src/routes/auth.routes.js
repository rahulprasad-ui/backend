const express = require('express');
const AuthController = require('../controllers/auth.controller');
const authValidator = require('../validators/auth.validator');
const { otpLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// POST /send-otp
router.post(
  '/send-otp',
  otpLimiter,
  authValidator.validateSendOtp,
  AuthController.sendOtp
);

// POST /verify-otp
router.post(
  '/verify-otp',
  otpLimiter,
  authValidator.validateVerifyOtp,
  AuthController.verifyOtp
);

// POST /forgot-password
router.post(
  '/forgot-password',
  AuthController.forgotPassword
);

// POST /reset-password
router.post(
  '/reset-password',
  AuthController.resetPassword
);

module.exports = router;
