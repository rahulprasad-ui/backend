const { admin } = require('../config/firebase');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * Middleware to authenticate requests using Firebase ID Token
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    // Optional dev bypass for testing if explicitly enabled
    if (!token && process.env.NODE_ENV === 'development' && req.headers['x-dev-uid']) {
      req.user = {
        uid: req.headers['x-dev-uid'],
        email: req.headers['x-dev-email'] || 'test@rivava.in',
        phone_number: '+919876543210'
      };
      return next();
    }

    if (!token) {
      throw ApiError.unauthorized('Authentication token is required.');
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }
    logger.warn(`Auth token verification failed: ${error.message}`);
    return next(ApiError.unauthorized('Invalid or expired authentication token.'));
  }
};

/**
 * Optional Auth middleware: attaches req.user if token is present, but doesn't block if missing
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      req.user = await admin.auth().verifyIdToken(token);
    }
  } catch (e) {
    // Ignore optional auth failure
  }
  next();
};

module.exports = {
  requireAuth,
  optionalAuth
};
