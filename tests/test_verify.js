const axios = require('axios');
const crypto = require('crypto');

async function test() {
  const orderId = 'order_TidkUqWOCyvBrC';
  const paymentId = 'pay_test12345';
  const secret = 'ibx3fQIH73SJjAUS5713R4Wo';
  const signature = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

  console.log('Sending signature:', signature);
  try {
    const res = await axios.post('https://backend-453t.onrender.com/api/payments/verify', {
      userId: 'test_user_debug',
      orderId: orderId,
      paymentId: paymentId,
      signature: signature
    });
    console.log('VERIFY RES:', res.data);
  } catch (err) {
    console.error('VERIFY ERR:', err.response ? err.response.data : err.message);
  }
}

test();
