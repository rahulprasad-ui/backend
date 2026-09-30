const path = require('path');
const dotenv = require('dotenv');

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: process.env.BASE_URL || 'http://192.168.1.22:3000',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.RESEND_FROM_EMAIL || 'Rivava TrackFi <onboarding@resend.dev>'
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    },
    from: process.env.SMTP_FROM || 'Rivava TrackFi <no-reply@rivava.in>'
  },
  firebase: {
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve(__dirname, '../../serviceAccountKey.json'),
    projectId: process.env.FIREBASE_PROJECT_ID
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    otpWindowMs: parseInt(process.env.RATE_LIMIT_OTP_WINDOW_MS || '60000', 10), // 1 min
    otpMaxRequests: parseInt(process.env.RATE_LIMIT_OTP_MAX_REQUESTS || '5', 10)
  },
  paymentGateway: {
    provider: process.env.PAYMENT_GATEWAY_PROVIDER || 'razorpay',
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_key_id',
    keySecret: process.env.RAZORPAY_KEY_SECRET || 'mock_secret_key_for_testing',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_webhook_secret_key',
    currency: 'INR'
  }
};

module.exports = config;
