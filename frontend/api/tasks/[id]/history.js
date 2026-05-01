import supabase from '../../_lib/supabase.js';
import { protect } from '../../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = await protect(req, res);
  if (!user) return;

  const { id } = req.query;
  try {
    const { data: history, error } = await supabase
      .from('task_history')
      .select('*')
      .eq('task_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ history: history || [] });
  } catch (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') {
      return res.json({ history: [] });
    }
    res.status(500).json({ error: error.message });
  }
}
