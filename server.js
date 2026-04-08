const express = require("express");
const path    = require("path");
const sqlite3 = require("sqlite3").verbose();
const cors    = require("cors");
const app     = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public/dist")));
app.use(express.json());
app.use(cors());

// ─── Open databases ───────────────────────────────────────────────────────────
function openDb(filename) {
    const db = new sqlite3.Database(filename, (err) => {
        if (err) { console.error(`❌ Error opening ${filename}:`, err.message); return; }
        console.log(`✅ Connected to ${filename}`);
        db.run("PRAGMA journal_mode = WAL");
        db.run("PRAGMA synchronous = NORMAL");
    });
    return db;
}

const custDb    = openDb("customers.db");
const buyerDb   = openDb("buyers.db");
const invDb     = openDb("inventory.db");
const transDb   = openDb("transactions.db");
const pricingDb = openDb("pricing.db");
const hrDb      = openDb("hr.db");

// ─── Create tables on startup ─────────────────────────────────────────────────
custDb.serialize(() => {
    custDb.run(`CREATE TABLE IF NOT EXISTS kna1 (
        kunnr TEXT PRIMARY KEY CHECK(length(kunnr)=6),
        name TEXT NOT NULL, number TEXT, address TEXT, email TEXT, gstin TEXT
    )`);
});

buyerDb.serialize(() => {
    buyerDb.run(`CREATE TABLE IF NOT EXISTS buyers (
        buyer_id TEXT PRIMARY KEY CHECK(length(buyer_id)=6),
        name TEXT NOT NULL, phone TEXT, email TEXT, gstin TEXT,
        tax_id TEXT, export_id TEXT,
        addr1 TEXT, addr2 TEXT, city TEXT, state TEXT,
        country TEXT DEFAULT 'India', zip TEXT,
        ship_city TEXT, payment_terms TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )`);
});

