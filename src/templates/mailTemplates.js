/**
 * Professional HTML and Plain Text templates for Rivava / TrackFi emails
 */

const BRAND_COLOR_PRIMARY = '#2563EB'; // Vibrant Blue
const BRAND_COLOR_DARK = '#0F172A';    // Slate 900
const BRAND_BG = '#F8FAFC';            // Light Slate

const getWelcomeEmailHtml = (email, name = '') => {
    const greeting = name && name.trim() ? `Hello ${name.trim()},` : 'Hello,';
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Rivava</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND_BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${BRAND_BG}; padding: 40px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #E2E8F0;" cellspacing="0" cellpadding="0" border="0">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); padding: 36px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
                                Rivava <span style="color: #38BDF8;">TrackFi</span>
                            </h1>
                            <p style="margin: 8px 0 0 0; color: #94A3B8; font-size: 14px;">Smart Financial Intelligence & Expense Tracking</p>
                        </td>
                    </tr>
                    <!-- Main Body -->
                    <tr>
                        <td style="padding: 36px 30px;">
                            <h2 style="margin: 0 0 16px 0; color: #0F172A; font-size: 22px; font-weight: 700;">Welcome to the family! 🎉</h2>
                            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #475569;">
                                ${greeting}
                            </p>
                            <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #475569;">
                                Thank you for creating an account with Rivava. We're thrilled to have you onboard! Your account (<strong style="color: #0F172A;">${email}</strong>) is now active and ready to help you take full control of your finances.
                            </p>

                            <!-- Feature highlights card -->
                            <table role="presentation" width="100%" style="background-color: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0; margin-bottom: 28px;" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #1E293B; text-transform: uppercase; letter-spacing: 0.5px;">Here is what you can do next:</p>
                                        <ul style="margin: 0; padding-left: 20px; font-size: 15px; color: #475569; line-height: 1.7;">
                                            <li><strong style="color: #1E293B;">Automated Tracking:</strong> Gain real-time insights from your transactions with SMS intelligence.</li>
                                            <li><strong style="color: #1E293B;">Budget Management:</strong> Set proactive limits and receive spending alerts.</li>
                                            <li><strong style="color: #1E293B;">Bank-grade Security:</strong> Your data remains confidential and protected with enterprise encryption.</li>
                                        </ul>
                                    </td>
                                </tr>
                            </table>

                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0 20px 0;">
                                        <a href="https://rivava.in" target="_blank" style="display: inline-block; background-color: #2563EB; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 700; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
                                            Open Rivava Dashboard &rarr;
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #64748B;">
                                If you have any questions or need assistance getting started, feel free to reply directly to this email or reach out to our team at <a href="mailto:support@rivava.in" style="color: #2563EB; text-decoration: none;">support@rivava.in</a>.
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #F1F5F9; padding: 24px 30px; text-align: center; border-top: 1px solid #E2E8F0;">
                            <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748B;">&copy; ${new Date().getFullYear()} Rivava Universal. All rights reserved.</p>
                            <p style="margin: 0; font-size: 12px; color: #94A3B8;">This is an automated system email sent to ${email}.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
};

const getWelcomeEmailText = (email, name = '') => {
    const greeting = name && name.trim() ? `Hello ${name.trim()},` : 'Hello,';
    return `Welcome to Rivava TrackFi!

${greeting}

Thank you for creating an account with Rivava. We're thrilled to have you onboard!
Your account (${email}) is now active and ready to help you take full control of your finances.

Here is what you can do:
- Automated Tracking: Gain real-time insights from your transactions.
- Budget Management: Set proactive limits and receive spending alerts.
- Bank-grade Security: Your financial data is securely encrypted.

Explore your dashboard at: https://rivava.in

Need help? Contact our support team at support@rivava.in

Best regards,
The Rivava Team
© ${new Date().getFullYear()} Rivava Universal. All rights reserved.`;
};

