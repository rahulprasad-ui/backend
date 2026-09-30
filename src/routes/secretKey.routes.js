const express = require('express');
const SecretKeyController = require('../controllers/secretKey.controller');
const { optionalAuth, requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

// Public / Authenticated key redemption
router.post('/redeem', optionalAuth, SecretKeyController.redeemKey);

// Administrative management endpoints
router.post('/generate', optionalAuth, SecretKeyController.generateKey);
router.post('/revoke', optionalAuth, SecretKeyController.revokeKey);
router.get('/status/:key', optionalAuth, SecretKeyController.getKeyStatus);

module.exports = router;
