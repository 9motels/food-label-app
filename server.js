const express = require('express');
const Database = require('better-sqlite3');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------
const db = new Database(path.join(__dirname, 'labels.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL,
    category  TEXT    NOT NULL DEFAULT 'General',
    shelf_life_hours REAL NOT NULL,
    active    INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS print_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    product_name TEXT,
    opened_at  TEXT,
    expires_at TEXT,
    printed_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// Seed with some common Mexican restaurant items if empty
const count = db.prepare('SELECT COUNT(*) as n FROM products').get();
if (count.n === 0) {
  const insert = db.prepare(
    'INSERT INTO products (name, category, shelf_life_hours, sort_order) VALUES (?, ?, ?, ?)'
  );
  const items = [
    // Salsas & Sauces
    ['Pico de Gallo',               'Salsas & Sauces',  120,  1],
    ['Salsa',                       'Salsas & Sauces',  168,  2],
    ['Guacamole Thaw',              'Salsas & Sauces',  96,   3],
    ['Guacamole Prepared',          'Salsas & Sauces',  24,   4],
    ['Queso — Hot Well',            'Salsas & Sauces',  2,    5],
    ['Queso — Refrigerated',        'Salsas & Sauces',  168,  6],
    // Proteins
    ['Chicken Tinga — Thawed',      'Proteins',         336,  7],
    ['Chicken Tinga — Hot Well',    'Proteins',         4,    8],
    ['Flank Steak — Thawed',        'Proteins',         336,  9],
    ['Flank Steak — Hot Well',      'Proteins',         4,    10],
    ['Green Chili Pork — Thawed',   'Proteins',         336,  11],
    ['Green Chili Pork — Hot Well', 'Proteins',         4,    12],
    ['Chicken Fajita — Thawed',     'Proteins',         120,  13],
    ['Chicken Fajita — Hot Well',   'Proteins',         4,    14],
    ['Barbacoa — Thawed',           'Proteins',         336,  15],
    ['Barbacoa — Hot Well',         'Proteins',         4,    16],
    // Sides
    ['Corn',                        'Sides',            4,    17],
    ['Rice',                        'Sides',            4,    18],
    ['Fajita Mix',                  'Sides',            4,    19],
    ['Fresh Made Fajita Mix',       'Sides',            120,  20],
    ['Prepared Fajita Mix',         'Sides',            4,    21],
    ['Mexican Street Corn — Hot Well','Sides',          2,    22],
    ['Black Beans — Hot Well',      'Sides',            4,    23],
    ['Black Beans — Refrigerated',  'Sides',            120,  24],
    ['Mexican Beans — Hot Well',    'Sides',            4,    25],
    ['Mexican Beans — Refrigerated','Sides',            120,  26],
    // Produce
    ['Lettuce',                     'Produce',          120,  27],
    ['Cilantro',                    'Produce',          168,  28],
    ['Limes',                       'Produce',          72,   29],
    // Dairy
    ['Cheddar Cheese',              'Dairy',            168,  30],
    ['Oaxaca Cheese',               'Dairy',            168,  31],
    ['Liquid Eggs',                 'Dairy',            96,   32],
    ['Mexican Sour Cream',          'Dairy',            168,  33],
    // Dressings
    ['Jalapeño Ranch',              'Dressings',        168,  34],
    ['Poblano Ranch',               'Dressings',        168,  35],
    ['Chipotle Ranch',              'Dressings',        168,  36],
    // Dry Goods
    ['Tortilla Strips',             'Dry Goods',        336,  37],
  ];
  for (const item of items) insert.run(...item);
  console.log('Seeded default menu items.');
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Products API
// ---------------------------------------------------------------------------
app.get('/api/products', (req, res) => {
  const products = db
    .prepare('SELECT * FROM products WHERE active = 1 ORDER BY category, sort_order, name')
    .all();
  res.json(products);
});

app.post('/api/products', (req, res) => {
  const { name, category, shelf_life_hours } = req.body;
  if (!name || !shelf_life_hours) {
    return res.status(400).json({ error: 'name and shelf_life_hours are required' });
  }
  const result = db
    .prepare('INSERT INTO products (name, category, shelf_life_hours) VALUES (?, ?, ?)')
    .run(name.trim(), (category || 'General').trim(), parseFloat(shelf_life_hours));
  res.json({ id: result.lastInsertRowid, name, category, shelf_life_hours });
});

app.put('/api/products/:id', (req, res) => {
  const { name, category, shelf_life_hours } = req.body;
  db.prepare(
    'UPDATE products SET name = ?, category = ?, shelf_life_hours = ? WHERE id = ?'
  ).run(name.trim(), (category || 'General').trim(), parseFloat(shelf_life_hours), req.params.id);
  res.json({ success: true });
});

app.delete('/api/products/:id', (req, res) => {
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Printer helpers
// ---------------------------------------------------------------------------
const USB_PRINTERS = ['/dev/usb/lp0', '/dev/usb/lp1'];

// Try to write ZPL to a single USB path. Returns true on success, false on any error.
function tryPrintToPath(usbPath, zpl, copies) {
  try {
    if (!fs.existsSync(usbPath)) return { ok: false, error: 'Device not found' };
    for (let i = 0; i < copies; i++) {
      fs.writeFileSync(usbPath, zpl, { flag: 'a' });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Check which printers are currently reachable
function getPrinterStatus() {
  return USB_PRINTERS.map((p, i) => ({
    id: i + 1,
    path: p,
    online: fs.existsSync(p),
    name: `Printer ${i + 1}`
  }));
}

// Printer status endpoint — called by UI on load and periodically
app.get('/api/printers', (req, res) => {
  res.json(getPrinterStatus());
});

// ---------------------------------------------------------------------------
// Print API  — tries Printer 1 first, falls back to Printer 2 automatically
// ---------------------------------------------------------------------------
app.post('/api/print', (req, res) => {
  const { productId, productName, openedAt, expiresAt, copies = 1 } = req.body;

  if (!productName || !openedAt || !expiresAt) {
    return res.status(400).json({ error: 'productName, openedAt, expiresAt required' });
  }

  const zpl = buildZPL(productName, openedAt, expiresAt);

  let usedPrinter = null;
  let lastError = '';

  // Try each USB printer in order — first success wins
  for (const usbPath of USB_PRINTERS) {
    const result = tryPrintToPath(usbPath, zpl, copies);
    if (result.ok) {
      usedPrinter = usbPath;
      break;
    } else {
      lastError = result.error;
      console.warn(`Print failed on ${usbPath}: ${result.error} — trying next printer`);
    }
  }

  // Last-resort fallback: CUPS lp command
  if (!usedPrinter) {
    try {
      const safeZpl = zpl.replace(/'/g, "'\\''");
      for (let i = 0; i < copies; i++) {
        execSync(`printf '%s' '${safeZpl}' | lp`, { timeout: 5000 });
      }
      usedPrinter = 'cups';
    } catch (e) {
      lastError = e.message;
    }
  }

  if (!usedPrinter) {
    console.error('All printers failed. Last error:', lastError);
    return res.status(500).json({
      error: 'No printer available. Check that at least one printer is on and connected.',
      details: lastError
    });
  }

  const printerNum = usedPrinter === 'cups' ? 'CUPS'
    : usedPrinter === USB_PRINTERS[0] ? 'Printer 1'
    : 'Printer 2 (failover)';

  console.log(`Printed "${productName}" on ${printerNum}`);

  // Log the print
  if (productId) {
    db.prepare(
      'INSERT INTO print_log (product_id, product_name, opened_at, expires_at) VALUES (?, ?, ?, ?)'
    ).run(productId, productName, openedAt, expiresAt);
  }

  res.json({ success: true, printer: printerNum });
});

// Print log
app.get('/api/log', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM print_log ORDER BY printed_at DESC LIMIT 100')
    .all();
  res.json(rows);
});

// ---------------------------------------------------------------------------
// ZPL label builder
// Designed for a 2" x 2" label (406 x 406 dots at 203 dpi)
// Adjust ^PW and ^LL if your label stock is a different size
// ---------------------------------------------------------------------------
function buildZPL(name, openedAt, expiresAt) {
  // Truncate long names so they fit on the label
  const safeName = name.length > 22 ? name.substring(0, 21) + '…' : name;

  return [
    '^XA',
    '^PW406',       // print width: 2 inches at 203 dpi
    '^LL406',       // label length: 2 inches
    '^CI28',        // UTF-8 encoding
    // Product name — large, bold
    `^FO15,18^A0N,52,48^FD${safeName}^FS`,
    // Divider line
    '^FO15,80^GB376,3,3^FS',
    // Opened row
    '^FO15,95^A0N,30,26^FDOpened:^FS',
    `^FO165,95^A0N,30,26^FD${openedAt}^FS`,
    // Expires row
    '^FO15,140^A0N,30,26^FDExpires:^FS',
    `^FO165,140^A0N,30,26^FD${expiresAt}^FS`,
    // Footer divider
    '^FO15,182^GB376,2,2^FS',
    // Small footer
    '^FO15,190^A0N,20,18^FDSee bottom label for allergens^FS',
    '^XZ',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌮 Food Label App running at http://localhost:${PORT}`);
  console.log(`   Admin panel:  http://localhost:${PORT}/admin.html`);
  console.log(`   Station view: http://localhost:${PORT}/\n`);
});
