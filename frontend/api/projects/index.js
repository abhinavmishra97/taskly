import supabase from '../_lib/supabase.js';
import { protect } from '../_lib/auth.js';

export default async function handler(req, res) {
  const user = await protect(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.max(1, parseInt(req.query.limit) || 12);
    const search = (req.query.search || '').trim();
    const offset = (page - 1) * limit;

    let query = supabase
      .from('projects')
      .select('*, owner:owner_id (id, name, email)', { count: 'exact' });

    if (search) query = query.ilike('name', `%${search}%`);

    const { data: projects, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ projects, total: count ?? 0, page, limit });
  }

  if (req.method === 'POST') {
    const { data: project, error } = await supabase
      .from('projects')
      .insert([{ name: req.body.name, description: req.body.description, owner_id: user.id }])
      .select('*, owner:owner_id (id, name, email)')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(project);
  }

  res.status(405).end();
}
