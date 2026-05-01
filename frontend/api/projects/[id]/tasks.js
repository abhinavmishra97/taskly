const { supabase, protect, recordHistory, getUserName } = require('../../_helpers');

module.exports = async function handler(req, res) {
  const user = await protect(req, res);
  if (!user) return;
  const { id } = req.query;

  if (req.method === 'GET') {
    let query = supabase.from('tasks')
      .select('*, assignee:assignee_id(id, name, email), creator:creator_id(id, name, email)')
      .eq('project_id', id);
    if (req.query.status)   query = query.eq('status', req.query.status);
    if (req.query.assignee) query = query.eq('assignee_id', req.query.assignee);
    const { data: tasks, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ tasks, total: tasks.length, page: 1, limit: 500 });
  }

  if (req.method === 'POST') {
    const { title, description, priority, assignee_id, due_date } = req.body;
    const { data: task, error } = await supabase.from('tasks')
      .insert([{ title, description, priority, status: 'todo', project_id: id,
        assignee_id: assignee_id || null, creator_id: user.id, due_date }])
      .select('*, assignee:assignee_id(id, name, email), creator:creator_id(id, name, email)')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    const userName = await getUserName(user.id);
    await recordHistory(task.id, user.id, userName, 'created', null, null);
    return res.status(201).json(task);
  }

  res.status(405).end();
};
