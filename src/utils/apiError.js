const HttpStatus = require('../constants/httpStatusCodes');

class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {Array} [errors=[]]
   * @param {string} [stack='']
   */
  constructor(statusCode, message = 'Something went wrong', errors = [], stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.success = false;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(msg = 'Bad Request', errors = []) {
    return new ApiError(HttpStatus.BAD_REQUEST, msg, errors);
  }

  static unauthorized(msg = 'Unauthorized') {
    return new ApiError(HttpStatus.UNAUTHORIZED, msg);
  }

  static forbidden(msg = 'Forbidden') {
    return new ApiError(HttpStatus.FORBIDDEN, msg);
  }

  static notFound(msg = 'Resource Not Found') {
    return new ApiError(HttpStatus.NOT_FOUND, msg);
  }

  static tooManyRequests(msg = 'Too many requests, please try again later.') {
    return new ApiError(HttpStatus.TOO_MANY_REQUESTS, msg);
  }

  static internal(msg = 'Internal Server Error') {
    return new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, msg);
  }
}

module.exports = ApiError;
