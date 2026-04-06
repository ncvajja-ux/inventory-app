// ─── Imports ───────────────────────────────────────────────────────────────
const express = require("express");
const path    = require("path");
const sqlite3 = require("sqlite3").verbose();
const cors    = require("cors");

const app = express();

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public/dist")));
app.use(express.json());
app.use(cors());

// ─── Database ───────────────────────────────────────────────────────────────
const db = new sqlite3.Database("inventory.db", (err) => {
    if (err) console.error("❌ DB connection error:", err.message);
    else     console.log("✅ Connected to inventory.db");
});

db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON");

    // Customers
    db.run(`
        CREATE TABLE IF NOT EXISTS kna1 (
            kunnr   TEXT PRIMARY KEY CHECK(length(kunnr) = 6),
            name    TEXT NOT NULL,
            number  TEXT,
            address TEXT,
            email   TEXT,
            gstin   TEXT
        )
    `);

    // Inventory — add price column if not present
    db.run(`
        CREATE TABLE IF NOT EXISTS mara (
            matnr       TEXT PRIMARY KEY CHECK(length(matnr) = 6),
            brand       TEXT,
            brandfamily TEXT,
            size        TEXT,
            quantity    INTEGER DEFAULT 0,
            price       REAL DEFAULT 0.00,
            param1      TEXT,
            param2      TEXT
        )
    `);

    // price migration now handled in robust PRAGMA check below

    // Sales Order Header
    db.run(`
        CREATE TABLE IF NOT EXISTS vbak (
            order_id    TEXT PRIMARY KEY CHECK(length(order_id) = 7),
            kunnr       TEXT NOT NULL,
            status      TEXT DEFAULT 'TEMP',
            created_at  TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (kunnr) REFERENCES kna1(kunnr)
        )
    `);

    // Sales Order Items
    db.run(`
        CREATE TABLE IF NOT EXISTS vbap (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id    TEXT NOT NULL,
            matnr       TEXT NOT NULL,
            quantity    INTEGER NOT NULL DEFAULT 1,
            price       REAL NOT NULL DEFAULT 0.00,
            FOREIGN KEY (order_id) REFERENCES vbak(order_id),
            FOREIGN KEY (matnr)    REFERENCES mara(matnr)
        )
    `);
});

// ─── ID Helpers ───────────────────────────────────────────────────────────────

function nextId(table, col, cb) {
    db.get(`SELECT MAX(CAST(${col} AS INTEGER)) as maxid FROM ${table}`, [], (err, row) => {
        if (err) return cb(err);
        const next = Math.max((row.maxid || 99999) + 1, 100000);
        if (next > 999999) return cb(new Error(`${col.toUpperCase()} range exhausted`));
        cb(null, String(next));
    });
}

app.get("/next-kunnr", (req, res) => {
    nextId("kna1", "kunnr", (err, id) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ kunnr: id });
    });
});

app.get("/next-matnr", (req, res) => {
    nextId("mara", "matnr", (err, id) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ matnr: id });
    });
});

// ─── CUSTOMER Routes ──────────────────────────────────────────────────────────

app.get("/customers", (req, res) => {
    db.all("SELECT * FROM kna1", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get("/customers/:kunnr", (req, res) => {
    db.get("SELECT * FROM kna1 WHERE kunnr = ?", [req.params.kunnr], (err, row) => {
        if (err)  return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Customer not found" });
        res.json(row);
    });
});

app.post("/addcustomer", (req, res) => {
    const { name, number, address, email, gstin } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    nextId("kna1", "kunnr", (err, kunnr) => {
        if (err) return res.status(500).json({ error: err.message });
        db.run(
            `INSERT INTO kna1 (kunnr, name, number, address, email, gstin) VALUES (?, ?, ?, ?, ?, ?)`,
            [kunnr, name, number, address, email, gstin],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, kunnr });
            }
        );
    });
});

app.put("/customers/:kunnr", (req, res) => {
    const { name, number, address, email, gstin } = req.body;
    db.run(
        `UPDATE kna1 SET name=?, number=?, address=?, email=?, gstin=? WHERE kunnr=?`,
        [name, number, address, email, gstin, req.params.kunnr],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, changes: this.changes });
        }
    );
});

