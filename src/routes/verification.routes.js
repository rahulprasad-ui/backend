const express = require('express');
const VerificationController = require('../controllers/verification.controller');
const { optionalAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

// Send verification email
router.post('/send-email', optionalAuth, VerificationController.sendVerificationEmail);

// Verify email link / token
router.get('/verify', VerificationController.verifyToken);

// Check verification status
router.get('/status', optionalAuth, VerificationController.checkStatus);

module.exports = router;
