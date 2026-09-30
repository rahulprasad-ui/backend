const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const config = require('../config/env');

class HealthController {
  /**
   * GET /health & GET /api/v1/health
   */
  static getHealth = asyncHandler(async (req, res) => {
    const healthData = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.env,
      service: 'Rivava-Backend-API'
    };
    return ApiResponse.ok(res, healthData, 'Service is healthy.');
  });
}

module.exports = HealthController;
