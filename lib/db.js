const { createClient } = require('@libsql/client');

let _client = null;
let _initialized = false;

function getClient() {
  if (!_client) {
    _client = createClient({
      url:       process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

// All 37 default products — [name, category, shelf_life_hours, sort_order]
const SEED_ITEMS = [
  // Salsas & Sauces
  ['Pico de Gallo',                 'Salsas & Sauces',  120,  1],
  ['Salsa',                         'Salsas & Sauces',  168,  2],
  ['Guacamole Thaw',                'Salsas & Sauces',   96,  3],
  ['Guacamole Prepared',            'Salsas & Sauces',   24,  4],
  ['Queso — Hot Well',              'Salsas & Sauces',    2,  5],
  ['Queso — Refrigerated',          'Salsas & Sauces',  168,  6],
  // Proteins
  ['Chicken Tinga — Thawed',        'Proteins',          336,  7],
  ['Chicken Tinga — Hot Well',      'Proteins',            4,  8],
  ['Flank Steak — Thawed',          'Proteins',          336,  9],
  ['Flank Steak — Hot Well',        'Proteins',            4, 10],
  ['Green Chili Pork — Thawed',     'Proteins',          336, 11],
  ['Green Chili Pork — Hot Well',   'Proteins',            4, 12],
  ['Chicken Fajita — Thawed',       'Proteins',          120, 13],
  ['Chicken Fajita — Hot Well',     'Proteins',            4, 14],
  ['Barbacoa — Thawed',             'Proteins',          336, 15],
  ['Barbacoa — Hot Well',           'Proteins',            4, 16],
  // Sides
  ['Corn',                          'Sides',               4, 17],
  ['Rice',                          'Sides',               4, 18],
  ['Fajita Mix',                    'Sides',               4, 19],
  ['Fresh Made Fajita Mix',         'Sides',             120, 20],
  ['Prepared Fajita Mix',           'Sides',               4, 21],
  ['Mexican Street Corn — Hot Well','Sides',               2, 22],
  ['Black Beans — Hot Well',        'Sides',               4, 23],
  ['Black Beans — Refrigerated',    'Sides',             120, 24],
  ['Mexican Beans — Hot Well',      'Sides',               4, 25],
  ['Mexican Beans — Refrigerated',  'Sides',             120, 26],
  // Produce
  ['Lettuce',                       'Produce',           120, 27],
  ['Cilantro',                      'Produce',           168, 28],
  ['Limes',                         'Produce',            72, 29],
  // Dairy
  ['Cheddar Cheese',                'Dairy',             168, 30],
  ['Oaxaca Cheese',                 'Dairy',             168, 31],
  ['Liquid Eggs',                   'Dairy',              96, 32],
  ['Mexican Sour Cream',            'Dairy',             168, 33],
  // Dressings
  ['Jalapeño Ranch',                'Dressings',         168, 34],
  ['Poblano Ranch',                 'Dressings',         168, 35],
  ['Chipotle Ranch',                'Dressings',         168, 36],
  // Dry Goods
  ['Tortilla Strips',               'Dry Goods',         336, 37],
];

async function initDB() {
  if (_initialized) return getClient();
  const client = getClient();

  await client.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT    NOT NULL,
      category         TEXT    NOT NULL DEFAULT 'General',
      shelf_life_hours REAL    NOT NULL,
      active           INTEGER NOT NULL DEFAULT 1,
      sort_order       INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Seed if empty
  const { rows } = await client.execute('SELECT COUNT(*) as n FROM products');
  const count = Number(rows[0].n);
  if (count === 0) {
    await client.batch(
      SEED_ITEMS.map(([name, category, shelf_life_hours, sort_order]) => ({
        sql: 'INSERT INTO products (name, category, shelf_life_hours, sort_order) VALUES (?, ?, ?, ?)',
        args: [name, category, shelf_life_hours, sort_order],
      })),
      'write'
    );
    console.log('Seeded default menu items.');
  }

  _initialized = true;
  return client;
}

module.exports = { initDB };
