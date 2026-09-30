const test = require('node:test');
const assert = require('node:assert/strict');
const PaymentService = require('../src/services/payment.service');

test('PaymentService - signature generation and cryptographic verification', () => {
  const orderId = 'order_test_12345';
  const paymentId = 'pay_test_67890';
  const secret = 'test_secret_key_12345';

  const signature = PaymentService.generateSignature(orderId, paymentId, secret);
  assert.ok(signature && signature.length === 64, 'Signature must be a 64-char hex string');

  const isValid = PaymentService.verifySignature(orderId, paymentId, signature, secret);
  assert.equal(isValid, true, 'Valid signature must verify successfully');

  const isTampered = PaymentService.verifySignature(orderId, 'pay_tampered_999', signature, secret);
  assert.equal(isTampered, false, 'Tampered paymentId must be rejected');

  const isBadSignature = PaymentService.verifySignature(orderId, paymentId, '0000000000000000000000000000000000000000000000000000000000000000', secret);
  assert.equal(isBadSignature, false, 'Bad signature must be rejected');
});

test('PaymentService - validation rejects missing parameters', async () => {
  await assert.rejects(
    async () => {
      await PaymentService.createOrder({ userId: null });
    },
    /User ID is required/
  );

  await assert.rejects(
    async () => {
      await PaymentService.verifyPayment({ userId: null, orderId: 'ord_1' });
    },
    /User ID and Order ID are required/
  );
});
