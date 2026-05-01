import supabase from '../../_lib/supabase.js';
import { protect } from '../../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = await protect(req, res);
  if (!user) return;

  const { id } = req.query;
  try {
    const { data: tasks, error } = await supabase
      .from('tasks').select('status').eq('project_id', id);
    if (error) throw error;

    const total       = tasks.length;
    const done        = tasks.filter(t => t.status === 'done').length;
    const in_progress = tasks.filter(t => t.status === 'in_progress').length;
    const todo        = tasks.filter(t => t.status === 'todo').length;

    res.json({ total, done, in_progress, todo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
