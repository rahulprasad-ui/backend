const PaymentService = require('../services/payment.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

class PaymentController {
  /**
   * POST /api/payments/create-order
   */
  static createOrder = asyncHandler(async (req, res) => {
    const userId = req.user ? req.user.uid : req.body.userId || req.body.uid;
    const userEmail = req.user ? req.user.email : req.body.userEmail || req.body.email;
    const { plan, amountPaise, amount } = req.body;

    if (!userId) {
      throw ApiError.badRequest('User ID is required.');
    }

    const calculatedPaise = amountPaise || (amount ? amount * 100 : 1100);

    const order = await PaymentService.createOrder({
      userId,
      userEmail,
      plan: plan || 'portfolio_premium',
      amountPaise: calculatedPaise
    });

    return ApiResponse.created(res, order, 'Payment order created successfully.');
  });

  /**
   * POST /api/payments/verify
   * Secure server-side payment verification endpoint.
   */
  static verifyPayment = asyncHandler(async (req, res) => {
    const userId = req.user ? req.user.uid : req.body.userId || req.body.uid;
    const orderId = req.body.order_id || req.body.orderId;
    const paymentId = req.body.payment_id || req.body.paymentId || req.body.razorpay_payment_id;
    const signature = req.body.signature || req.body.razorpay_signature;

    if (!userId) {
      throw ApiError.badRequest('User ID is required.');
    }
    if (!orderId) {
      throw ApiError.badRequest('Order ID is required.');
    }

    const result = await PaymentService.verifyPayment({
      userId,
      orderId,
      paymentId,
      signature
    });

    return ApiResponse.ok(res, result, result.message || 'Payment verified and premium unlocked.');
  });

  /**
   * POST /api/payments/webhook
   * Webhook listener for payment gateway callbacks.
   */
  static handleWebhook = asyncHandler(async (req, res) => {
    const signatureHeader = req.headers['x-razorpay-signature'] || req.headers['x-webhook-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    const result = await PaymentService.processWebhook({
      rawBody,
      signatureHeader,
      eventPayload: req.body
    });

    return res.status(200).json(result);
  });

  /**
   * GET /api/payments/history
   */
  static getHistory = asyncHandler(async (req, res) => {
    const userId = req.user ? req.user.uid : req.query.userId || req.query.uid;
    if (!userId) {
      throw ApiError.badRequest('User ID is required.');
    }

    const history = await PaymentService.getPaymentsByUser(userId);
    return ApiResponse.ok(res, history, 'Payment history retrieved.');
  });

  /**
   * GET /pay/:orderId
   * Web-based Razorpay checkout and verification interface.
   */
  static renderCheckoutPage = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { admin } = require('../config/firebase');
    const config = require('../config/env');

    const orderDoc = await admin.firestore().collection('payments').doc(orderId).get();
    if (!orderDoc.exists) {
      return res.status(404).send(`
        <!DOCTYPE html><html><head><meta charset="utf-8"><title>Order Not Found</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>body{background:#0a0a0a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}</style>
        </head><body><div style="text-align:center;"><h2>Order Not Found</h2><p>The order ID is invalid or has expired.</p></div></body></html>
      `);
    }

    const order = orderDoc.data();
    const isElite = (order.plan && order.plan.toLowerCase().includes('elite')) || order.amountPaise === 39900;
    const keyId = config.paymentGateway.keyId || 'rzp_test_Tiaq1UtYWGxArt';
    const amount = order.amount || (order.amountPaise ? order.amountPaise / 100 : 399);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rivava TrackFi - Secure Checkout</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    :root {
      --bg: #07090e;
      --card-bg: rgba(18, 22, 33, 0.85);
      --gold: #d4af37;
      --gold-gradient: linear-gradient(135deg, #d4af37 0%, #f3e5ab 50%, #aa771c 100%);
      --emerald: #10b981;
      --text: #ffffff;
      --text-muted: #94a3b8;
      --border: rgba(212, 175, 55, 0.25);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at 50% 20%, #151a2b 0%, var(--bg) 100%);
      font-family: 'Outfit', sans-serif;
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .checkout-card {
      background: var(--card-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      border-radius: 24px;
      width: 100%;
      max-width: 440px;
      padding: 32px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 40px rgba(212, 175, 55, 0.1);
      position: relative;
      overflow: hidden;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .brand-logo {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: var(--gold-gradient);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      color: #000;
      font-size: 20px;
      box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
    }
    .brand-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background: rgba(212, 175, 55, 0.15);
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 100px;
      color: var(--gold);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    .plan-title {
      font-size: 26px;
      font-weight: 800;
      margin-bottom: 8px;
    }
    .plan-desc {
      color: var(--text-muted);
      font-size: 14px;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .price-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .price-label {
      color: var(--text-muted);
      font-size: 13px;
    }
    .price-value {
      font-size: 32px;
      font-weight: 800;
      color: var(--gold);
    }
    .features-list {
      list-style: none;
      margin-bottom: 28px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .features-list li {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.85);
    }
    .features-list li svg {
      width: 18px;
      height: 18px;
      fill: var(--emerald);
      flex-shrink: 0;
    }
    .btn-pay {
      width: 100%;
      padding: 16px;
      border: none;
      border-radius: 14px;
      background: var(--gold-gradient);
      color: #000;
      font-size: 16px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 8px 25px rgba(212, 175, 55, 0.35);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .btn-pay:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 30px rgba(212, 175, 55, 0.5);
    }
    .btn-pay:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    .secure-note {
      text-align: center;
      margin-top: 16px;
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .status-overlay {
      display: none;
      text-align: center;
      padding: 20px 0;
    }
    .success-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.15);
      border: 2px solid var(--emerald);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }
    .success-icon svg {
      width: 36px;
      height: 36px;
      fill: var(--emerald);
    }
  </style>
</head>
<body>
  <div class="checkout-card" id="card">
    <div class="brand">
      <div class="brand-logo">R</div>
      <div class="brand-title">Rivava TrackFi</div>
    </div>

    <div id="checkout-view">
      <span class="badge">${isElite ? '👑 Elite Membership' : '⭐ Portfolio Premium'}</span>
      <h1 class="plan-title">${isElite ? 'Rivava Elite Club' : 'Rivava Portfolio'}</h1>
      <p class="plan-desc">${isElite ? 'Complete 1-on-1 Wealth Advisory, 600 monthly minutes, priority support & full portfolio access.' : 'Unlock institutional grade portfolio analytics and automated trade tracking.'}</p>

      <div class="price-box">
        <div>
          <div class="price-label">Total Due</div>
          <div style="color: #64748b; font-size: 12px;">One-time access</div>
        </div>
        <div class="price-value">₹${amount}</div>
      </div>

      <ul class="features-list">
        <li>
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          ${isElite ? '600 Monthly Advisory Minutes' : 'Real-time Portfolio Performance Tracking'}
        </li>
        <li>
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          ${isElite ? '1-on-1 Video Consultation with Wealth Manager' : 'Automated Stock, MF & Crypto P&L'}
        </li>
        <li>
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          Instant Server-Side Verification & Activation
        </li>
      </ul>

      <button id="pay-btn" class="btn-pay" onclick="startRazorpayPayment()">
        <span>Pay ₹${amount} with Razorpay</span>
      </button>

      <div class="secure-note">
        🔒 256-bit Encrypted SSL • Official Razorpay Gateway
      </div>
    </div>

    <div id="status-view" class="status-overlay">
      <div class="success-icon">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
      </div>
      <h2 style="font-size: 24px; margin-bottom: 8px; color: #10b981;">Payment Verified!</h2>
      <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 24px;" id="status-desc">
        ${isElite ? 'Your Rivava Elite membership and Premium features have been unlocked!' : 'Your Rivava Portfolio Premium has been successfully activated!'}
      </p>
      <div style="background: rgba(255,255,255,0.05); padding: 14px; border-radius: 12px; font-size: 13px; color: #94a3b8; margin-bottom: 20px;">
        Order ID: <b style="color: #fff;">${orderId}</b><br>
        Status: <b style="color: #10b981;">ACTIVE & VERIFIED</b>
      </div>
      <a href="rivavafi://payment-success?orderId=${orderId}" style="display: block; width: 100%; text-decoration: none;">
        <button class="btn-pay" style="width: 100%;">Return to Rivava App</button>
      </a>
    </div>
  </div>

  <script>
    const orderData = {
      orderId: '${orderId}',
      keyId: '${keyId}',
      amountPaise: ${order.amountPaise || 39900},
      userId: '${order.userId || ''}',
      userEmail: '${order.userEmail || ''}',
      plan: '${order.plan || 'elite_399'}'
    };

    function startRazorpayPayment() {
      const btn = document.getElementById('pay-btn');
      btn.disabled = true;
      btn.innerText = 'Opening Gateway...';

      const options = {
        key: orderData.keyId,
        amount: orderData.amountPaise,
        currency: 'INR',
        name: 'Rivava TrackFi',
        description: '${isElite ? 'Rivava Elite Membership' : 'Rivava Portfolio Premium'}',
        order_id: orderData.orderId,
        prefill: {
          email: orderData.userEmail || 'user@rivava.in',
          contact: ''
        },
        theme: {
          color: '#d4af37'
        },
        handler: async function (response) {
          btn.innerText = 'Verifying Payment...';
          try {
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: orderData.userId,
                orderId: orderData.orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature
              })
            });

            const resData = await verifyRes.json();
            if (verifyRes.ok && resData.success) {
              document.getElementById('checkout-view').style.display = 'none';
              document.getElementById('status-view').style.display = 'block';
            } else {
              alert('Payment Verification Issue: ' + (resData.message || 'Please contact support.'));
              btn.disabled = false;
              btn.innerText = 'Try Again';
            }
          } catch (e) {
            alert('Verification network error: ' + e.message);
            btn.disabled = false;
            btn.innerText = 'Try Again';
          }
        },
        modal: {
          ondismiss: function () {
            btn.disabled = false;
            btn.innerText = 'Pay ₹${amount} with Razorpay';
          }
        }
      };

      const rzp = new Razorpay(options);
      rzp.on('payment.failed', function (response) {
        alert('Payment Failed: ' + (response.error.description || 'Payment was declined.'));
        btn.disabled = false;
        btn.innerText = 'Pay ₹${amount} with Razorpay';
      });
      rzp.open();
    }
  </script>
</body>
</html>`;

    return res.status(200).send(html);
  });
}

module.exports = PaymentController;
