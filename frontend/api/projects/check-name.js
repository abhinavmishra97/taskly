const { supabase, protect } = require('../_helpers');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = await protect(req, res);
  if (!user) return;
  const { name, exclude_id } = req.query;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  let query = supabase.from('projects').select('id').ilike('name', name);
  if (exclude_id) query = query.neq('id', exclude_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ available: data.length === 0 });
};
