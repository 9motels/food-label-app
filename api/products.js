import { initDB } from '../lib/db.js';

export default async function handler(req, res) {
  let client;
  try {
    client = await initDB();
  } catch (e) {
    console.error('DB init error:', e);
    return res.status(500).json({ error: 'Database unavailable', details: e.message });
  }

  // GET /api/products — list all active products
  if (req.method === 'GET') {
    const { rows } = await client.execute(
      'SELECT * FROM products WHERE active = 1 ORDER BY category, sort_order, name'
    );
    return res.json(rows);
  }

  // POST /api/products — create a new product
  if (req.method === 'POST') {
    const { name, category, shelf_life_hours } = req.body;
    if (!name || !shelf_life_hours) {
      return res.status(400).json({ error: 'name and shelf_life_hours are required' });
    }
    const result = await client.execute({
      sql: 'INSERT INTO products (name, category, shelf_life_hours) VALUES (?, ?, ?)',
      args: [name.trim(), (category || 'General').trim(), parseFloat(shelf_life_hours)],
    });
    return res.json({
      id:               Number(result.lastInsertRowid),
      name:             name.trim(),
      category:         (category || 'General').trim(),
      shelf_life_hours: parseFloat(shelf_life_hours),
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
