import supabase from '../../_lib/supabase.js';
import { protect } from '../../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = await protect(req, res);
  if (!user) return;

  const { id } = req.query;
  const limit  = parseInt(req.query.limit)  || 15;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const { data: tasks, error: taskErr } = await supabase
      .from('tasks').select('id, title').eq('project_id', id);

    if (taskErr) throw taskErr;
    if (!tasks || tasks.length === 0) return res.json({ history: [], has_more: false });

    const taskIds = tasks.map(t => t.id);
    const taskTitleMap = Object.fromEntries(tasks.map(t => [t.id, t.title]));

    const { data: history, error: histErr } = await supabase
      .from('task_history')
      .select('*')
      .in('task_id', taskIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (histErr) throw histErr;

    const enriched = (history || []).map(h => ({
      ...h,
      task_title: taskTitleMap[h.task_id] || 'Deleted task',
    }));

    res.json({ history: enriched, has_more: (history || []).length > limit });
  } catch (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') {
      return res.json({ history: [], has_more: false });
    }
    res.status(500).json({ error: error.message });
  }
}
