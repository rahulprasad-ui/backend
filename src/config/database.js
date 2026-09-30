const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const logger = require('../utils/logger');

// Ensure data directory exists
const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'rivava.sqlite');
const db = new Database(dbPath);

// Enable WAL mode for high performance concurrent reads and writes
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
function initSchema() {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
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
    );

    -- OTP storage table
    CREATE TABLE IF NOT EXISTS otps (
      phone TEXT PRIMARY KEY,
      otp TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      resend_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    -- Password reset tokens
    CREATE TABLE IF NOT EXISTS password_resets (
      email TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    -- Payment orders & records
    CREATE TABLE IF NOT EXISTS payments (
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
    );

    -- Secret activation keys (Lifetime / Elite Access)
    CREATE TABLE IF NOT EXISTS secret_keys (
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
    );

    -- Secret key redemptions history
    CREATE TABLE IF NOT EXISTS secret_key_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_string TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_email TEXT,
      redeemed_at INTEGER NOT NULL,
      FOREIGN KEY (key_string) REFERENCES secret_keys(key_string) ON DELETE CASCADE
    );

    -- Elite Membership & Booking Sessions
    CREATE TABLE IF NOT EXISTS elite_subscriptions (
      user_id TEXT PRIMARY KEY,
      is_elite INTEGER DEFAULT 0,
      plan TEXT DEFAULT 'free',
      minutes_remaining INTEGER DEFAULT 0,
      monthly_minutes INTEGER DEFAULT 0,
      auto_renew INTEGER DEFAULT 0,
      next_billing_date INTEGER,
      payment_status TEXT DEFAULT 'inactive',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS elite_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      duration INTEGER NOT NULL,
      date_millis INTEGER NOT NULL,
      time_slot TEXT NOT NULL,
      status TEXT DEFAULT 'booked',
      created_at INTEGER NOT NULL
    );

    -- FCM Push Notification Device Tokens
    CREATE TABLE IF NOT EXISTS fcm_tokens (
      user_id TEXT NOT NULL,
      token TEXT PRIMARY KEY,
      device TEXT DEFAULT 'Android',
      updated_at INTEGER NOT NULL
    );

    -- Indices for quick lookup
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_fcm_user_id ON fcm_tokens(user_id);
  `);

  logger.info('SQLite database schema initialized successfully at ' + dbPath);
}

initSchema();

module.exports = db;
