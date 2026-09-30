const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { createClient } = require('@libsql/client');
const logger = require('../utils/logger');

const url = process.env.TURSO_DATABASE_URL || 'libsql://rivava-db-rahulprasad-ui.aws-ap-south-1.turso.io';
const authToken = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTA3NjA3MzEsImlkIjoiMDFhMGYxYTctNzgwMS03MzQ2LTgyNzctZGZmZTRlNGM0YjM2Iiwia2lkIjoid3lyWlJCeGpGYmdfbnk1cV96WEhYVFpaOWFzVzFMLU03TlNVNFVRRkd5USIsInJpZCI6IjkzOGU4NzQ3LWQwMWUtNDU4Ny1iOTJmLWY0MWIwNGY3ZTlmZiJ9.KIzNo1oXgCbxikR_gGl1ygZ1z0K3o0FBt0RhMKfKfI-GrbsKWX9-M2bqBvUYHGtbtZXvH6wWMczEiGeqRKV2Cg';

const db = createClient({
  url,
  authToken
});

async function initSchema() {
  try {
    await db.batch([
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        phone TEXT UNIQUE,
        name TEXT DEFAULT '',
        is_premium INTEGER DEFAULT 0,
        premium_status TEXT DEFAULT 'inactive',
        premium_source TEXT,
        premium_plan TEXT DEFAULT 'free',
        premium_unlocked_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )`,
      `CREATE TABLE IF NOT EXISTS otps (
        phone TEXT PRIMARY KEY,
        otp TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        resend_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS password_resets (
        email TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS payments (
        order_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_email TEXT,
        plan TEXT DEFAULT 'portfolio_premium',
        amount REAL NOT NULL,
        amount_paise INTEGER NOT NULL,
        currency TEXT DEFAULT 'INR',
        status TEXT DEFAULT 'created',
        payment_id TEXT,
        signature TEXT,
        gateway_provider TEXT DEFAULT 'razorpay',
        created_at INTEGER NOT NULL,
        verified_at INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS secret_keys (
        key_string TEXT PRIMARY KEY,
        tier TEXT DEFAULT 'PRO',
        max_uses INTEGER DEFAULT 1,
        current_uses INTEGER DEFAULT 0,
        assigned_email TEXT,
        expires_at INTEGER,
        notes TEXT,
        created_by TEXT,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS secret_key_redemptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_string TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_email TEXT,
        redeemed_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS elite_subscriptions (
        user_id TEXT PRIMARY KEY,
        is_elite INTEGER DEFAULT 0,
        plan TEXT DEFAULT 'free',
        minutes_remaining INTEGER DEFAULT 0,
        monthly_minutes INTEGER DEFAULT 0,
        auto_renew INTEGER DEFAULT 0,
        next_billing_date INTEGER,
        payment_status TEXT DEFAULT 'inactive',
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS elite_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        duration INTEGER NOT NULL,
        date_millis INTEGER NOT NULL,
        time_slot TEXT NOT NULL,
        status TEXT DEFAULT 'booked',
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS fcm_tokens (
        user_id TEXT NOT NULL,
        token TEXT PRIMARY KEY,
        device TEXT DEFAULT 'Android',
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
      `CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`,
      `CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_fcm_user_id ON fcm_tokens(user_id)`
    ]);
    logger.info('Turso Cloud SQLite database schema initialized successfully!');
  } catch (err) {
    logger.error('Error initializing Turso schema:', err);
  }
}

initSchema();

module.exports = db;
