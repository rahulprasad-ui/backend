const AuthService = require('../services/auth.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

class AuthController {
  /**
   * POST /api/v1/auth/send-otp (or /auth/send-otp)
   */
  static sendOtp = asyncHandler(async (req, res) => {
    const { sanitizedPhone, rawPhone10 } = req;
    const result = await AuthService.requestOtp(sanitizedPhone, rawPhone10);
    return ApiResponse.ok(res, { phone: sanitizedPhone }, result.message);
  });

  /**
   * POST /api/v1/auth/verify-otp (or /auth/verify-otp)
   */
  static verifyOtp = asyncHandler(async (req, res) => {
    const { sanitizedPhone, cleanOtp } = req;
    const { token, uid } = await AuthService.verifyOtp(sanitizedPhone, cleanOtp);
    return ApiResponse.ok(res, { token, uid }, 'OTP verified successfully.');
  });

  /**
   * POST /api/v1/auth/forgot-password
   */
  static forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const result = await AuthService.requestPasswordReset(email);
    return ApiResponse.ok(res, { email }, result.message);
  });

  /**
   * POST /api/v1/auth/reset-password
   */
  static resetPassword = asyncHandler(async (req, res) => {
    const { email, token, newPassword } = req.body;
    const result = await AuthService.resetPassword(email, token, newPassword);
    return ApiResponse.ok(res, { email }, result.message);
  });

  /**
   * GET /reset - Web redirect page to open mobile app
   */
  static handleResetRedirect = (req, res) => {
    const { token, email } = req.query;
    const cleanToken = token || '';
    const cleanEmail = email || '';
    const appDeepLink = `rivava://reset?token=${cleanToken}&email=${encodeURIComponent(cleanEmail)}`;
    const intentLink = `intent://reset?token=${cleanToken}&email=${encodeURIComponent(cleanEmail)}#Intent;scheme=rivava;package=com.rivavafi.universal;end`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Opening Rivava TrackFi...</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: #0F172A; color: #F8FAFC; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #1E293B; border: 1px solid #334155; border-radius: 16px; padding: 36px 24px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
    .icon { font-size: 48px; margin-bottom: 16px; display: inline-block; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; color: #FFFFFF; }
    p { font-size: 14px; color: #94A3B8; line-height: 1.6; margin-bottom: 24px; }
    .btn { display: block; width: 100%; background: #2563EB; color: #FFFFFF; text-decoration: none; padding: 14px 20px; border-radius: 10px; font-weight: 700; font-size: 16px; transition: background 0.2s; }
    .btn:hover { background: #1D4ED8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔐</div>
    <h1>Rivava TrackFi</h1>
    <p>Opening the Rivava TrackFi app to reset your password...</p>
    <a href="${appDeepLink}" class="btn" id="openBtn">Open Rivava App &rarr;</a>
  </div>
  <script>
    // Automatic redirection
    window.location.href = "${appDeepLink}";
    setTimeout(function() {
      window.location.href = "${intentLink}";
    }, 400);
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  };
}

module.exports = AuthController;
