#!/bin/bash
# migrate_returns.sh — adds return order support to existing databases
# Safe to run multiple times — uses IF NOT EXISTS / OR IGNORE patterns

APP_DIR="/Users/naveenvajja/inventory-app"
cd "$APP_DIR"

echo "========================================"
echo "  Store CRM — Returns Migration"
echo "========================================"
echo ""

# ── transactions.db: add return columns to vbak ──────────────────────────────
echo "📦 Migrating transactions.db..."

sqlite3 transactions.db "ALTER TABLE vbak ADD COLUMN order_type TEXT DEFAULT 'S';" 2>/dev/null && echo "  ✅ Added order_type" || echo "  ↩  order_type already exists"
sqlite3 transactions.db "ALTER TABLE vbak ADD COLUMN original_order_id TEXT DEFAULT NULL;" 2>/dev/null && echo "  ✅ Added original_order_id" || echo "  ↩  original_order_id already exists"
sqlite3 transactions.db "ALTER TABLE vbak ADD COLUMN return_reason TEXT DEFAULT NULL;" 2>/dev/null && echo "  ✅ Added return_reason" || echo "  ↩  return_reason already exists"

# Backfill existing orders with S prefix
sqlite3 transactions.db "UPDATE vbak SET order_type='S' WHERE order_type IS NULL OR order_type='';"
echo "  ✅ Backfilled existing orders as type S"

# Create return_reasons table
sqlite3 transactions.db << 'SQL'
CREATE TABLE IF NOT EXISTS return_reasons (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    reason     TEXT NOT NULL UNIQUE,
    active     INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO return_reasons (reason) VALUES ('Defective Product');
INSERT OR IGNORE INTO return_reasons (reason) VALUES ('Wrong Size');
INSERT OR IGNORE INTO return_reasons (reason) VALUES ('Wrong Product Delivered');
INSERT OR IGNORE INTO return_reasons (reason) VALUES ('Customer Changed Mind');
INSERT OR IGNORE INTO return_reasons (reason) VALUES ('Damaged in Transit');
INSERT OR IGNORE INTO return_reasons (reason) VALUES ('Quality Not as Expected');
INSERT OR IGNORE INTO return_reasons (reason) VALUES ('Duplicate Order');
SQL
echo "  ✅ return_reasons table created and seeded"

echo ""
echo "🔍 Verifying..."
echo "  vbak columns       : $(sqlite3 transactions.db 'SELECT COUNT(*) FROM pragma_table_info("vbak");') columns"
echo "  return_reasons     : $(sqlite3 transactions.db 'SELECT COUNT(*) FROM return_reasons;') reasons"
echo "  existing S orders  : $(sqlite3 transactions.db "SELECT COUNT(*) FROM vbak WHERE order_type='S';")"
echo ""
echo "✅ Returns migration complete — restart server: node server.js"
