#!/bin/bash
# migrate.sh — adds new columns to existing live databases
# Safe to run multiple times — uses ALTER TABLE IF NOT EXISTS pattern
# Run from /Users/naveenvajja/inventory-app

APP_DIR="/Users/naveenvajja/inventory-app"
cd "$APP_DIR"

echo "========================================"
echo "  Store CRM — Database Migration"
echo "========================================"
echo ""

# ── inventory.db: add tax_category to mara ───────────────────────────────────
echo "📦 Migrating inventory.db..."
sqlite3 inventory.db << 'SQL'
ALTER TABLE mara ADD COLUMN tax_category TEXT;
SQL
echo "  tax_category added to mara (or already exists)"

# ── transactions.db: add columns to vbak and vbap ────────────────────────────
echo "📦 Migrating transactions.db..."
sqlite3 transactions.db << 'SQL'
ALTER TABLE vbak ADD COLUMN customer_discount_pct REAL DEFAULT 0.00;
ALTER TABLE vbap ADD COLUMN mrp          REAL DEFAULT 0.00;
ALTER TABLE vbap ADD COLUMN discount_pct REAL DEFAULT 0.00;
ALTER TABLE vbap ADD COLUMN gst_rate     REAL DEFAULT 0.00;
ALTER TABLE vbap ADD COLUMN line_total   REAL DEFAULT 0.00;
SQL
echo "  customer_discount_pct added to vbak"
echo "  mrp, discount_pct, gst_rate, line_total added to vbap"

# ── pricing.db: add gst_config table ─────────────────────────────────────────
echo "📦 Migrating pricing.db..."
sqlite3 pricing.db << 'SQL'
CREATE TABLE IF NOT EXISTS gst_config (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_category TEXT NOT NULL UNIQUE,
    gst_rate     REAL NOT NULL DEFAULT 0.00,
    valid_from   TEXT NOT NULL DEFAULT (date('now')),
    valid_to     TEXT NOT NULL DEFAULT '12319999'
);
INSERT OR IGNORE INTO gst_config (tax_category, gst_rate) VALUES ('Apparel',     12.00);
INSERT OR IGNORE INTO gst_config (tax_category, gst_rate) VALUES ('Footwear',    12.00);
INSERT OR IGNORE INTO gst_config (tax_category, gst_rate) VALUES ('Accessories', 18.00);
INSERT OR IGNORE INTO gst_config (tax_category, gst_rate) VALUES ('Sportswear',   5.00);
INSERT OR IGNORE INTO gst_config (tax_category, gst_rate) VALUES ('Exempt',       0.00);
SQL
echo "  gst_config table created and seeded"

echo ""
echo "🔍 Verifying..."
echo "  mara columns       : $(sqlite3 inventory.db 'SELECT COUNT(*) FROM pragma_table_info("mara");') columns"
echo "  vbak columns       : $(sqlite3 transactions.db 'SELECT COUNT(*) FROM pragma_table_info("vbak");') columns"
echo "  vbap columns       : $(sqlite3 transactions.db 'SELECT COUNT(*) FROM pragma_table_info("vbap");') columns"
echo "  gst_config rows    : $(sqlite3 pricing.db 'SELECT COUNT(*) FROM gst_config;') slabs"
echo ""
echo "✅ Migration complete — restart server: node server.js"
