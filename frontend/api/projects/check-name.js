import supabase from '../_lib/supabase.js';
import { protect } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = await protect(req, res);
  if (!user) return;

  const { name, exclude_id } = req.query;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    let query = supabase.from('projects').select('id').ilike('name', name);
    if (exclude_id) query = query.neq('id', exclude_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ available: data.length === 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