invDb.serialize(() => {
    invDb.run(`CREATE TABLE IF NOT EXISTS mara (
        matnr TEXT PRIMARY KEY CHECK(length(matnr)=6),
        brand TEXT, brandfamily TEXT, size TEXT,
        quantity INTEGER DEFAULT 0, price REAL DEFAULT 0.00,
        cost_price REAL DEFAULT 0.00, mrp REAL DEFAULT 0.00,
        reserved INTEGER DEFAULT 0, gender TEXT,
        category TEXT, subcategory TEXT, subsubcategory TEXT,
        color TEXT, fit TEXT, tax_category TEXT,
        param1 TEXT, param2 TEXT
    )`);
    // Migrate: add any columns missing from old single-DB schema
    invDb.all("PRAGMA table_info(mara)", [], (err, cols) => {
        if (err || !cols) return;
        const have = new Set(cols.map(c => c.name));
        const toAdd = [
            ["cost_price",    "REAL DEFAULT 0.00"],
            ["mrp",           "REAL DEFAULT 0.00"],
            ["reserved",      "INTEGER DEFAULT 0"],
            ["gender",        "TEXT"],
            ["category",      "TEXT"],
            ["subcategory",   "TEXT"],
            ["subsubcategory","TEXT"],
            ["color",         "TEXT"],
            ["fit",           "TEXT"],
            ["tax_category",  "TEXT"],
        ];
        toAdd.forEach(([col, def]) => {
            if (!have.has(col)) {
                invDb.run(`ALTER TABLE mara ADD COLUMN ${col} ${def}`,
                    (err) => { if (!err) console.log(`✅ Migrated mara: added ${col}`); }
                );
            }
        });
    });
    invDb.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL, subcategory TEXT NOT NULL,
        UNIQUE(category, subcategory)
    )`);
    invDb.run(`CREATE TABLE IF NOT EXISTS brands (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE
    )`);
    invDb.run(`CREATE TABLE IF NOT EXISTS colors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE, hex TEXT
    )`);
    invDb.run(`CREATE TABLE IF NOT EXISTS fits (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE
    )`);
    invDb.run(`CREATE TABLE IF NOT EXISTS category_l3 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL, subcategory TEXT NOT NULL,
        subsubcategory TEXT NOT NULL, sizes TEXT,
        UNIQUE(category, subcategory, subsubcategory)
    )`);
    // Seed categories if empty
    invDb.get("SELECT COUNT(*) as n FROM categories", [], (err, row) => {
        if (err || (row && row.n > 0)) return;
        const cats = [
            ["Tops","Formal Shirts"],["Tops","Overshirts"],["Tops","Jackets"],
            ["Tops","T-Shirts - Round Neck"],["Tops","T-Shirts - Collar"],["Tops","Active Wear"],
            ["Bottom","Denims"],["Bottom","Chino"],["Bottom","Cargo"],["Bottom","Formal"],
            ["Bottom","Tracks"],["Bottom","Shorts"],["Bottom","Sleep Wear"],
            ["Bottom","Inner Wear"],["Bottom","Leisure"],
            ["Footwear","Running"],["Footwear","Sneakers"],["Footwear","Loafers"],
            ["Footwear","Formal"],["Footwear","Casual"],
            ["Accessories","Bags"],["Accessories","Wallets"],["Accessories","Perfumes"],
            ["Accessories","Cosmetics"],["Accessories","Belts"],["Accessories","Luggage"]
        ];
        const stmt = invDb.prepare("INSERT OR IGNORE INTO categories (category,subcategory) VALUES (?,?)");
        cats.forEach(([c,s]) => stmt.run(c,s));
        stmt.finalize(() => console.log("✅ Categories seeded"));
    });
});

transDb.serialize(() => {
    transDb.run(`CREATE TABLE IF NOT EXISTS vbak (
        order_id              TEXT PRIMARY KEY,
        kunnr                 TEXT NOT NULL,
        status                TEXT DEFAULT 'TEMP',
        payment_status        TEXT DEFAULT 'PENDING',
        paid_amount           REAL DEFAULT 0.00,
        customer_discount_pct REAL DEFAULT 0.00,
        order_type            TEXT DEFAULT 'S',
        original_order_id     TEXT DEFAULT NULL,
        return_reason         TEXT DEFAULT NULL,
        created_at            TEXT DEFAULT (datetime('now'))
    )`);
    // Migrate vbak: add return columns if missing
    transDb.all("PRAGMA table_info(vbak)", [], (err, cols) => {
        if (err || !cols) return;
        const names = cols.map(c => c.name);
        if (!names.includes('order_type'))
            transDb.run("ALTER TABLE vbak ADD COLUMN order_type TEXT DEFAULT 'S'",
                err => { if (!err) console.log("✅ Added vbak.order_type"); });
        if (!names.includes('original_order_id'))
            transDb.run("ALTER TABLE vbak ADD COLUMN original_order_id TEXT DEFAULT NULL",
                err => { if (!err) console.log("✅ Added vbak.original_order_id"); });
        if (!names.includes('return_reason'))
            transDb.run("ALTER TABLE vbak ADD COLUMN return_reason TEXT DEFAULT NULL",
                err => { if (!err) console.log("✅ Added vbak.return_reason"); });
    });
    // Return reasons config table
    transDb.run(`CREATE TABLE IF NOT EXISTS return_reasons (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        reason     TEXT NOT NULL UNIQUE,
        active     INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    )`);
    transDb.get("SELECT COUNT(*) as n FROM return_reasons", [], (err, row) => {
        if (err || (row && row.n > 0)) return;
        const reasons = [
            'Defective Product','Wrong Size','Wrong Product Delivered',
            'Customer Changed Mind','Damaged in Transit',
            'Quality Not as Expected','Duplicate Order'
        ];
        const stmt = transDb.prepare("INSERT OR IGNORE INTO return_reasons (reason) VALUES (?)");
        reasons.forEach(r => stmt.run(r));
        stmt.finalize(() => console.log("✅ Return reasons seeded"));
    });
    // Migrate vbak: add customer_discount_pct if missing
    transDb.all("PRAGMA table_info(vbak)", [], (err, cols) => {
        if (err || !cols) return;
        if (!cols.find(c => c.name === 'customer_discount_pct')) {
            transDb.run("ALTER TABLE vbak ADD COLUMN customer_discount_pct REAL DEFAULT 0.00",
                (err) => { if (!err) console.log("✅ Added vbak.customer_discount_pct"); }
            );
        }
    });
    transDb.run(`CREATE TABLE IF NOT EXISTS vbap (
        order_id     TEXT NOT NULL,
        matnr        TEXT NOT NULL,
        quantity     INTEGER NOT NULL DEFAULT 1,
        price        REAL NOT NULL DEFAULT 0.00,
        mrp          REAL DEFAULT 0.00,
        discount_pct REAL DEFAULT 0.00,
        gst_rate     REAL DEFAULT 0.00,
        line_total   REAL DEFAULT 0.00,
        PRIMARY KEY (order_id, matnr)
    )`);
    // Migrate vbap: add new columns if missing
    transDb.all("PRAGMA table_info(vbap)", [], (err, cols) => {
        if (err || !cols) return;
        const names = cols.map(c => c.name);
        const toAdd = [
            ["mrp",          "REAL DEFAULT 0.00"],
            ["discount_pct", "REAL DEFAULT 0.00"],
            ["gst_rate",     "REAL DEFAULT 0.00"],
            ["line_total",   "REAL DEFAULT 0.00"],
        ];
        toAdd.forEach(([col, def]) => {
            if (!names.includes(col)) {
                transDb.run(`ALTER TABLE vbap ADD COLUMN ${col} ${def}`,
                    (err) => { if (!err) console.log('✅ Added vbap.' + col); }
                );
            }
        });
    });
    transDb.run(`CREATE TABLE IF NOT EXISTS po_header (
        po_id TEXT PRIMARY KEY, buyer_id TEXT NOT NULL,
        po_date TEXT DEFAULT (date('now')),
        payment_terms TEXT, payment_status TEXT DEFAULT 'PENDING',
        receiver_name TEXT, receiver_phone TEXT, receiver_email TEXT, receiver_gstin TEXT,
        tax_id TEXT, export_id TEXT,
        addr1 TEXT, addr2 TEXT, city TEXT, state TEXT,
        country TEXT DEFAULT 'India', zip TEXT, ship_city TEXT, notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )`);
    transDb.run(`CREATE TABLE IF NOT EXISTS po_items (
        po_id TEXT NOT NULL, line_no INTEGER NOT NULL, matnr TEXT NOT NULL,
        quantity   INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0.00,
        line_total REAL NOT NULL DEFAULT 0.00,
        status     TEXT NOT NULL DEFAULT 'Created',
        PRIMARY KEY (po_id, line_no)
    )`);
    // Migrate: add status column if missing
    transDb.all("PRAGMA table_info(po_items)", [], (err, cols) => {
        if (err || !cols) return;
        if (!cols.find(c => c.name === 'status')) {
            transDb.run("ALTER TABLE po_items ADD COLUMN status TEXT NOT NULL DEFAULT 'Created'",
                (err) => { if (!err) console.log("✅ Added po_items.status column"); }
            );
        }
    });
});

pricingDb.serialize(() => {
    pricingDb.run(`CREATE TABLE IF NOT EXISTS gst_config (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        tax_category TEXT NOT NULL UNIQUE,
        gst_rate     REAL NOT NULL DEFAULT 0.00,
        valid_from   TEXT NOT NULL DEFAULT (date('now')),
        valid_to     TEXT NOT NULL DEFAULT '12319999'
    )`);
    // Seed GST categories if empty
    pricingDb.get("SELECT COUNT(*) as n FROM gst_config", [], (err, row) => {
        if (err || (row && row.n > 0)) return;
        const today = new Date().toISOString().split('T')[0];
        const slabs = [
            ['Apparel',     5.00, today],
            ['Footwear',   12.00, today],
            ['Accessories',18.00, today],
            ['Innerwear',   5.00, today],
            ['Sportswear', 12.00, today],
        ];
        const stmt = pricingDb.prepare("INSERT OR IGNORE INTO gst_config (tax_category,gst_rate,valid_from) VALUES (?,?,?)");
        slabs.forEach(([cat,rate,from]) => stmt.run(cat,rate,from));
        stmt.finalize(() => console.log("✅ GST config seeded"));
    });

    pricingDb.run(`CREATE TABLE IF NOT EXISTS sales_price (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matnr TEXT NOT NULL, valid_from TEXT NOT NULL, valid_to TEXT,
        unit_price REAL NOT NULL DEFAULT 0.00
    )`);
    pricingDb.run(`CREATE TABLE IF NOT EXISTS customer_discount (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kunnr TEXT NOT NULL, discount_pct REAL NOT NULL DEFAULT 0.00,
        valid_from TEXT NOT NULL, valid_to TEXT
    )`);
    pricingDb.run(`CREATE TABLE IF NOT EXISTS product_discount (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matnr TEXT NOT NULL, discount_pct REAL NOT NULL DEFAULT 0.00,
        valid_from TEXT NOT NULL, valid_to TEXT
    )`);
});

hrDb.serialize(() => {
    hrDb.run(`CREATE TABLE IF NOT EXISTS departments (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )`);
    hrDb.run(`CREATE TABLE IF NOT EXISTS designations (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )`);
    hrDb.run(`CREATE TABLE IF NOT EXISTS employees (
        emp_id      TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        pan         TEXT,
        aadhar      TEXT,
        salary      REAL    DEFAULT 0,
        start_date  TEXT,
        end_date    TEXT,
        pay_mode    TEXT    DEFAULT 'cash',
        salary_day  INTEGER,
        department  TEXT,
        designation TEXT,
        phone       TEXT,
        address     TEXT,
        status      TEXT    DEFAULT 'active'
    )`);
    hrDb.run(`CREATE TABLE IF NOT EXISTS salary_headers (
        header_id  TEXT PRIMARY KEY,
        emp_id     TEXT NOT NULL,
        month      TEXT NOT NULL,
        total_paid REAL DEFAULT 0,
        notes      TEXT,
        created_at TEXT,
        UNIQUE(emp_id, month)
    )`);
    hrDb.run(`CREATE TABLE IF NOT EXISTS salary_lines (
        line_id      TEXT PRIMARY KEY,
        header_id    TEXT NOT NULL,
        payment_type TEXT NOT NULL,
        amount       REAL NOT NULL,
        pay_date     TEXT NOT NULL,
        pay_mode     TEXT NOT NULL,
        notes        TEXT
    )`);
    hrDb.run(`CREATE TABLE IF NOT EXISTS attendance (
        att_id   TEXT PRIMARY KEY,
        emp_id   TEXT NOT NULL,
        att_date TEXT NOT NULL,
        status   TEXT NOT NULL,
        notes    TEXT,
        UNIQUE(emp_id, att_date)
    )`);
});

// ─── Helper: HR short IDs (EMP001, SH001, SL001, ATT001) ─────────────────────
function nextHrId(db, table, col, prefix, cb) {
    const pLen = prefix.length;
    db.get(
        `SELECT MAX(CAST(SUBSTR(${col}, ${pLen + 1}) AS INTEGER)) as maxid FROM ${table} WHERE ${col} LIKE ?`,
        [`${prefix}%`],
        (err, row) => {
            if (err) return cb(err);
            const next = (row && row.maxid ? row.maxid : 0) + 1;
            cb(null, prefix + String(next).padStart(3, '0'));
        }
    );
}

// ─── Helper: next sequential ID ───────────────────────────────────────────────
function nextId(db, table, col, prefix, cb) {
    // For S-prefix orders, check both prefixed AND numeric IDs to avoid collisions
    const sql = prefix === 'S'
        ? `SELECT MAX(CASE WHEN ${col} LIKE 'S%' THEN CAST(SUBSTR(${col},2) AS INTEGER) ELSE CAST(${col} AS INTEGER) END) as maxid FROM ${table}`
        : prefix
            ? `SELECT MAX(CAST(SUBSTR(${col},2) AS INTEGER)) as maxid FROM ${table} WHERE ${col} LIKE '${prefix}%'`
            : `SELECT MAX(CAST(${col} AS INTEGER)) as maxid FROM ${table}`;
    db.get(sql, [], (err, row) => {
        if (err) return cb(err);
        const next = Math.max((row.maxid || 99999) + 1, 100000);
        if (next > 999999) return cb(new Error(`${col} range exhausted`));
        cb(null, prefix ? prefix + String(next) : String(next));
    });
}

// ─── CUSTOMER Routes ──────────────────────────────────────────────────────────
app.get("/next-kunnr", (req, res) => {
    nextId(custDb, "kna1", "kunnr", null, (err, id) =>
        err ? res.status(500).json({error:err.message}) : res.json({kunnr:id})
    );
});
app.get("/customers", (req, res) => {
    custDb.all("SELECT * FROM kna1 ORDER BY kunnr", [],
        (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.get("/customers/search", (req, res) => {
    const q = (req.query.q||'').trim();
    if (!q) return res.json([]);
    const like = `%${q}%`;
    custDb.all("SELECT * FROM kna1 WHERE kunnr LIKE ? OR name LIKE ? OR number LIKE ? ORDER BY name LIMIT 10",
        [like,like,like], (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.get("/customers/:kunnr", (req, res) => {
    custDb.get("SELECT * FROM kna1 WHERE kunnr=?", [req.params.kunnr], (err, row) => {
        if (err)  return res.status(500).json({error:err.message});
        if (!row) return res.status(404).json({error:"Customer not found"});
        res.json(row);
    });
});
app.post("/addcustomer", (req, res) => {
    const {name,number,address,email,gstin} = req.body;
    if (!name) return res.status(400).json({error:"Name required"});
    nextId(custDb, "kna1", "kunnr", null, (err, kunnr) => {
        if (err) return res.status(500).json({error:err.message});
        custDb.run("INSERT INTO kna1 (kunnr,name,number,address,email,gstin) VALUES (?,?,?,?,?,?)",
            [kunnr,name,number,address,email,gstin],
            function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true,kunnr}); }
        );
    });
});
app.put("/customers/:kunnr", (req, res) => {
    const {name,number,address,email,gstin} = req.body;
    custDb.run("UPDATE kna1 SET name=?,number=?,address=?,email=?,gstin=? WHERE kunnr=?",
        [name,number,address,email,gstin,req.params.kunnr],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});
app.delete("/customers/:kunnr", (req, res) => {
    custDb.run("DELETE FROM kna1 WHERE kunnr=?", [req.params.kunnr],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});

// ─── BUYER Routes ─────────────────────────────────────────────────────────────
app.get("/next-buyer-id", (req, res) => {
    nextId(buyerDb, "buyers", "buyer_id", null, (err, id) =>
        err ? res.status(500).json({error:err.message}) : res.json({buyer_id:id})
    );
});
app.get("/buyers", (req, res) => {
    buyerDb.all("SELECT * FROM buyers ORDER BY buyer_id", [],
        (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.get("/buyers/search", (req, res) => {
    const q = (req.query.q||'').trim();
    if (!q) return res.json([]);
    const like = `%${q}%`;
    buyerDb.all("SELECT * FROM buyers WHERE buyer_id LIKE ? OR name LIKE ? OR phone LIKE ? ORDER BY name LIMIT 10",
        [like,like,like], (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.get("/buyers/:buyer_id", (req, res) => {
    buyerDb.get("SELECT * FROM buyers WHERE buyer_id=?", [req.params.buyer_id], (err, row) => {
        if (err)  return res.status(500).json({error:err.message});
        if (!row) return res.status(404).json({error:"Buyer not found"});
        res.json(row);
    });
});
app.post("/buyers", (req, res) => {
    const {name,phone,email,gstin,tax_id,export_id,addr1,addr2,city,state,country,zip,ship_city,payment_terms} = req.body;
    if (!name) return res.status(400).json({error:"Name required"});
    nextId(buyerDb, "buyers", "buyer_id", null, (err, buyer_id) => {
        if (err) return res.status(500).json({error:err.message});
        buyerDb.run(`INSERT INTO buyers (buyer_id,name,phone,email,gstin,tax_id,export_id,addr1,addr2,city,state,country,zip,ship_city,payment_terms)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [buyer_id,name,phone,email,gstin,tax_id,export_id,addr1,addr2,city,state,country||'India',zip,ship_city,payment_terms],
            function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true,buyer_id}); }
        );
    });
});
app.put("/buyers/:buyer_id", (req, res) => {
    const {name,phone,email,gstin,tax_id,export_id,addr1,addr2,city,state,country,zip,ship_city,payment_terms} = req.body;
    buyerDb.run(`UPDATE buyers SET name=?,phone=?,email=?,gstin=?,tax_id=?,export_id=?,
        addr1=?,addr2=?,city=?,state=?,country=?,zip=?,ship_city=?,payment_terms=? WHERE buyer_id=?`,
        [name,phone,email,gstin,tax_id,export_id,addr1,addr2,city,state,country,zip,ship_city,payment_terms,req.params.buyer_id],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});
app.delete("/buyers/:buyer_id", (req, res) => {
    buyerDb.run("DELETE FROM buyers WHERE buyer_id=?", [req.params.buyer_id],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});

// ─── INVENTORY Routes ─────────────────────────────────────────────────────────
app.get("/next-matnr", (req, res) => {
    nextId(invDb, "mara", "matnr", null, (err, id) =>
        err ? res.status(500).json({error:err.message}) : res.json({matnr:id})
    );
});
app.get("/inventory", (req, res) => {
    invDb.all("SELECT *, (quantity-COALESCE(reserved,0)) as available FROM mara ORDER BY matnr", [],
        (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.get("/inventory/meta/brands", (req, res) => {
    const {category} = req.query;
    let sql = "SELECT DISTINCT brand FROM mara WHERE brand IS NOT NULL AND brand!=''";
    const p = [];
    if (category) { sql += " AND category=?"; p.push(category); }
    sql += " ORDER BY brand";
    invDb.all(sql, p, (err, rows) =>
        err ? res.status(500).json({error:err.message}) : res.json(rows.map(r=>r.brand))
    );
});
app.get("/inventory/meta/items", (req, res) => {
    const {category, brand} = req.query;
    let sql = "SELECT *, (quantity-COALESCE(reserved,0)) as available FROM mara WHERE 1=1";
    const p = [];
    if (category) { sql += " AND category=?"; p.push(category); }
    if (brand)    { sql += " AND brand=?";    p.push(brand); }
    sql += " ORDER BY matnr";
    invDb.all(sql, p, (err, rows) =>
        err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.get("/inventory/:matnr", (req, res) => {
    invDb.get("SELECT *, (quantity-COALESCE(reserved,0)) as available FROM mara WHERE matnr=?",
        [req.params.matnr], (err, row) => {
            if (err)  return res.status(500).json({error:err.message});
            if (!row) return res.status(404).json({error:"Item not found"});
            res.json(row);
        }
    );
});
app.post("/addinventory", (req, res) => {
    const {brand,brandfamily,size,quantity,price,cost_price,mrp,gender,category,subcategory,subsubcategory,color,fit,tax_category} = req.body;
    if (!brand) return res.status(400).json({error:"Brand required"});
    nextId(invDb, "mara", "matnr", null, (err, matnr) => {
        if (err) return res.status(500).json({error:err.message});
        invDb.run(`INSERT INTO mara (matnr,brand,brandfamily,size,quantity,price,cost_price,mrp,gender,category,subcategory,subsubcategory,color,fit,tax_category,reserved)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
            [matnr,brand,brandfamily,size,quantity||0,price||0,cost_price||0,mrp||0,gender,category,subcategory,subsubcategory,color,fit,tax_category||null],
            function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true,matnr}); }
        );
    });
});
app.post("/inventory/:matnr/restock", (req, res) => {
    const {quantity, cost_price} = req.body;
    if (!quantity || quantity < 1) return res.status(400).json({error:"Quantity required"});
    const updates = ["quantity=quantity+?"];
    const params  = [quantity];
    if (cost_price != null) { updates.push("cost_price=?"); params.push(cost_price); }
    params.push(req.params.matnr);
    invDb.run(`UPDATE mara SET ${updates.join(",")} WHERE matnr=?`, params,
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});
app.put("/inventory/:matnr", (req, res) => {
    const {brand,brandfamily,size,quantity,price,cost_price,mrp,gender,category,subcategory,subsubcategory,color,fit,tax_category} = req.body;
    invDb.run(`UPDATE mara SET brand=?,brandfamily=?,size=?,quantity=?,price=?,cost_price=?,mrp=?,
        gender=?,category=?,subcategory=?,subsubcategory=?,color=?,fit=?,tax_category=? WHERE matnr=?`,
        [brand,brandfamily,size,quantity,price||0,cost_price||0,mrp||0,gender,category,subcategory,subsubcategory,color,fit,tax_category||null,req.params.matnr],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});
app.delete("/inventory/:matnr", (req, res) => {
    invDb.run("DELETE FROM mara WHERE matnr=?", [req.params.matnr],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});

// ─── CATEGORY Routes ──────────────────────────────────────────────────────────
app.get("/categories", (req, res) => {
    invDb.all("SELECT * FROM categories ORDER BY category,subcategory", [], (err, rows) => {
        if (err) return res.status(500).json({error:err.message});
        const grouped = {};
        rows.forEach(r => {
            if (!grouped[r.category]) grouped[r.category] = [];
            grouped[r.category].push({id:r.id, subcategory:r.subcategory});
        });
        res.json(grouped);
    });
});
app.get("/categories/list", (req, res) => {
    invDb.all("SELECT DISTINCT category FROM categories ORDER BY category", [],
        (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows.map(r=>r.category))
    );
});
app.get("/categories/:category/subs", (req, res) => {
    invDb.all("SELECT * FROM categories WHERE category=? ORDER BY subcategory", [req.params.category],
        (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
// POST add subcategory to existing category
app.post("/categories", (req, res) => {
    const {category,subcategory} = req.body;
    if (!category||!subcategory) return res.status(400).json({error:"Both fields required"});
    invDb.run("INSERT OR IGNORE INTO categories (category,subcategory) VALUES (?,?)", [category,subcategory],
        function(err) {
            if (err) return res.status(500).json({error:err.message});
            if (this.changes === 0)
                return res.status(409).json({error:`"${category} / ${subcategory}" already exists`});
            res.json({success:true,id:this.lastID});
        }
    );
});
// POST create a brand-new top-level category with its first subcategory
app.post("/categories/new", (req, res) => {
    const {category,subcategory} = req.body;
    if (!category||!subcategory) return res.status(400).json({error:"Both category name and first subcategory are required"});
    invDb.run("INSERT OR IGNORE INTO categories (category,subcategory) VALUES (?,?)", [category,subcategory],
        function(err) {
            if (err) return res.status(500).json({error:err.message});
            if (this.changes === 0)
                return res.status(409).json({error:`"${category} / ${subcategory}" already exists`});
            res.json({success:true,id:this.lastID});
        }
    );
});
app.delete("/categories/:id", (req, res) => {
    invDb.run("DELETE FROM categories WHERE id=?", [req.params.id],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});

// ─── BRANDS / COLORS / FITS Routes ───────────────────────────────────────────
app.get("/brands", (req, res) => {
    invDb.all("SELECT * FROM brands ORDER BY name", [],
        (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.post("/brands", (req, res) => {
    const {name} = req.body;
    if (!name) return res.status(400).json({error:"Name required"});
    invDb.run("INSERT INTO brands (name) VALUES (?)", [name],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true,id:this.lastID}); }
    );
});
app.delete("/brands/:id", (req, res) => {
    invDb.run("DELETE FROM brands WHERE id=?", [req.params.id],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});
app.get("/colors", (req, res) => {
    invDb.all("SELECT * FROM colors ORDER BY name", [],
        (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.post("/colors", (req, res) => {
    const {name,hex} = req.body;
    if (!name) return res.status(400).json({error:"Name required"});
    invDb.run("INSERT INTO colors (name,hex) VALUES (?,?)", [name,hex||null],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true,id:this.lastID}); }
    );
});
app.delete("/colors/:id", (req, res) => {
    invDb.run("DELETE FROM colors WHERE id=?", [req.params.id],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});
app.get("/fits", (req, res) => {
    invDb.all("SELECT * FROM fits ORDER BY name", [],
        (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.post("/fits", (req, res) => {
    const {name} = req.body;
    if (!name) return res.status(400).json({error:"Name required"});
    invDb.run("INSERT INTO fits (name) VALUES (?)", [name],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true,id:this.lastID}); }
    );
});
app.delete("/fits/:id", (req, res) => {
    invDb.run("DELETE FROM fits WHERE id=?", [req.params.id],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});

// ─── CATEGORY L3 Routes ───────────────────────────────────────────────────────
app.get("/category-l3", (req, res) => {
    const {category,subcategory} = req.query;
    let sql = "SELECT * FROM category_l3 WHERE 1=1";
    const p = [];
    if (category)    { sql += " AND category=?";    p.push(category); }
    if (subcategory) { sql += " AND subcategory=?"; p.push(subcategory); }
    sql += " ORDER BY subsubcategory";
    invDb.all(sql, p, (err, rows) =>
        err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.get("/category-l3/sizes", (req, res) => {
    const {category,subcategory,subsubcategory} = req.query;
    invDb.get("SELECT sizes FROM category_l3 WHERE category=? AND subcategory=? AND subsubcategory=?",
        [category,subcategory,subsubcategory], (err, row) => {
            if (err)  return res.status(500).json({error:err.message});
            if (!row) return res.json([]);
            res.json(row.sizes ? row.sizes.split(',').map(s=>s.trim()) : []);
        }
    );
});
app.post("/category-l3", (req, res) => {
    const {category,subcategory,subsubcategory,sizes} = req.body;
    if (!category||!subcategory||!subsubcategory) return res.status(400).json({error:"All L3 fields required"});
    invDb.run("INSERT INTO category_l3 (category,subcategory,subsubcategory,sizes) VALUES (?,?,?,?)",
        [category,subcategory,subsubcategory,sizes||null],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true,id:this.lastID}); }
    );
});
app.put("/category-l3/:id", (req, res) => {
    const {sizes} = req.body;
    invDb.run("UPDATE category_l3 SET sizes=? WHERE id=?", [sizes,req.params.id],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});
app.delete("/category-l3/:id", (req, res) => {
    invDb.run("DELETE FROM category_l3 WHERE id=?", [req.params.id],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});

// ─── SALES ORDER Routes ───────────────────────────────────────────────────────
app.get("/order/temp/:kunnr", (req, res) => {
    const order_id = `&${req.params.kunnr}`;
    transDb.get("SELECT * FROM vbak WHERE order_id=?", [order_id], (err, header) => {
        if (err)     return res.status(500).json({error:err.message});
        if (!header) return res.json(null);
        transDb.all("SELECT * FROM vbap WHERE order_id=?", [order_id], (err, items) => {
            if (err) return res.status(500).json({error:err.message});
            if (!items.length) return res.json({...header, items:[]});
            let pending = items.length;
            const enriched = [];
            items.forEach(item => {
                invDb.get("SELECT brand,brandfamily,size,category,subcategory,subsubcategory,color,fit FROM mara WHERE matnr=?",
                    [item.matnr], (err, prod) => {
                        enriched.push({...item,...(prod||{})});
                        if (--pending===0) res.json({...header, items:enriched});
                    }
                );
            });
        });
    });
});
app.post("/order/temp/:kunnr/add", (req, res) => {
    const kunnr    = req.params.kunnr;
    const order_id = `&${kunnr}`;
    const {matnr, quantity, price, mrp, discount_pct, gst_rate} = req.body;
    if (!matnr||!quantity) return res.status(400).json({error:"matnr and quantity required"});
    transDb.run("INSERT OR IGNORE INTO vbak (order_id,kunnr,status,payment_status) VALUES (?,?,'TEMP','PENDING')",
        [order_id,kunnr], (err) => {
            if (err) return res.status(500).json({error:err.message});
            transDb.get("SELECT * FROM vbap WHERE order_id=? AND matnr=?", [order_id,matnr], (err, existing) => {
                if (err) return res.status(500).json({error:err.message});
                if (existing) {
                    transDb.run("UPDATE vbap SET quantity=quantity+? WHERE order_id=? AND matnr=?",
                        [quantity,order_id,matnr],
                        (err) => err ? res.status(500).json({error:err.message}) : res.json({success:true,updated:true})
                    );
                } else {
                    const m  = mrp          || price || 0;
                    const d  = discount_pct || 0;
                    const g  = gst_rate     || 0;
                    const lt = ((m * (1 - d/100)) + (m * g/100)) * quantity;
                    transDb.run(
                        "INSERT INTO vbap (order_id,matnr,quantity,price,mrp,discount_pct,gst_rate,line_total) VALUES (?,?,?,?,?,?,?,?)",
                        [order_id,matnr,quantity,price||0,m,d,g,lt],
                        (err) => err ? res.status(500).json({error:err.message}) : res.json({success:true,inserted:true})
                    );
                }
            });
        }
    );
});
app.put("/order/temp/:kunnr/item/:matnr", (req, res) => {
    const {quantity} = req.body;
    const order_id = `&${req.params.kunnr}`;
    if (!quantity||quantity<1) return res.status(400).json({error:"Quantity must be at least 1"});
    transDb.run("UPDATE vbap SET quantity=? WHERE order_id=? AND matnr=?",
        [quantity,order_id,req.params.matnr],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});
app.delete("/order/temp/:kunnr/clear", (req, res) => {
    const order_id = `&${req.params.kunnr}`;
    transDb.run("DELETE FROM vbap WHERE order_id=?", [order_id], (err) => {
        if (err) return res.status(500).json({error:err.message});
        transDb.run("DELETE FROM vbak WHERE order_id=? AND status='TEMP'", [order_id], (err) => {
            err ? res.status(500).json({error:err.message}) : res.json({success:true});
        });
    });
});
app.delete("/order/temp/:kunnr/item/:matnr", (req, res) => {
    const order_id = `&${req.params.kunnr}`;
    transDb.run("DELETE FROM vbap WHERE order_id=? AND matnr=?",
        [order_id,req.params.matnr],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});
app.post("/order/place/:kunnr", (req, res) => {
    const kunnr   = req.params.kunnr;
    const temp_id = `&${kunnr}`;
    transDb.get("SELECT * FROM vbak WHERE order_id=?", [temp_id], (err, order) => {
        if (err)    return res.status(500).json({error:err.message});
        if (!order) return res.status(404).json({error:"No temp order found"});
        transDb.all("SELECT * FROM vbap WHERE order_id=?", [temp_id], (err, items) => {
            if (err) return res.status(500).json({error:err.message});
            nextId(transDb, "vbak", "order_id", "S", (err, order_id) => {
                if (err) return res.status(500).json({error:err.message});
                transDb.serialize(() => {
                    transDb.run("BEGIN TRANSACTION");
                    transDb.run("INSERT INTO vbak (order_id,kunnr,status,payment_status,order_type) VALUES (?,?,'CONFIRMED','PENDING','S')", [order_id,kunnr]);
                    transDb.run("UPDATE vbap SET order_id=? WHERE order_id=?", [order_id,temp_id]);
                    transDb.run("DELETE FROM vbak WHERE order_id=?", [temp_id]);
                    transDb.run("COMMIT", (err) => {
                        if (err) return res.status(500).json({error:err.message});
                        items.forEach(item => {
                            invDb.run("UPDATE mara SET reserved=COALESCE(reserved,0)+? WHERE matnr=?",
                                [item.quantity,item.matnr]);
                        });
                        res.json({success:true,order_id});
                    });
                });
            });
        });
    });
});
app.put("/orders/:order_id/payment", (req, res) => {
    const {payment_status,paid_amount} = req.body;
    const valid = ['PENDING','PAID','PARTIALLY_PAID','CANCELLED'];
    if (!valid.includes(payment_status)) return res.status(400).json({error:"Invalid status"});
    transDb.get("SELECT * FROM vbak WHERE order_id=?", [req.params.order_id], (err, order) => {
        if (err||!order) return res.status(404).json({error:"Order not found"});
        const old = order.payment_status;
        transDb.run("UPDATE vbak SET payment_status=?,paid_amount=? WHERE order_id=?",
            [payment_status,paid_amount||0,req.params.order_id], (err) => {
                if (err) return res.status(500).json({error:err.message});
                transDb.all("SELECT * FROM vbap WHERE order_id=?", [req.params.order_id], (err, items) => {
                    if (err) return res.status(500).json({error:err.message});
                    if (payment_status==='PAID' && old!=='PAID') {
                        items.forEach(item => {
                            invDb.run("UPDATE mara SET quantity=MAX(0,quantity-?),reserved=MAX(0,COALESCE(reserved,0)-?) WHERE matnr=?",
                                [item.quantity,item.quantity,item.matnr]);
                        });
                    } else if (payment_status==='CANCELLED' && old!=='CANCELLED') {
                        items.forEach(item => {
                            invDb.run("UPDATE mara SET reserved=MAX(0,COALESCE(reserved,0)-?) WHERE matnr=?",
                                [item.quantity,item.matnr]);
                        });
                    }
                    res.json({success:true});
                });
            }
        );
    });
});
app.get("/orders", (req, res) => {
    const {search,from,to,payment_status,order_type} = req.query;
    let sql = "SELECT * FROM vbak WHERE status='CONFIRMED'";
    const p = [];
    if (payment_status) { sql += " AND payment_status=?"; p.push(payment_status); }
    if (order_type)     { sql += " AND order_type=?";     p.push(order_type); }
    if (from) { sql += " AND created_at>=?"; p.push(from); }
    if (to)   { sql += " AND created_at<=?"; p.push(to+' 23:59:59'); }
    sql += " ORDER BY created_at DESC";
    transDb.all(sql, p, (err, orders) => {
        if (err) return res.status(500).json({error:err.message});
        if (!orders.length) return res.json([]);
        let pending = orders.length;
        const enriched = [];
        orders.forEach(order => {
            custDb.get("SELECT name FROM kna1 WHERE kunnr=?", [order.kunnr], (err, cust) => {
                enriched.push({...order, customer_name: cust?cust.name:order.kunnr});
                if (--pending===0) {
                    let result = enriched;
                    if (search) {
                        const q = search.toLowerCase();
                        result = enriched.filter(o =>
                            o.order_id.toLowerCase().includes(q) ||
                            o.kunnr.toLowerCase().includes(q) ||
                            (o.customer_name||'').toLowerCase().includes(q)
                        );
                    }
                    result.sort((a,b) => b.created_at.localeCompare(a.created_at));
                    res.json(result);
                }
            });
        });
    });
});
app.get("/orders/:order_id", (req, res) => {
    transDb.get("SELECT * FROM vbak WHERE order_id=?", [req.params.order_id], (err, header) => {
        if (err||!header) return res.status(404).json({error:"Order not found"});
        custDb.get("SELECT * FROM kna1 WHERE kunnr=?", [header.kunnr], (err, cust) => {
            const full = {...header,...(cust||{})};
            transDb.all("SELECT * FROM vbap WHERE order_id=?", [req.params.order_id], (err, items) => {
                if (err) return res.status(500).json({error:err.message});
                if (!items.length) return res.json({...full,items:[]});
                let pending = items.length;
                const enriched = [];
                items.forEach(item => {
                    invDb.get("SELECT brand,brandfamily,size,category,subcategory,subsubcategory,color,fit,mrp FROM mara WHERE matnr=?",
                        [item.matnr], (err, prod) => {
                            enriched.push({...item,...(prod||{})});
                            if (--pending===0) res.json({...full,items:enriched});
                        }
                    );
                });
            });
        });
    });
});
app.delete("/orders/:order_id", (req, res) => {
    transDb.all("SELECT * FROM vbap WHERE order_id=?", [req.params.order_id], (err, items) => {
        if (!err && items.length) {
            items.forEach(item => {
                invDb.run("UPDATE mara SET reserved=MAX(0,COALESCE(reserved,0)-?) WHERE matnr=?",
                    [item.quantity,item.matnr]);
            });
        }
        transDb.serialize(() => {
            transDb.run("DELETE FROM vbap WHERE order_id=?", [req.params.order_id]);
            transDb.run("DELETE FROM vbak WHERE order_id=?", [req.params.order_id],
                function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
            );
        });
    });
});

// ─── PURCHASE ORDER Routes ────────────────────────────────────────────────────
app.get("/next-po-id", (req, res) => {
    nextId(transDb, "po_header", "po_id", "P", (err, id) =>
        err ? res.status(500).json({error:err.message}) : res.json({po_id:id})
    );
});
app.get("/purchase-orders", (req, res) => {
    const {search,from,to,payment_status} = req.query;
    let sql = `SELECT po_header.*,
        (SELECT COUNT(*) FROM po_items WHERE po_items.po_id = po_header.po_id) as line_count
        FROM po_header WHERE 1=1`;
    const p = [];
    if (payment_status) { sql += " AND payment_status=?"; p.push(payment_status); }
    if (from) { sql += " AND created_at>=?"; p.push(from); }
    if (to)   { sql += " AND created_at<=?"; p.push(to+' 23:59:59'); }
    sql += " ORDER BY created_at DESC";
    transDb.all(sql, p, (err, orders) => {
        if (err) return res.status(500).json({error:err.message});
        if (!orders.length) return res.json([]);
        let pending = orders.length;
        const enriched = [];
        orders.forEach(order => {
            buyerDb.get("SELECT name FROM buyers WHERE buyer_id=?", [order.buyer_id], (err, buyer) => {
                transDb.get("SELECT COUNT(*) as cnt FROM po_items WHERE po_id=?", [order.po_id], (err2, cntRow) => {
                    enriched.push({...order, buyer_name: buyer?buyer.name:order.buyer_id, line_count: cntRow?cntRow.cnt:0});
                    if (--pending===0) {
                        let result = enriched;
                        if (search) {
                            const q = search.toLowerCase();
                            result = enriched.filter(o =>
                                o.po_id.toLowerCase().includes(q) ||
                                o.buyer_id.toLowerCase().includes(q) ||
                                (o.buyer_name||'').toLowerCase().includes(q)
                            );
                        }
                        result.sort((a,b) => b.created_at.localeCompare(a.created_at));
                        res.json(result);
                    }
                });
            });
        });
    });
});
app.get("/purchase-orders/:po_id", (req, res) => {
    transDb.get("SELECT * FROM po_header WHERE po_id=?", [req.params.po_id], (err, header) => {
        if (err||!header) return res.status(404).json({error:"PO not found"});
        buyerDb.get("SELECT * FROM buyers WHERE buyer_id=?", [header.buyer_id], (err, buyer) => {
            const full = {...header,...(buyer ? {buyer_name:buyer.name,buyer_phone:buyer.phone} : {})};
            transDb.all("SELECT * FROM po_items WHERE po_id=? ORDER BY line_no", [req.params.po_id], (err, items) => {
                if (err) return res.status(500).json({error:err.message});
                if (!items.length) return res.json({...full,items:[]});
                let pending = items.length;
                const enriched = [];
                items.forEach(item => {
                    invDb.get("SELECT brand,category,subcategory,subsubcategory,size,color,fit FROM mara WHERE matnr=?",
                        [item.matnr], (err, prod) => {
                            enriched.push({...item,...(prod||{})});
                            if (--pending===0) res.json({...full,items:enriched.sort((a,b)=>a.line_no-b.line_no)});
                        }
                    );
                });
            });
        });
    });
});
app.post("/purchase-orders", (req, res) => {
    const {buyer_id,po_date,payment_terms,receiver_name,receiver_phone,receiver_email,
           receiver_gstin,tax_id,export_id,addr1,addr2,city,state,country,zip,ship_city,notes,items} = req.body;
    if (!buyer_id) return res.status(400).json({error:"buyer_id required"});
    if (!items||!items.length) return res.status(400).json({error:"At least one line item required"});
    nextId(transDb, "po_header", "po_id", "P", (err, po_id) => {
        if (err) return res.status(500).json({error:err.message});
        transDb.serialize(() => {
            transDb.run("BEGIN TRANSACTION");
            transDb.run(`INSERT INTO po_header (po_id,buyer_id,po_date,payment_terms,receiver_name,receiver_phone,
                receiver_email,receiver_gstin,tax_id,export_id,addr1,addr2,city,state,country,zip,ship_city,notes)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [po_id,buyer_id,po_date||new Date().toISOString().split('T')[0],payment_terms,
                 receiver_name,receiver_phone,receiver_email,receiver_gstin,tax_id,export_id,
                 addr1,addr2,city,state,country||'India',zip,ship_city,notes]
            );
            items.forEach((item, idx) => {
                const line_no    = (idx+1)*10;
                const line_total = (item.quantity||0) * (item.unit_price||0);
                transDb.run("INSERT INTO po_items (po_id,line_no,matnr,quantity,unit_price,line_total) VALUES (?,?,?,?,?,?)",
                    [po_id,line_no,item.matnr,item.quantity||1,item.unit_price||0,line_total]
                );
                // Update cost_price on mara and add stock
                invDb.run("UPDATE mara SET quantity=quantity+?,cost_price=? WHERE matnr=?",
                    [item.quantity||1,item.unit_price||0,item.matnr]);
            });
            transDb.run("COMMIT", (err) => {
                if (err) return res.status(500).json({error:err.message});
                res.json({success:true,po_id});
            });
        });
    });
});
app.put("/purchase-orders/:po_id/payment", (req, res) => {
    const {payment_status} = req.body;
    const valid = ['PENDING','PAID','PARTIALLY_PAID','CANCELLED'];
    if (!valid.includes(payment_status)) return res.status(400).json({error:"Invalid status"});
    transDb.run("UPDATE po_header SET payment_status=? WHERE po_id=?",
        [payment_status,req.params.po_id],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});
app.put("/purchase-orders/:po_id/line/:line_no/status", (req, res) => {
    const {status} = req.body;
    const valid = ['Created', 'Accepted', 'Goods Receipt'];
    if (!valid.includes(status)) return res.status(400).json({error:"Invalid status. Must be Created, Accepted or Goods Receipt"});

    const {po_id, line_no} = req.params;

    transDb.get("SELECT * FROM po_items WHERE po_id=? AND line_no=?", [po_id, line_no], (err, line) => {
        if (err)   return res.status(500).json({error:err.message});
        if (!line) return res.status(404).json({error:"Line item not found"});

        const oldStatus = line.status;

        transDb.run("UPDATE po_items SET status=? WHERE po_id=? AND line_no=?",
            [status, po_id, line_no], (err) => {
                if (err) return res.status(500).json({error:err.message});

                // Only update inventory when transitioning TO Goods Receipt
                if (status === 'Goods Receipt' && oldStatus !== 'Goods Receipt') {
                    invDb.run(
                        "UPDATE mara SET quantity=quantity+?, cost_price=? WHERE matnr=?",
                        [line.quantity, line.unit_price, line.matnr],
                        (err) => { if (err) console.error("❌ Inventory GR error:", err.message); }
                    );
                    console.log(`✅ GR: ${line.quantity} units of ${line.matnr} added to stock`);
                }

                // If reverting FROM Goods Receipt, deduct stock back
                if (oldStatus === 'Goods Receipt' && status !== 'Goods Receipt') {
                    invDb.run(
                        "UPDATE mara SET quantity=MAX(0,quantity-?) WHERE matnr=?",
                        [line.quantity, line.matnr],
                        (err) => { if (err) console.error("❌ Inventory GR reversal error:", err.message); }
                    );
                }

                res.json({success:true, status});
            }
        );
    });
});
app.delete("/purchase-orders/:po_id", (req, res) => {
    transDb.serialize(() => {
        transDb.run("DELETE FROM po_items WHERE po_id=?", [req.params.po_id]);
        transDb.run("DELETE FROM po_header WHERE po_id=?", [req.params.po_id],
            function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
        );
    });
});


// ─── GST CONFIG Routes ────────────────────────────────────────────────────────
app.get("/gst-config", (req, res) => {
    pricingDb.all("SELECT * FROM gst_config ORDER BY tax_category", [],
        (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.get("/gst-config/rate", (req, res) => {
    const {tax_category} = req.query;
    if (!tax_category) return res.status(400).json({error:"tax_category required"});
    const today = new Date().toISOString().split('T')[0].replace(/-/g,'');
    pricingDb.get(
        "SELECT gst_rate FROM gst_config WHERE tax_category=? AND valid_from<=? AND (valid_to>=? OR valid_to='12319999') ORDER BY valid_from DESC LIMIT 1",
        [tax_category, today, today],
        (err, row) => {
            if (err)  return res.status(500).json({error:err.message});
            if (!row) return res.json({gst_rate:0});
            res.json({gst_rate: row.gst_rate});
        }
    );
});
app.post("/gst-config", (req, res) => {
    const {tax_category, gst_rate, valid_from, valid_to} = req.body;
    if (!tax_category || gst_rate == null || !valid_from)
        return res.status(400).json({error:"tax_category, gst_rate and valid_from required"});
    pricingDb.run(
        "INSERT INTO gst_config (tax_category,gst_rate,valid_from,valid_to) VALUES (?,?,?,?)",
        [tax_category, gst_rate, valid_from, valid_to||'12319999'],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true,id:this.lastID}); }
    );
});
app.put("/gst-config/:id", (req, res) => {
    const {tax_category, gst_rate, valid_from, valid_to} = req.body;
    pricingDb.run(
        "UPDATE gst_config SET tax_category=?,gst_rate=?,valid_from=?,valid_to=? WHERE id=?",
        [tax_category, gst_rate, valid_from, valid_to||'12319999', req.params.id],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});
app.delete("/gst-config/:id", (req, res) => {
    pricingDb.run("DELETE FROM gst_config WHERE id=?", [req.params.id],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});

// ─── PRICING Routes ───────────────────────────────────────────────────────────
app.get("/pricing/sales", (req, res) => {
    const {matnr} = req.query;
    let sql = "SELECT * FROM sales_price WHERE 1=1";
    const p = [];
    if (matnr) { sql += " AND matnr=?"; p.push(matnr); }
    sql += " ORDER BY valid_from DESC";
    pricingDb.all(sql, p, (err, rows) =>
        err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.post("/pricing/sales", (req, res) => {
    const {matnr,valid_from,valid_to,unit_price} = req.body;
    if (!matnr||!valid_from||!unit_price) return res.status(400).json({error:"matnr, valid_from and unit_price required"});
    pricingDb.run("INSERT INTO sales_price (matnr,valid_from,valid_to,unit_price) VALUES (?,?,?,?)",
        [matnr,valid_from,valid_to||null,unit_price],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true,id:this.lastID}); }
    );
});
app.delete("/pricing/sales/:id", (req, res) => {
    pricingDb.run("DELETE FROM sales_price WHERE id=?", [req.params.id],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});
app.get("/pricing/customer-discount", (req, res) => {
    pricingDb.all("SELECT * FROM customer_discount ORDER BY kunnr,valid_from DESC", [],
        (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.post("/pricing/customer-discount", (req, res) => {
    const {kunnr,discount_pct,valid_from,valid_to} = req.body;
    if (!kunnr||discount_pct==null||!valid_from) return res.status(400).json({error:"kunnr, discount_pct and valid_from required"});
    pricingDb.run("INSERT INTO customer_discount (kunnr,discount_pct,valid_from,valid_to) VALUES (?,?,?,?)",
        [kunnr,discount_pct,valid_from,valid_to||null],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true,id:this.lastID}); }
    );
});
app.delete("/pricing/customer-discount/:id", (req, res) => {
    pricingDb.run("DELETE FROM customer_discount WHERE id=?", [req.params.id],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});
app.get("/pricing/product-discount", (req, res) => {
    pricingDb.all("SELECT * FROM product_discount ORDER BY matnr,valid_from DESC", [],
        (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.post("/pricing/product-discount", (req, res) => {
    const {matnr,discount_pct,valid_from,valid_to} = req.body;
    if (!matnr||discount_pct==null||!valid_from) return res.status(400).json({error:"matnr, discount_pct and valid_from required"});
    pricingDb.run("INSERT INTO product_discount (matnr,discount_pct,valid_from,valid_to) VALUES (?,?,?,?)",
        [matnr,discount_pct,valid_from,valid_to||null],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true,id:this.lastID}); }
    );
});
app.delete("/pricing/product-discount/:id", (req, res) => {
    pricingDb.run("DELETE FROM product_discount WHERE id=?", [req.params.id],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});

// ─── Customer Detail Routes ───────────────────────────────────────────────────
app.get("/customers/:kunnr/orders", (req, res) => {
    const {kunnr} = req.params;
    transDb.all(
        `SELECT v.*,
                (SELECT COUNT(*) FROM vbap WHERE order_id=v.order_id) as line_count,
                (SELECT SUM(line_total) FROM vbap WHERE order_id=v.order_id) as order_total
         FROM vbak v
         WHERE v.kunnr=? AND v.status='CONFIRMED'
         ORDER BY v.created_at DESC`,
        [kunnr], (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.get("/customers/:kunnr/discounts", (req, res) => {
    const {kunnr} = req.params;
    pricingDb.all(
        "SELECT * FROM customer_discount WHERE kunnr=? ORDER BY valid_from DESC",
        [kunnr], (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.get("/customers/:kunnr/stats", (req, res) => {
    const {kunnr} = req.params;
    transDb.get(
        `SELECT
            COUNT(CASE WHEN order_type='S' THEN 1 END) as total_orders,
            COUNT(CASE WHEN order_type='R' THEN 1 END) as total_returns,
            COUNT(CASE WHEN payment_status='PAID' AND order_type='S' THEN 1 END) as paid_orders,
            COUNT(CASE WHEN payment_status='PENDING' AND order_type='S' THEN 1 END) as pending_orders,
            SUM(CASE WHEN order_type='S' AND payment_status='PAID' THEN paid_amount ELSE 0 END) as total_revenue
         FROM vbak WHERE kunnr=? AND status='CONFIRMED'`,
        [kunnr], (err, row) => err ? res.status(500).json({error:err.message}) : res.json(row||{})
    );
});

// ─── Item Detail Routes ───────────────────────────────────────────────────────
app.get("/inventory/:matnr/sales-history", (req, res) => {
    const {matnr} = req.params;
    transDb.all(
        `SELECT v.order_id, v.kunnr, v.created_at, v.payment_status, v.order_type,
                p.quantity, p.price, p.mrp, p.discount_pct, p.gst_rate, p.line_total
         FROM vbap p JOIN vbak v ON v.order_id=p.order_id
         WHERE p.matnr=? AND v.status='CONFIRMED'
         ORDER BY v.created_at DESC LIMIT 50`,
        [matnr], (err, rows) => {
            if (err) return res.status(500).json({error:err.message});
            if (!rows.length) return res.json([]);
            let pending = rows.length;
            const enriched = [];
            rows.forEach(row => {
                custDb.get("SELECT name FROM kna1 WHERE kunnr=?", [row.kunnr], (err, cust) => {
                    enriched.push({...row, customer_name: cust ? cust.name : row.kunnr});
                    if (--pending === 0) {
                        enriched.sort((a,b) => b.created_at.localeCompare(a.created_at));
                        res.json(enriched);
                    }
                });
            });
        }
    );
});
app.get("/inventory/:matnr/po-history", (req, res) => {
    const {matnr} = req.params;
    transDb.all(
        `SELECT h.po_id, h.buyer_id, h.po_date, h.payment_status,
                i.line_no, i.quantity, i.unit_price, i.line_total, i.status
         FROM po_items i JOIN po_header h ON h.po_id=i.po_id
         WHERE i.matnr=?
         ORDER BY h.po_date DESC LIMIT 50`,
        [matnr], (err, rows) => {
            if (err) return res.status(500).json({error:err.message});
            if (!rows.length) return res.json([]);
            let pending = rows.length;
            const enriched = [];
            rows.forEach(row => {
                buyerDb.get("SELECT name FROM buyers WHERE buyer_id=?", [row.buyer_id], (err, buyer) => {
                    enriched.push({...row, buyer_name: buyer ? buyer.name : row.buyer_id});
                    if (--pending === 0) {
                        enriched.sort((a,b) => (b.po_date||'').localeCompare(a.po_date||''));
                        res.json(enriched);
                    }
                });
            });
        }
    );
});
app.get("/inventory/:matnr/pricing", (req, res) => {
    const {matnr} = req.params;
    pricingDb.all(
        "SELECT * FROM sales_price WHERE matnr=? ORDER BY valid_from DESC",
        [matnr], (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});

// ─── Return Reasons Routes ────────────────────────────────────────────────────
app.get("/return-reasons", (req, res) => {
    transDb.all("SELECT * FROM return_reasons WHERE active=1 ORDER BY reason", [],
        (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.post("/return-reasons", (req, res) => {
    const {reason} = req.body;
    if (!reason) return res.status(400).json({error:"reason required"});
    transDb.run("INSERT INTO return_reasons (reason) VALUES (?)", [reason],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true,id:this.lastID}); }
    );
});
app.delete("/return-reasons/:id", (req, res) => {
    transDb.run("UPDATE return_reasons SET active=0 WHERE id=?", [req.params.id],
        function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
    );
});

// ─── Return Order Routes ──────────────────────────────────────────────────────
app.get("/orders/search-for-return", (req, res) => {
    const {kunnr, from, to} = req.query;
    if (!kunnr) return res.status(400).json({error:"kunnr required"});
    let sql = "SELECT * FROM vbak WHERE kunnr=? AND (order_type='S' OR order_type IS NULL) AND status='CONFIRMED'";
    const params = [kunnr];
    if (from) { sql += " AND date(created_at)>=?"; params.push(from); }
    if (to)   { sql += " AND date(created_at)<=?"; params.push(to);   }
    sql += " ORDER BY created_at DESC";
    transDb.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({error:err.message});
        if (!rows.length) return res.json([]);
        let pending = rows.length;
        const enriched = [];
        rows.forEach(row => {
            custDb.get("SELECT name FROM kna1 WHERE kunnr=?", [row.kunnr], (err, cust) => {
                enriched.push({...row, name: cust ? cust.name : row.kunnr});
                if (--pending === 0) {
                    enriched.sort((a,b) => b.created_at.localeCompare(a.created_at));
                    res.json(enriched);
                }
            });
        });
    });
});
app.post("/orders/return", (req, res) => {
    const {kunnr, original_order_id, return_reason, items} = req.body;
    if (!kunnr)         return res.status(400).json({error:"kunnr required"});
    if (!return_reason) return res.status(400).json({error:"return_reason required"});
    if (!items || !items.length) return res.status(400).json({error:"items required"});

    nextId(transDb, "vbak", "order_id", "R", (err, order_id) => {
        if (err) return res.status(500).json({error:err.message});
        transDb.serialize(() => {
            transDb.run("BEGIN TRANSACTION");
            transDb.run(
                "INSERT INTO vbak (order_id,kunnr,status,payment_status,order_type,original_order_id,return_reason) VALUES (?,?,'CONFIRMED','PENDING','R',?,?)",
                [order_id, kunnr, original_order_id||null, return_reason]
            );
            const stmt = transDb.prepare(
                "INSERT INTO vbap (order_id,matnr,quantity,price,mrp,discount_pct,gst_rate,line_total) VALUES (?,?,?,?,?,?,?,?)"
            );
            items.forEach(item => {
                const lt = ((parseFloat(item.mrp||0) * (1-(parseFloat(item.discount_pct||0)/100))) +
                            (parseFloat(item.mrp||0) * (parseFloat(item.gst_rate||0)/100))) * item.quantity;
                stmt.run(order_id, item.matnr, item.quantity, item.price||0,
                    item.mrp||0, item.discount_pct||0, item.gst_rate||0, lt);
            });
            stmt.finalize();
            transDb.run("COMMIT", (err) => {
                if (err) { transDb.run("ROLLBACK"); return res.status(500).json({error:err.message}); }
                items.forEach(item => {
                    invDb.run("UPDATE mara SET quantity=quantity+? WHERE matnr=?",
                        [item.quantity, item.matnr]);
                });
                res.json({success:true, order_id});
            });
        });
    });
});

// ─── HR: Config — Departments ─────────────────────────────────────────────────
app.get("/hr/departments", (req, res) => {
    hrDb.all("SELECT * FROM departments ORDER BY name", [],
        (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.post("/hr/departments", (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({error:"Name required"});
    hrDb.run("INSERT INTO departments (name) VALUES (?)", [name.trim()],
        function(err) {
            if (err && err.message.includes("UNIQUE")) return res.status(409).json({error:"Department already exists"});
            if (err) return res.status(500).json({error:err.message});
            res.json({success:true, id:this.lastID});
        }
    );
});
app.delete("/hr/departments/:id", (req, res) => {
    hrDb.get("SELECT COUNT(*) as cnt FROM employees WHERE department = (SELECT name FROM departments WHERE id=?)", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({error:err.message});
        if (row && row.cnt > 0) return res.status(409).json({error:"Department is in use by active employees"});
        hrDb.run("DELETE FROM departments WHERE id=?", [req.params.id],
            function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
        );
    });
});

// ─── HR: Config — Designations ────────────────────────────────────────────────
app.get("/hr/designations", (req, res) => {
    hrDb.all("SELECT * FROM designations ORDER BY name", [],
        (err, rows) => err ? res.status(500).json({error:err.message}) : res.json(rows)
    );
});
app.post("/hr/designations", (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({error:"Name required"});
    hrDb.run("INSERT INTO designations (name) VALUES (?)", [name.trim()],
        function(err) {
            if (err && err.message.includes("UNIQUE")) return res.status(409).json({error:"Designation already exists"});
            if (err) return res.status(500).json({error:err.message});
            res.json({success:true, id:this.lastID});
        }
    );
});
app.delete("/hr/designations/:id", (req, res) => {
    hrDb.get("SELECT COUNT(*) as cnt FROM employees WHERE designation = (SELECT name FROM designations WHERE id=?)", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({error:err.message});
        if (row && row.cnt > 0) return res.status(409).json({error:"Designation is in use by active employees"});
        hrDb.run("DELETE FROM designations WHERE id=?", [req.params.id],
            function(err) { err ? res.status(500).json({error:err.message}) : res.json({success:true}); }
        );
    });
});

// ─── SPA Fallback (React Router) ─────────────────────────────────────────────
app.use((req, res) => {
    res.sendFile(path.join(__dirname, "public/dist", "index.html"));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(3000, () => console.log("🚀 Server running on http://localhost:3000"));
