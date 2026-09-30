const UserService = require('../services/user.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

class UserController {
  /**
   * GET /api/v1/users/profile or GET /api/v1/users/me
   */
  static getProfile = asyncHandler(async (req, res) => {
    const uid = req.user ? req.user.uid : req.query.uid;
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const profile = await UserService.getProfile(uid);
    return ApiResponse.ok(res, profile, 'User profile retrieved.');
  });

  /**
   * PUT /api/v1/users/profile or POST /api/v1/users/sync
   */
  static updateProfile = asyncHandler(async (req, res) => {
    const uid = req.user ? req.user.uid : req.body.uid;
    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }

    const updated = await UserService.updateProfile(uid, req.body);
    return ApiResponse.ok(res, updated, 'User profile updated successfully.');
  });
}

module.exports = UserController;
