const { supabase, protect } = require('../../_helpers');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = await protect(req, res);
  if (!user) return;
  const { id } = req.query;
  const { data: tasks, error } = await supabase.from('tasks').select('status').eq('project_id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({
    total:       tasks.length,
    done:        tasks.filter(function(t) { return t.status === 'done'; }).length,
    in_progress: tasks.filter(function(t) { return t.status === 'in_progress'; }).length,
    todo:        tasks.filter(function(t) { return t.status === 'todo'; }).length,
  });
};
