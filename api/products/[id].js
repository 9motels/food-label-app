const { initDB } = require('../../lib/db');

module.exports = async function handler(req, res) {
  let client;
  try {
    client = await initDB();
  } catch (e) {
    return res.status(500).json({ error: 'Database unavailable', details: e.message });
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  // PUT /api/products/:id — update a product
  if (req.method === 'PUT') {
    const { name, category, shelf_life_hours } = req.body;
    if (!name || !shelf_life_hours) {
      return res.status(400).json({ error: 'name and shelf_life_hours are required' });
    }
    await client.execute({
      sql: 'UPDATE products SET name = ?, category = ?, shelf_life_hours = ? WHERE id = ?',
      args: [name.trim(), (category || 'General').trim(), parseFloat(shelf_life_hours), id],
    });
    return res.json({ success: true });
  }

  // DELETE /api/products/:id — soft-delete (sets active = 0)
  if (req.method === 'DELETE') {
    await client.execute({
      sql: 'UPDATE products SET active = 0 WHERE id = ?',
      args: [id],
    });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