const getVerificationEmailHtml = (email, verifyLink) => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - Rivava</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND_BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${BRAND_BG}; padding: 40px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #E2E8F0;" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                        <td style="background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); padding: 36px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
                                Rivava <span style="color: #38BDF8;">TrackFi</span>
                            </h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 36px 30px;">
                            <h2 style="margin: 0 0 16px 0; color: #0F172A; font-size: 22px; font-weight: 700;">Verify your email address</h2>
                            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #475569;">
                                Please confirm your email address (<strong style="color: #0F172A;">${email}</strong>) to complete your registration and activate your account.
                            </p>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center" style="padding: 20px 0 25px 0;">
                                        <a href="${verifyLink}" target="_blank" style="display: inline-block; background-color: #2563EB; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 700; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
                                            Confirm Email Address
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748B; line-height: 1.5;">
                                This link will expire in <strong>15 minutes</strong>. If the button above doesn't work, copy and paste this link into your browser:
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 13px; color: #2563EB; word-break: break-all;">
                                <a href="${verifyLink}" style="color: #2563EB;">${verifyLink}</a>
                            </p>
                            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
                            <p style="margin: 0; font-size: 13px; color: #94A3B8; line-height: 1.5;">
                                If you did not create a Rivava account, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #F1F5F9; padding: 20px 30px; text-align: center; border-top: 1px solid #E2E8F0;">
                            <p style="margin: 0; font-size: 12px; color: #64748B;">&copy; ${new Date().getFullYear()} Rivava Universal. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
};

const getVerificationEmailText = (email, verifyLink) => {
    return `Verify your email for Rivava TrackFi

Please confirm your email address (${email}) to complete your registration by visiting the link below:

${verifyLink}

This link is valid for 15 minutes.

If you didn't create an account, you can safely ignore this email.

Best regards,
The Rivava Team
© ${new Date().getFullYear()} Rivava Universal`;
};

const getLoginNotificationEmailHtml = (email, name = '', details = {}) => {
    const greeting = name && name.trim() ? `Hello ${name.trim()},` : 'Hello,';
    const timestamp = details.timestamp || new Date().toUTCString();
    const ipAddress = details.ip || 'Unknown IP';
    const device = details.device || 'Android App';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Login to Rivava</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND_BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${BRAND_BG}; padding: 40px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #E2E8F0;" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                        <td style="background: #1E293B; padding: 24px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
                                Rivava Security Alert
                            </h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px;">
                            <h2 style="margin: 0 0 14px 0; color: #0F172A; font-size: 18px; font-weight: 700;">New Login Detected</h2>
                            <p style="margin: 0 0 16px 0; font-size: 15px; color: #475569; line-height: 1.6;">
                                ${greeting} your account (<strong style="color: #0F172A;">${email}</strong>) was just logged into.
                            </p>
                            <table role="presentation" width="100%" style="background-color: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0; margin-bottom: 20px;" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td style="padding: 16px; font-size: 14px; color: #475569; line-height: 1.8;">
                                        <strong>Time:</strong> ${timestamp}<br/>
                                        <strong>Device:</strong> ${device}<br/>
                                        <strong>IP:</strong> ${ipAddress}
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0; font-size: 13px; color: #64748B; line-height: 1.6;">
                                If this was you, no action is needed. If you did not log in, please reset your password immediately or contact <a href="mailto:support@rivava.in" style="color: #2563EB;">support@rivava.in</a>.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
};

const getLoginNotificationEmailText = (email, name = '', details = {}) => {
    const greeting = name && name.trim() ? `Hello ${name.trim()},` : 'Hello,';
    const timestamp = details.timestamp || new Date().toUTCString();
    const device = details.device || 'Android App';

    return `Rivava Security Alert - New Login

${greeting}

A new login was detected on your account (${email}).
Time: ${timestamp}
Device: ${device}

If this was you, no action is needed.
If you did not perform this login, please reset your password immediately or contact support@rivava.in.

© ${new Date().getFullYear()} Rivava Universal`;
};

