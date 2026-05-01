import supabase from '../../_lib/supabase.js';
import { protect } from '../../_lib/auth.js';
import { recordHistory, getUserName } from '../../_lib/history.js';

export default async function handler(req, res) {
  const user = await protect(req, res);
  if (!user) return;
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const updates = { ...req.body };

    const { data: oldTask } = await supabase
      .from('tasks')
      .select('title, description, status, priority, assignee_id, due_date, creator_id, project_id')
      .eq('id', id)
      .single();

    if (!oldTask) return res.status(404).json({ error: 'Task not found' });

    if (user.role !== 'Admin') {
      const isCreator = oldTask.creator_id === user.id;
      const { data: project } = await supabase
        .from('projects').select('owner_id').eq('id', oldTask.project_id).single();
      const isProjectOwner = project?.owner_id === user.id;
      const statusOnlyUpdate = Object.keys(updates).length === 1 && updates.status;
      if (!statusOnlyUpdate && !isCreator && !isProjectOwner) {
        return res.status(403).json({ error: 'Not authorized to edit this task' });
      }
    }

    if (updates.clear_assignee) {
      updates.assignee_id = null;
      delete updates.clear_assignee;
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select('*, assignee:assignee_id(id, name, email), creator:creator_id(id, name, email)')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    const userName = await getUserName(user.id);
    const trackFields = ['title', 'description', 'status', 'priority', 'assignee_id', 'due_date'];
    for (const field of trackFields) {
      const oldVal = oldTask[field];
      const newVal = updates[field];
      if (newVal !== undefined && String(oldVal ?? '') !== String(newVal ?? '')) {
        await recordHistory(id, user.id, userName, field, oldVal, newVal);
      }
    }

    return res.json(task);
  }

  if (req.method === 'DELETE') {
    const { data: task } = await supabase
      .from('tasks')
      .select('creator_id, projects!inner(owner_id)')
      .eq('id', id)
      .single();

    if (!task) return res.status(404).json({ error: 'Task not found' });

    const isCreator      = task.creator_id === user.id;
    const isProjectOwner = task.projects.owner_id === user.id;
    const isAdmin        = user.role === 'Admin';

    if (!isCreator && !isProjectOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized. Only the task creator, project owner, or an Admin can delete.' });
    }

    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.status(405).end();
}
