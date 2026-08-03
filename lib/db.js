import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

let dbInstance = null;

export async function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  // Open sqlite database file
  const dbPath = path.join(process.cwd(), 'trades.db');
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Create tables if they don't exist
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset TEXT NOT NULL,
      side TEXT NOT NULL,
      entry_price REAL NOT NULL,
      exit_price REAL NOT NULL,
      stop_loss REAL,
      take_profit REAL,
      size REAL NOT NULL,
      pnl REAL NOT NULL,
      status TEXT NOT NULL,
      trade_time TEXT,
      exit_time TEXT,
      user_notes TEXT,
      setup_tag TEXT,
      ai_evaluation TEXT,
      trade_type TEXT DEFAULT 'LIVE',
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS user_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_text TEXT NOT NULL,
      rule_type TEXT NOT NULL,
      rule_value REAL,
      account_type TEXT DEFAULT 'ALL',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS daily_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_date TEXT NOT NULL UNIQUE,
      mood_score INTEGER NOT NULL,
      sleep_hours REAL NOT NULL,
      stress_level INTEGER NOT NULL,
      goal_note TEXT,
      risk_warning TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS trade_context_drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset TEXT DEFAULT 'XAUUSD',
      session_tag TEXT,
      setup_tag TEXT,
      user_notes TEXT,
      image_url TEXT,
      status TEXT DEFAULT 'DRAFT',
      linked_trade_id INTEGER,
      draft_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS custom_hashtags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT UNIQUE NOT NULL,
      label TEXT,
      category TEXT NOT NULL,
      group_name TEXT,
      description TEXT,
      rules TEXT,
      risk_level TEXT,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);


  // Migration for existing databases
  try {
    await dbInstance.exec("ALTER TABLE trades ADD COLUMN trade_type TEXT DEFAULT 'LIVE_2'");
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await dbInstance.exec("UPDATE trades SET trade_type = 'LIVE' WHERE trade_type IN ('LIVE_1', 'LIVE_2')");
  } catch (e) {
    // Ignore migration error
  }
  try {
    await dbInstance.exec("ALTER TABLE trades ADD COLUMN image_url TEXT");
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await dbInstance.exec("ALTER TABLE trades ADD COLUMN exit_time TEXT");
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await dbInstance.exec("ALTER TABLE trades ADD COLUMN is_lesson INTEGER DEFAULT 0");
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await dbInstance.exec("ALTER TABLE user_rules ADD COLUMN account_type TEXT DEFAULT 'ALL'");
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await dbInstance.exec("ALTER TABLE trades ADD COLUMN drawings_data TEXT");
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await dbInstance.exec("ALTER TABLE custom_hashtags ADD COLUMN is_deleted INTEGER DEFAULT 0");
  } catch (e) {
    // Column already exists, ignore
  }

  return dbInstance;
}

