const VerificationService = require('../services/verification.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

class VerificationController {
  /**
   * POST /api/v1/verification/send-email
   */
  static sendVerificationEmail = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const uid = req.user ? req.user.uid : req.body.uid;

    if (!uid) {
      throw ApiError.badRequest('User ID is required.');
    }
    if (!email) {
      throw ApiError.badRequest('Email address is required.');
    }

    const result = await VerificationService.sendVerificationEmail(uid, email);
    return ApiResponse.ok(res, result, 'Verification email sent successfully.');
  });

  /**
   * GET /api/v1/verification/verify or GET /verify?token=...
   */
  static verifyToken = asyncHandler(async (req, res) => {
    const token = req.query.token;
    const isHtmlRequest = req.accepts('html') && !req.accepts('json');

    const result = await VerificationService.verifyToken(token);

    if (req.query.format === 'json' || !isHtmlRequest) {
      return ApiResponse.ok(res, result, result.message);
    }

    // Render beautiful verification success landing page
    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verified - Rivava TrackFi</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background-color: #0F172A;
              color: #F8FAFC;
              margin: 0;
              padding: 20px;
              box-sizing: border-box;
            }
            .card {
              background-color: #1E293B;
              padding: 40px;
              border-radius: 16px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.4);
              text-align: center;
              max-width: 480px;
              width: 100%;
              border: 1px solid #334155;
            }
            .icon { font-size: 52px; margin-bottom: 20px; }
            h1 { color: #38BDF8; margin: 0 0 12px 0; font-size: 26px; }
            p { color: #94A3B8; line-height: 1.6; margin: 0 0 24px 0; font-size: 16px; }
            .badge {
              background: rgba(56, 189, 248, 0.12);
              color: #38BDF8;
              padding: 10px 20px;
              border-radius: 9999px;
              font-size: 14px;
              font-weight: 600;
              border: 1px solid rgba(56, 189, 248, 0.3);
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✨</div>
            <h1>Email Verified Successfully!</h1>
            <p>Your Rivava account has been verified. You're ready to take control of your financial intelligence.</p>
            <div class="badge">You can now return to the Rivava mobile app</div>
          </div>
        </body>
      </html>
    `);
  });

  /**
   * GET /api/v1/verification/status?uid=...
   */
  static checkStatus = asyncHandler(async (req, res) => {
    const uid = req.query.uid || (req.user && req.user.uid);
    const status = await VerificationService.checkStatus(uid);
    return ApiResponse.ok(res, status, 'Verification status retrieved.');
  });
}

module.exports = VerificationController;
