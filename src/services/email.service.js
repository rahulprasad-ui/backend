const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const config = require('../config/env');
const logger = require('../utils/logger');
const {
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
} = require('../templates/mailTemplates');

class EmailService {
  /**
   * Dispatches email:
   * 1. Uses Resend API for REAL live inboxes if RESEND_API_KEY is configured.
   * 2. Fallbacks to SMTP (if configured) or local dev simulation.
   * @param {Object} options
   * @param {string|string[]} options.to
   * @param {string} options.subject
   * @param {string} options.text
   * @param {string} options.html
   * @returns {Promise<boolean>}
   */
  static async sendMailInternal({ to, subject, text, html }) {
    const resendKey = config.resend.apiKey;
    const recipientList = Array.isArray(to) ? to : [to];

    // 1. Primary: Resend API (Sends to REAL Gmail / Outlook inboxes)
    if (resendKey) {
      try {
        const resend = new Resend(resendKey);
        const { data, error } = await resend.emails.send({
          from: config.resend.from,
          to: recipientList,
          subject,
          text,
          html
        });

        if (error) {
          logger.error(`[Resend] Delivery Error for ${to}:`, error.message || error);
        } else if (data && data.id) {
          logger.info(`[Resend] Real email dispatched successfully to ${to}. ID: ${data.id}`);
          return true;
        }
      } catch (resendErr) {
        logger.error(`[Resend] Exception dispatching email to ${to}:`, resendErr.message || resendErr);
      }
    }

    // 2. Secondary: SMTP Transport (If custom SMTP host is set)
    if (config.smtp.host && config.smtp.auth.user) {
      try {
        const smtpTransporter = nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          auth: {
            user: config.smtp.auth.user,
            pass: config.smtp.auth.pass
          }
        });

        const info = await smtpTransporter.sendMail({
          from: config.smtp.from,
          to: recipientList.join(', '),
          subject,
          text,
          html
        });

        logger.info(`[SMTP] Email sent to ${to}. Message ID: ${info.messageId}`);
        return true;
      } catch (smtpErr) {
        logger.error(`[SMTP] Error sending email to ${to}:`, smtpErr.message || smtpErr);
      }
    }

    // 3. Fallback: Local Simulation Log
    logger.warn(`[DEV SIMULATION] Email to ${to} with subject: "${subject}" processed.`);
    return true;
  }

  static async sendWelcomeEmail(email, name = '') {
    if (!email) return false;
    return this.sendMailInternal({
      to: email,
      subject: 'Welcome to Rivava TrackFi 🎉',
      text: getWelcomeEmailText(email, name),
      html: getWelcomeEmailHtml(email, name)
    });
  }

  static async sendVerificationEmail(email, verifyLink) {
    if (!email || !verifyLink) return false;
    return this.sendMailInternal({
      to: email,
      subject: 'Verify your email for Rivava TrackFi',
      text: getVerificationEmailText(email, verifyLink),
      html: getVerificationEmailHtml(email, verifyLink)
    });
  }

  static async sendLoginAlert(email, name = '', details = {}) {
    if (!email) return false;
    return this.sendMailInternal({
      to: email,
      subject: 'Rivava Security Alert: New Login Detected',
      text: getLoginNotificationEmailText(email, name, details),
      html: getLoginNotificationEmailHtml(email, name, details)
    });
  }

  static async sendPasswordResetEmail(email, resetLink, name = '') {
    if (!email || !resetLink) return false;
    return this.sendMailInternal({
      to: email,
      subject: 'Reset Your Password - Rivava TrackFi 🔐',
      text: getPasswordResetEmailText(email, resetLink, name),
      html: getPasswordResetEmailHtml(email, resetLink, name)
    });
  }

  static async sendOtpEmail(email, otp) {
    if (!email || !otp) return false;
    return this.sendMailInternal({
      to: email,
      subject: `Your Rivava TrackFi Verification Code: ${otp}`,
      text: getOtpEmailText(email, otp),
      html: getOtpEmailHtml(email, otp)
    });
  }
}

module.exports = EmailService;
