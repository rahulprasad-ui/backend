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
   * GET /reset - Web password reset & app launcher page
   */
  static handleResetRedirect = (req, res) => {
    const { token, email } = req.query;
    const cleanToken = (token || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const appDeepLink = `rivava://reset?token=${cleanToken}&email=${encodeURIComponent(cleanEmail)}`;
    const intentLink = `intent://reset?token=${cleanToken}&email=${encodeURIComponent(cleanEmail)}#Intent;scheme=rivava;package=com.rivavafi.universal;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;

    const hasToken = cleanToken.length > 0 && cleanEmail.length > 0;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - Rivava TrackFi</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; }
    body {
      background: radial-gradient(circle at top center, #1E293B 0%, #0B0F19 100%);
      color: #F8FAFC;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px 16px;
    }
    .card {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 36px 28px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 20px rgba(59, 130, 246, 0.15);
      text-align: left;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo-badge {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #3B82F6, #1D4ED8);
      border-radius: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      margin-bottom: 12px;
      box-shadow: 0 8px 20px rgba(59, 130, 246, 0.35);
    }
    h1 { font-size: 24px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px; }
    p.subtitle { font-size: 14px; color: #94A3B8; margin-top: 6px; line-height: 1.5; }
    
    .app-action-box {
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.25);
      border-radius: 14px;
      padding: 14px 16px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .app-action-text {
      font-size: 13px;
      color: #93C5FD;
      font-weight: 500;
    }
    .app-btn {
      background: #3B82F6;
      color: #FFFFFF;
      text-decoration: none;
      padding: 8px 14px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 13px;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .app-btn:hover { background: #2563EB; transform: translateY(-1px); }

    .divider {
      display: flex;
      align-items: center;
      text-align: center;
      margin: 20px 0;
      color: #64748B;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .divider:not(:empty)::before { margin-right: .75em; }
    .divider:not(:empty)::after { margin-left: .75em; }

    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #CBD5E1;
      margin-bottom: 6px;
    }
    .input-wrap {
      position: relative;
    }
    input {
      width: 100%;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      padding: 13px 14px;
      color: #FFFFFF;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input:focus {
      border-color: #3B82F6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
    }
    input[readonly] {
      opacity: 0.7;
      cursor: not-allowed;
      background: rgba(15, 23, 42, 0.4);
    }
    .toggle-pass {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      cursor: pointer;
      font-size: 16px;
      color: #94A3B8;
      user-select: none;
    }
    
    .submit-btn {
      display: block;
      width: 100%;
      background: linear-gradient(135deg, #3B82F6, #2563EB);
      color: #FFFFFF;
      border: none;
      padding: 14px 20px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 15px;
      cursor: pointer;
      margin-top: 20px;
      transition: all 0.2s;
      box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
    }
    .submit-btn:hover { background: #1D4ED8; transform: translateY(-1px); }
    .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

    .alert {
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 16px;
      display: none;
    }
    .alert-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #FCA5A5;
    }
    .alert-success {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #86EFAC;
    }
    .success-view {
      display: none;
      text-align: center;
    }
    .success-icon {
      font-size: 50px;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">🔐</div>
      <h1>Rivava TrackFi</h1>
      <p class="subtitle">Reset your account password securely</p>
    </div>

    ${hasToken ? `
    <div class="app-action-box">
      <div class="app-action-text">Have the app installed?</div>
      <a href="${appDeepLink}" class="app-btn" id="appLaunchBtn">Open App &rarr;</a>
    </div>

    <div class="divider">Or Reset on Web</div>

    <div id="alertBox" class="alert"></div>

    <form id="resetForm" onsubmit="handleFormSubmit(event)">
      <div class="form-group">
        <label>Account Email</label>
        <input type="email" id="emailInput" value="${cleanEmail}" readonly />
      </div>

      <div class="form-group">
        <label>New Password</label>
        <div class="input-wrap">
          <input type="password" id="newPassword" placeholder="At least 6 characters" minlength="6" required />
          <span class="toggle-pass" onclick="toggleVisibility('newPassword', this)">👁️</span>
        </div>
      </div>

      <div class="form-group">
        <label>Confirm New Password</label>
        <div class="input-wrap">
          <input type="password" id="confirmPassword" placeholder="Re-enter password" minlength="6" required />
          <span class="toggle-pass" onclick="toggleVisibility('confirmPassword', this)">👁️</span>
        </div>
      </div>

      <button type="submit" class="submit-btn" id="submitBtn">Update Password</button>
    </form>

    <div id="successView" class="success-view">
      <div class="success-icon">🎉</div>
      <h2 style="font-size: 20px; font-weight: 700; color: #86EFAC; margin-bottom: 8px;">Password Updated!</h2>
      <p style="font-size: 14px; color: #94A3B8; margin-bottom: 24px;">Your password has been changed successfully. You can now open the app and log in.</p>
      <a href="${appDeepLink}" class="submit-btn" style="text-decoration: none; text-align: center;">Open Rivava TrackFi</a>
    </div>
    ` : `
    <div class="alert alert-error" style="display: block;">
      Invalid or expired reset link. Please request a new password reset from the Rivava TrackFi app.
    </div>
    `}
  </div>

  <script>
    const token = "${cleanToken}";
    const email = "${cleanEmail}";
    const appDeepLink = "${appDeepLink}";
    const intentLink = "${intentLink}";

    // Automatically attempt to trigger deep link on mobile browsers
    if (token && email && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      try {
        window.location.href = intentLink;
      } catch (e) {
        window.location.href = appDeepLink;
      }
    }

    function toggleVisibility(inputId, el) {
      const input = document.getElementById(inputId);
      if (input.type === 'password') {
        input.type = 'text';
        el.style.opacity = '0.5';
      } else {
        input.type = 'password';
        el.style.opacity = '1';
      }
    }

    async function handleFormSubmit(e) {
      e.preventDefault();
      const alertBox = document.getElementById('alertBox');
      const submitBtn = document.getElementById('submitBtn');
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      alertBox.style.display = 'none';

      if (newPassword.length < 6) {
        showAlert('Password must be at least 6 characters long.', 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        showAlert('Passwords do not match. Please re-check.', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerText = 'Updating Password...';

      try {
        const response = await fetch('/api/v1/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, token, newPassword })
        });
        const data = await response.json();

        if (response.ok && data.success) {
          document.getElementById('resetForm').style.display = 'none';
          document.querySelector('.divider')?.remove();
          document.querySelector('.app-action-box')?.remove();
          document.getElementById('successView').style.display = 'block';
        } else {
          showAlert(data.message || 'Failed to reset password. The link may have expired.', 'error');
          submitBtn.disabled = false;
          submitBtn.innerText = 'Update Password';
        }
      } catch (err) {
        showAlert('Network error. Please check your internet connection.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Update Password';
      }
    }

    function showAlert(msg, type) {
      const alertBox = document.getElementById('alertBox');
      alertBox.innerText = msg;
      alertBox.className = 'alert ' + (type === 'error' ? 'alert-error' : 'alert-success');
      alertBox.style.display = 'block';
    }
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  };
}

module.exports = AuthController;
