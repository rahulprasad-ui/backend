const db = require('../src/config/database');

async function runAudit() {
  console.log('==============================================');
  console.log('     TURSO CLOUD SQLITE DATABASE AUDIT        ');
  console.log('==============================================');

  // 1. Check Tables
  const tablesRes = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
  console.log(`\n✔ Total Tables on Turso Cloud: ${tablesRes.rows.length}`);
  tablesRes.rows.forEach((t, i) => console.log(`  [${i + 1}] Table: ${t.name}`));

  // 2. Check Indices
  const indicesRes = await db.execute("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';");
  console.log('\n✔ Indexes Created for Performance:');
  indicesRes.rows.forEach(idx => console.log(`  - Index "${idx.name}" on table "${idx.tbl_name}"`));

  // 3. Test Live Table CRUD Operations
  console.log('\n==============================================');
  console.log('    RUNNING CLOUD CRUD VERIFICATION TESTS     ');
  console.log('==============================================');

  const testUid = 'turso_audit_user_' + Date.now();

  // Test 1: User Table CRUD
  await db.execute({
    sql: `
      INSERT INTO users (id, email, phone, name, is_premium, premium_status, premium_plan)
      VALUES (?, ?, ?, ?, 1, 'active', 'elite_pro')
    `,
    args: [testUid, 'cloud-test@rivava.in', '+919999988888', 'Turso Cloud Tester']
  });

  const fetchedUser = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [testUid] })).rows[0];
  console.log(`✔ [1/6] Users Table on Turso: PASSED (Found: ${fetchedUser.name}, Plan: ${fetchedUser.premium_plan})`);

  // Test 2: OTP Table
  await db.execute({
    sql: 'INSERT INTO otps (phone, otp, attempts, resend_count, created_at, expires_at) VALUES (?, ?, 0, 0, ?, ?)',
    args: ['+919999988888', '654321', Date.now(), Date.now() + 600000]
  });
  const fetchedOtp = (await db.execute({ sql: 'SELECT * FROM otps WHERE phone = ?', args: ['+919999988888'] })).rows[0];
  console.log(`✔ [2/6] OTP Table on Turso: PASSED (OTP: ${fetchedOtp.otp})`);

  // Test 3: Payments Table
  const testOrderId = 'order_turso_' + Date.now();
  await db.execute({
    sql: 'INSERT INTO payments (order_id, user_id, amount, amount_paise, currency, status, created_at) VALUES (?, ?, 11.0, 1100, \'INR\', \'created\', ?)',
    args: [testOrderId, testUid, Date.now()]
  });
  const fetchedPayment = (await db.execute({ sql: 'SELECT * FROM payments WHERE order_id = ?', args: [testOrderId] })).rows[0];
  console.log(`✔ [3/6] Payments Table on Turso: PASSED (Amount: Rs. ${fetchedPayment.amount})`);

  // Test 4: Secret Keys Table
  const testKey = 'RIV-TURSO-2026';
  await db.execute({
    sql: 'INSERT INTO secret_keys (key_string, tier, max_uses, current_uses, is_active, created_at) VALUES (?, \'PRO\', 5, 0, 1, ?)',
    args: [testKey, Date.now()]
  });
  const fetchedKey = (await db.execute({ sql: 'SELECT * FROM secret_keys WHERE key_string = ?', args: [testKey] })).rows[0];
  console.log(`✔ [4/6] Secret Keys Table on Turso: PASSED (Key: ${fetchedKey.key_string})`);

  // Test 5: Elite Subscriptions Table
  await db.execute({
    sql: 'INSERT INTO elite_subscriptions (user_id, is_elite, plan, minutes_remaining, monthly_minutes, auto_renew, payment_status, updated_at) VALUES (?, 1, \'elite_3300\', 600, 600, 1, \'active\', ?)',
    args: [testUid, Date.now()]
  });
  const fetchedSub = (await db.execute({ sql: 'SELECT * FROM elite_subscriptions WHERE user_id = ?', args: [testUid] })).rows[0];
  console.log(`✔ [5/6] Elite Subscriptions on Turso: PASSED (Minutes: ${fetchedSub.minutes_remaining})`);

  // Test 6: FCM Tokens Table
  await db.execute({
    sql: 'INSERT INTO fcm_tokens (user_id, token, device, updated_at) VALUES (?, \'mock_fcm_token_turso\', \'Android S24\', ?)',
    args: [testUid, Date.now()]
  });
  const fetchedToken = (await db.execute({ sql: 'SELECT * FROM fcm_tokens WHERE user_id = ?', args: [testUid] })).rows[0];
  console.log(`✔ [6/6] FCM Tokens on Turso: PASSED (Device: ${fetchedToken.device})`);

  // Cleanup test records
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [testUid] });
  await db.execute({ sql: 'DELETE FROM otps WHERE phone = ?', args: ['+919999988888'] });
  await db.execute({ sql: 'DELETE FROM payments WHERE order_id = ?', args: [testOrderId] });
  await db.execute({ sql: 'DELETE FROM secret_keys WHERE key_string = ?', args: [testKey] });
  await db.execute({ sql: 'DELETE FROM elite_subscriptions WHERE user_id = ?', args: [testUid] });
  await db.execute({ sql: 'DELETE FROM fcm_tokens WHERE user_id = ?', args: [testUid] });

  console.log('\n==============================================');
  console.log('   TURSO CLOUD SQLITE 100% OPERATIONAL! 🎉    ');
  console.log('==============================================');
}

runAudit().catch(console.error);
