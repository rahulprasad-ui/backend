const ApiError = require('../utils/apiError');
const AuthConstants = require('../constants/authConstants');

/**
 * Sanitizes and validates phone numbers.
 * Supports 10-digit Indian numbers and E.164 formats (+91...).
 * @param {string} phone
 * @returns {string|null} E.164 formatted phone number or null
 */
function sanitizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  
  if (digits.length === 10) {
    return `${AuthConstants.DEFAULT_COUNTRY_CODE}${digits}`;
  } else if (digits.length > 10 && trimmed.startsWith('+')) {
    return `+${digits}`;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  return null;
}

const authValidator = {
  validateSendOtp: (req, res, next) => {
    const { phone } = req.body;
    if (!phone) {
      throw ApiError.badRequest('Phone number is required.');
    }

    const sanitizedPhone = sanitizePhone(phone);
    if (!sanitizedPhone) {
      throw ApiError.badRequest('Invalid phone number format. Provide a valid 10-digit phone number.');
    }

    // Attach sanitized phone for controller use
    req.sanitizedPhone = sanitizedPhone;
    req.rawPhone10 = sanitizedPhone.replace('+91', '');
    next();
  },

  validateVerifyOtp: (req, res, next) => {
    const { phone, otp } = req.body;
    if (!phone) {
      throw ApiError.badRequest('Phone number is required.');
    }
    if (!otp) {
      throw ApiError.badRequest('OTP is required.');
    }

    const sanitizedPhone = sanitizePhone(phone);
    if (!sanitizedPhone) {
      throw ApiError.badRequest('Invalid phone number format.');
    }

    const cleanOtp = String(otp).trim();
    if (cleanOtp.length !== AuthConstants.OTP_LENGTH || !/^\d+$/.test(cleanOtp)) {
      throw ApiError.badRequest(`OTP must be a ${AuthConstants.OTP_LENGTH}-digit numeric code.`);
    }

    req.sanitizedPhone = sanitizedPhone;
    req.cleanOtp = cleanOtp;
    next();
  },

  sanitizePhone
};

module.exports = authValidator;
