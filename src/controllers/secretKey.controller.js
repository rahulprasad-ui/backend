const SecretKeyService = require('../services/secretKey.service');
const { formatResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');

class SecretKeyController {
  /**
   * POST /api/keys/redeem
   * Endpoint called by mobile app or web client to securely redeem a secret key.
   */
  static async redeemKey(req, res, next) {
    try {
      const { secretKey } = req.body;
      const userId = req.user?.uid || req.body.userId;
      const userEmail = req.user?.email || req.body.userEmail;

      if (!secretKey) {
        return res.status(400).json(formatResponse(false, null, 'Secret key is required.'));
      }

      if (!userId) {
        return res.status(401).json(formatResponse(false, null, 'User authentication is required.'));
      }

      const result = await SecretKeyService.verifyAndRedeemKey({
        keyString: secretKey,
        userId,
        userEmail
      });

      if (!result.success) {
        return res.status(400).json(formatResponse(false, { code: result.code }, result.message));
      }

      return res.status(200).json(formatResponse(true, {
        tier: result.tier,
        code: result.code
      }, result.message));
    } catch (error) {
      logger.error('Error in redeemKey controller:', error);
      next(error);
    }
  }

  /**
   * POST /api/keys/generate
   * Admin endpoint to generate unique secure keys.
   */
  static async generateKey(req, res, next) {
    try {
      const { tier, maxUses, prefix, assignedEmail, expiresInDays, notes } = req.body;
      const createdBy = req.user?.uid || 'admin';

      const keyRecord = await SecretKeyService.createSecretKey({
        tier,
        maxUses,
        prefix,
        assignedEmail,
        expiresInDays,
        notes,
        createdBy
      });

      return res.status(201).json(formatResponse(true, keyRecord, 'Secret key generated successfully.'));
    } catch (error) {
      logger.error('Error in generateKey controller:', error);
      next(error);
    }
  }

  /**
   * POST /api/keys/revoke
   * Admin endpoint to revoke a compromised or expired key.
   */
  static async revokeKey(req, res, next) {
    try {
      const { secretKey, reason } = req.body;

      if (!secretKey) {
        return res.status(400).json(formatResponse(false, null, 'Secret key is required.'));
      }

      const result = await SecretKeyService.revokeKey(secretKey, reason);
      if (!result.success) {
        return res.status(404).json(formatResponse(false, null, result.message));
      }

      return res.status(200).json(formatResponse(true, null, result.message));
    } catch (error) {
      logger.error('Error in revokeKey controller:', error);
      next(error);
    }
  }

  /**
   * GET /api/keys/status/:key
   * Check status and validity of a key.
   */
  static async getKeyStatus(req, res, next) {
    try {
      const { key } = req.params;
      const status = await SecretKeyService.getKeyStatus(key);

      if (!status.exists) {
        return res.status(404).json(formatResponse(false, null, 'Secret key not found.'));
      }

      return res.status(200).json(formatResponse(true, status, 'Key status retrieved.'));
    } catch (error) {
      logger.error('Error in getKeyStatus controller:', error);
      next(error);
    }
  }
}

module.exports = SecretKeyController;
