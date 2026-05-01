import supabase from '../../_lib/supabase.js';
import { protect } from '../../_lib/auth.js';

function canModify(user, project) {
  return user.role === 'Admin' || project.owner_id === user.id;
}

export default async function handler(req, res) {
  const user = await protect(req, res);
  if (!user) return;
  const { id } = req.query;

  if (req.method === 'GET') {
    const { data: project, error } = await supabase
      .from('projects')
      .select('*, owner:owner_id(id, name, email)')
      .eq('id', id)
      .single();
    if (error || !project) return res.status(404).json({ error: 'Project not found' });
    return res.json(project);
  }

  if (req.method === 'PATCH') {
    const { data: project } = await supabase.from('projects').select('owner_id').eq('id', id).single();
    if (!project) return res.status(404).json({ error: 'Not found' });
    if (!canModify(user, project)) return res.status(403).json({ error: 'Not authorized. Only the project owner or an Admin can edit.' });

    const { data: updated, error } = await supabase
      .from('projects')
      .update(req.body)
      .eq('id', id)
      .select('*, owner:owner_id(id, name, email)')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(updated);
  }

  if (req.method === 'DELETE') {
    const { data: project } = await supabase.from('projects').select('owner_id').eq('id', id).single();
    if (!project) return res.status(404).json({ error: 'Not found' });
    if (!canModify(user, project)) return res.status(403).json({ error: 'Not authorized. Only the project owner or an Admin can delete.' });

    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.status(405).end();
}