app.delete("/customers/:kunnr", (req, res) => {
    db.run("DELETE FROM kna1 WHERE kunnr = ?", [req.params.kunnr], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// ─── INVENTORY Routes ─────────────────────────────────────────────────────────

app.get("/inventory", (req, res) => {
    db.all("SELECT * FROM mara", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET distinct types for Sales dropdown
app.get("/inventory/meta/types", (req, res) => {
    db.all("SELECT DISTINCT type FROM mara WHERE type IS NOT NULL AND type != '' ORDER BY type", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => r.type));
    });
});

// GET distinct brands filtered by type
app.get("/inventory/meta/brands", (req, res) => {
    const type = req.query.type;
    const sql  = type
        ? "SELECT DISTINCT brand FROM mara WHERE type = ? AND brand IS NOT NULL AND brand != '' ORDER BY brand"
        : "SELECT DISTINCT brand FROM mara WHERE brand IS NOT NULL AND brand != '' ORDER BY brand";
    const params = type ? [type] : [];
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => r.brand));
    });
});

// GET items filtered by type + brand
app.get("/inventory/meta/items", (req, res) => {
    const { type, brand } = req.query;
    let sql = "SELECT * FROM mara WHERE 1=1";
    const params = [];
    if (brand) { sql += " AND brand = ?"; params.push(brand); }
    sql += " ORDER BY matnr";
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET single item
app.get("/inventory/:matnr", (req, res) => {
    db.get("SELECT * FROM mara WHERE matnr = ?", [req.params.matnr], (err, row) => {
        if (err)  return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Item not found" });
        res.json(row);
    });
});

app.post("/addinventory", (req, res) => {
    const { brand, brandfamily, size, type, quantity, price, param1, param2 } = req.body;
    if (!brand) return res.status(400).json({ error: "Brand is required" });
    nextId("mara", "matnr", (err, matnr) => {
        if (err) return res.status(500).json({ error: err.message });
        db.run(
            `INSERT INTO mara (matnr, brand, brandfamily, size, quantity, price, param1, param2)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [matnr, brand, brandfamily, size, quantity || 0, price || 0.00, param1, param2],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, matnr });
            }
        );
    });
});

app.put("/inventory/:matnr", (req, res) => {
    const { brand, brandfamily, size, quantity, price, gender, category, subcategory, param1, param2 } = req.body;
    db.run(
        `UPDATE mara SET brand=?, brandfamily=?, size=?, quantity=?, price=?, gender=?, category=?, subcategory=?, param1=?, param2=? WHERE matnr=?`,
        [brand, brandfamily, size, quantity, price || 0.00, gender, category, subcategory, param1, param2, req.params.matnr],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, changes: this.changes });
        }
    );
});

app.delete("/inventory/:matnr", (req, res) => {
    db.run("DELETE FROM mara WHERE matnr = ?", [req.params.matnr], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// ─── SALES ORDER Routes ───────────────────────────────────────────────────────

// Get temp order for a customer (&KUNNR format)
app.get("/order/temp/:kunnr", (req, res) => {
    const order_id = `&${req.params.kunnr}`;
    db.get("SELECT * FROM vbak WHERE order_id = ?", [order_id], (err, header) => {
        if (err)     return res.status(500).json({ error: err.message });
        if (!header) return res.json(null);
        db.all(
            `SELECT vbap.*, mara.brand, mara.brandfamily, mara.size, mara.type
             FROM vbap JOIN mara ON vbap.matnr = mara.matnr
             WHERE vbap.order_id = ?`,
            [order_id],
            (err, items) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ ...header, items });
            }
        );
    });
});

// Add item to temp order (creates header if not exists)
app.post("/order/temp/:kunnr/add", (req, res) => {
    const kunnr    = req.params.kunnr;
    const order_id = `&${kunnr}`;
    const { matnr, quantity, price } = req.body;

    if (!matnr || !quantity) return res.status(400).json({ error: "matnr and quantity required" });

    // Ensure header exists
    db.run(
        `INSERT OR IGNORE INTO vbak (order_id, kunnr, status) VALUES (?, ?, 'TEMP')`,
        [order_id, kunnr],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            // Check if item already in cart → update qty
            db.get(
                `SELECT id FROM vbap WHERE order_id = ? AND matnr = ?`,
                [order_id, matnr],
                (err, existing) => {
                    if (err) return res.status(500).json({ error: err.message });
                    if (existing) {
                        db.run(
                            `UPDATE vbap SET quantity = quantity + ? WHERE id = ?`,
                            [quantity, existing.id],
                            (err) => {
                                if (err) return res.status(500).json({ error: err.message });
                                res.json({ success: true, updated: true });
                            }
                        );
                    } else {
                        db.run(
                            `INSERT INTO vbap (order_id, matnr, quantity, price) VALUES (?, ?, ?, ?)`,
                            [order_id, matnr, quantity, price],
                            (err) => {
                                if (err) return res.status(500).json({ error: err.message });
                                res.json({ success: true, inserted: true });
                            }
                        );
                    }
                }
            );
        }
    );
});

// Remove item from cart
app.delete("/order/temp/:kunnr/item/:id", (req, res) => {
    db.run("DELETE FROM vbap WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Place order — convert TEMP to CONFIRMED, assign real order ID
app.post("/order/place/:kunnr", (req, res) => {
    const kunnr       = req.params.kunnr;
    const temp_id     = `&${kunnr}`;

    // Check temp order exists
    db.get("SELECT * FROM vbak WHERE order_id = ?", [temp_id], (err, order) => {
        if (err)    return res.status(500).json({ error: err.message });
        if (!order) return res.status(404).json({ error: "No temp order found" });

        // Generate next real order ID (0100000–0999999)
        db.get("SELECT MAX(CAST(order_id AS INTEGER)) as maxid FROM vbak WHERE order_id NOT LIKE '&%'", [], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            const nextNum  = Math.max((row.maxid || 99999) + 1, 100000);
            const order_id = String(nextNum).padStart(7, '0');

            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                // Insert new confirmed header
                db.run(
                    `INSERT INTO vbak (order_id, kunnr, status) VALUES (?, ?, 'CONFIRMED')`,
                    [order_id, kunnr],
                    (err) => { if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); } }
                );
                // Move items to new order_id
                db.run(
                    `UPDATE vbap SET order_id = ? WHERE order_id = ?`,
                    [order_id, temp_id],
                    (err) => { if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); } }
                );
                // Delete temp header
                db.run(
                    `DELETE FROM vbak WHERE order_id = ?`,
                    [temp_id],
                    (err) => { if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); } }
                );
                db.run("COMMIT", (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, order_id });
                });
            });
        });
    });
});

// GET confirmed order with items (for invoice)
app.get("/order/:order_id", (req, res) => {
    db.get(
        `SELECT vbak.*, kna1.name, kna1.number, kna1.address, kna1.email, kna1.gstin
         FROM vbak JOIN kna1 ON vbak.kunnr = kna1.kunnr
         WHERE vbak.order_id = ?`,
        [req.params.order_id],
        (err, header) => {
            if (err)     return res.status(500).json({ error: err.message });
            if (!header) return res.status(404).json({ error: "Order not found" });
            db.all(
                `SELECT vbap.*, mara.brand, mara.brandfamily, mara.size, mara.type
                 FROM vbap JOIN mara ON vbap.matnr = mara.matnr
                 WHERE vbap.order_id = ?`,
                [req.params.order_id],
                (err, items) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ ...header, items });
                }
            );
        }
    );
});


// ─── CATEGORY Routes ──────────────────────────────────────────────────────────

// GET all categories grouped
app.get("/categories", (req, res) => {
    db.all("SELECT * FROM categories ORDER BY category, subcategory", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const grouped = {};
        rows.forEach(r => {
            if (!grouped[r.category]) grouped[r.category] = [];
            grouped[r.category].push({ id: r.id, subcategory: r.subcategory });
        });
        res.json(grouped);
    });
});

// GET distinct top-level categories (must be before /:category route)
app.get("/categories/list", (req, res) => {
    db.all("SELECT DISTINCT category FROM categories ORDER BY category", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => r.category));
    });
});

// GET subcategories for a category
app.get("/categories/:category/subs", (req, res) => {
    db.all(
        "SELECT * FROM categories WHERE category = ? ORDER BY subcategory",
        [req.params.category], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// POST add subcategory to existing category
app.post("/categories", (req, res) => {
    const { category, subcategory } = req.body;
    if (!category || !subcategory)
        return res.status(400).json({ error: "Both category and subcategory are required" });
    db.run(
        `INSERT OR IGNORE INTO categories (category, subcategory) VALUES (?, ?)`,
        [category, subcategory],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0)
                return res.status(409).json({ error: `"${subcategory}" already exists under "${category}"` });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// POST add new top-level category (with its first subcategory)
app.post("/categories/new", (req, res) => {
    const { category, subcategory } = req.body;
    if (!category || !subcategory)
        return res.status(400).json({ error: "Category name and first subcategory are both required" });
    db.run(
        `INSERT OR IGNORE INTO categories (category, subcategory) VALUES (?, ?)`,
        [category, subcategory],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0)
                return res.status(409).json({ error: `"${category} / ${subcategory}" already exists` });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// DELETE subcategory by id
app.delete("/categories/:id", (req, res) => {
    db.run("DELETE FROM categories WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ─── SPA Fallback (React Router) ─────────────────────────────────────────────
app.use((req, res) => {
    res.sendFile(path.join(__dirname, "public/dist", "index.html"));
});

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(3000, () => console.log("🚀 Server running on http://localhost:3000"));