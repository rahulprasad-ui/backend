const ApiError = require('../utils/apiError');
const config = require('../config/env');

// In-memory rate limiting store
const rateLimitMap = new Map();

/**
 * Clean memory map periodically to avoid leaks
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000).unref();

/**
 * Creates a rate limiting middleware
 * @param {Object} options
 * @param {number} options.windowMs Window size in milliseconds
 * @param {number} options.max Maximum requests per window
 * @param {string} options.message Error message on limit exceeded
 */
function createRateLimiter({ windowMs, max, message }) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = `${req.baseUrl || ''}${req.path}:${ip}`;
    const now = Date.now();

    const record = rateLimitMap.get(key);

    if (!record) {
      rateLimitMap.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    record.count += 1;
    if (record.count > max) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      throw ApiError.tooManyRequests(message || `Too many requests. Please try again after ${retryAfterSec} seconds.`);
    }

    next();
  };
}

const apiLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.'
});

const otpLimiter = createRateLimiter({
  windowMs: config.rateLimit.otpWindowMs,
  max: config.rateLimit.otpMaxRequests,
  message: 'Too many OTP requests. Please wait before trying again.'
});

module.exports = {
  createRateLimiter,
  apiLimiter,
  otpLimiter
};
