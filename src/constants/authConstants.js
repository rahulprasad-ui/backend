const AuthConstants = Object.freeze({
  OTP_LENGTH: 6,
  OTP_EXPIRY_MINUTES: 5,
  MAX_OTP_ATTEMPTS: 3,
  RESEND_COOLDOWN_SECONDS: 60,
  OTP_COLLECTION: 'otps',
  DEFAULT_COUNTRY_CODE: '+91'
});

module.exports = AuthConstants;