const getPasswordResetEmailHtml = (email, resetLink, name = '') => {
    const greeting = name && name.trim() ? `Hello ${name.trim()},` : 'Hello,';
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password - Rivava TrackFi</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F8FAFC; padding: 40px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #E2E8F0;" cellspacing="0" cellpadding="0" border="0">
                    <!-- Header (Identical to New Login Alert) -->
                    <tr>
                        <td style="background: #1E293B; padding: 24px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
                                Rivava <span style="color: #38BDF8;">TrackFi</span>
                            </h1>
                        </td>
                    </tr>
                    <!-- Main Body -->
                    <tr>
                        <td style="padding: 30px;">
                            <h2 style="margin: 0 0 14px 0; color: #0F172A; font-size: 18px; font-weight: 700;">Password Reset Request</h2>
                            <p style="margin: 0 0 16px 0; font-size: 15px; color: #475569; line-height: 1.6;">
                                ${greeting} We received a request to reset the password for your Rivava TrackFi account (<strong style="color: #0F172A;">${email}</strong>).
                            </p>
                            <!-- Info Box (Same as New Login Alert) -->
                            <table role="presentation" width="100%" style="background-color: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0; margin-bottom: 20px;" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td style="padding: 16px; font-size: 14px; color: #475569; line-height: 1.8;">
                                        <strong>Account:</strong> ${email}<br/>
                                        <strong>Action:</strong> Password Reset<br/>
                                        <strong>Validity:</strong> 15 minutes
                                    </td>
                                </tr>
                            </table>

                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0 24px 0;">
                                        <a href="${resetLink}" target="_blank" style="display: inline-block; background-color: #2563EB; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 700;">
                                            Reset Password
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 14px 0; font-size: 13px; color: #64748B; line-height: 1.6;">
                                If you did not request this password reset, no action is required. Your account remains secure.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #94A3B8; line-height: 1.5; word-break: break-all;">
                                If the button doesn't work, open this link: <a href="${resetLink}" style="color: #2563EB;">${resetLink}</a>
                            </p>
                        </td>
                    </tr>
                    <!-- Footer (Identical to New Login Alert) -->
                    <tr>
                        <td style="background-color: #F1F5F9; padding: 20px 30px; text-align: center; border-top: 1px solid #E2E8F0;">
                            <p style="margin: 0; font-size: 12px; color: #94A3B8;">&copy; ${new Date().getFullYear()} Rivava Universal. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
};

const getPasswordResetEmailText = (email, resetLink, name = '') => {
    const greeting = name && name.trim() ? `Hello ${name.trim()},` : 'Hello,';
    return `Rivava TrackFi - Password Reset Request

${greeting}

We received a request to reset the password for your Rivava account (${email}).

Reset your password by opening the link below:
${resetLink}

- This link is valid for 15 minutes.
- If you did not make this request, please ignore this email.

© ${new Date().getFullYear()} Rivava Universal`;
};

const getOtpEmailHtml = (recipient, otp) => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Rivava Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F8FAFC; padding: 40px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #E2E8F0;" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                        <td style="background: #1E293B; padding: 24px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
                                Rivava <span style="color: #38BDF8;">TrackFi</span>
                            </h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px; text-align: center;">
                            <h2 style="margin: 0 0 14px 0; color: #0F172A; font-size: 20px; font-weight: 700;">Your Verification Code</h2>
                            <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569; line-height: 1.6;">
                                Use the following 6-digit One-Time Password (OTP) to complete your verification:
                            </p>
                            <div style="display: inline-block; background-color: #F1F5F9; border: 2px dashed #2563EB; border-radius: 12px; padding: 16px 36px; margin: 10px 0 24px 0;">
                                <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2563EB; font-family: monospace;">${otp}</span>
                            </div>
                            <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748B;">
                                This OTP is valid for <strong>10 minutes</strong>. Do not share this code with anyone.
                            </p>
                            <p style="margin: 0; font-size: 13px; color: #94A3B8;">
                                If you did not request this verification code, please ignore this email.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #F1F5F9; padding: 20px 30px; text-align: center; border-top: 1px solid #E2E8F0;">
                            <p style="margin: 0; font-size: 12px; color: #94A3B8;">&copy; ${new Date().getFullYear()} Rivava Universal. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
};

const getOtpEmailText = (recipient, otp) => {
    return `Rivava TrackFi - Verification Code

Your One-Time Password (OTP) is: ${otp}

This code is valid for 10 minutes. Please do not share this code with anyone.

If you did not request this code, you can safely ignore this email.

© ${new Date().getFullYear()} Rivava Universal`;
};

module.exports = {
    getWelcomeEmailHtml,
    getWelcomeEmailText,
    getVerificationEmailHtml,
    getVerificationEmailText,
    getLoginNotificationEmailHtml,
    getLoginNotificationEmailText,
    getPasswordResetEmailHtml,
    getPasswordResetEmailText,
    getOtpEmailHtml,
    getOtpEmailText
};