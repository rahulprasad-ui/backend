const HttpStatus = require('../constants/httpStatusCodes');

class ApiResponse {
  /**
   * @param {number} statusCode
   * @param {*} data
   * @param {string} message
   */
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }

  static ok(res, data, message = 'Success') {
    return res.status(HttpStatus.OK).json(new ApiResponse(HttpStatus.OK, data, message));
  }

  static created(res, data, message = 'Resource created successfully') {
    return res.status(HttpStatus.CREATED).json(new ApiResponse(HttpStatus.CREATED, data, message));
  }
}

module.exports = ApiResponse;
