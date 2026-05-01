const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { protect } = require('../middleware/auth');

// ── Helper: record a history entry ──────────────────────────────────────────
async function recordHistory(taskId, userId, userName, field, oldValue, newValue) {
  try {
    await supabase.from('task_history').insert([{
      task_id: taskId,
      user_id: userId,
      user_name: userName || 'Unknown',
      field,
      old_value: oldValue != null ? String(oldValue) : null,
      new_value: newValue != null ? String(newValue) : null,
    }]);
  } catch (e) {
    console.error('Failed to record history:', e.message);
  }
}

// ── Helper: get user name by id ─────────────────────────────────────────────
async function getUserName(userId) {
  try {
    const { data } = await supabase.from('users').select('name').eq('id', userId).single();
    return data?.name || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

// ── PATCH /tasks/:id — update task + record history (owner/creator/Admin) ───
router.patch('/:id', protect, async (req, res) => {
  const updates = { ...req.body };
  try {
    // Fetch the current task BEFORE updating (for history + auth check)
    const { data: oldTask } = await supabase
      .from('tasks')
      .select('title, description, status, priority, assignee_id, due_date, creator_id, project_id')
      .eq('id', req.params.id)
      .single();

    if (!oldTask) return res.status(404).json({ error: 'Task not found' });

    // Authorization: Admin can edit anything, otherwise check ownership
    if (req.user.role !== 'Admin') {
      // Check if user is task creator OR project owner
      const isCreator = oldTask.creator_id === req.user.id;
      const { data: project } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', oldTask.project_id)
        .single();
      const isProjectOwner = project?.owner_id === req.user.id;

      // Members can update status (drag-drop) even if not creator/owner
      // But for other fields, they need to be creator or owner
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
      .eq('id', req.params.id)
      .select('*, assignee:assignee_id(id, name, email), creator:creator_id(id, name, email)')
      .single();

    if (error) throw error;

    // Record history for each changed field
    if (oldTask) {
      const userName = await getUserName(req.user.id);
      const trackFields = ['title', 'description', 'status', 'priority', 'assignee_id', 'due_date'];

      for (const field of trackFields) {
        const oldVal = oldTask[field];
        const newVal = updates[field];

        if (newVal !== undefined && String(oldVal ?? '') !== String(newVal ?? '')) {
          await recordHistory(req.params.id, req.user.id, userName, field, oldVal, newVal);
        }
      }
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE /tasks/:id (creator, project owner, OR Admin) ────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const { data: task } = await supabase
      .from('tasks')
      .select('creator_id, projects!inner(owner_id)')
      .eq('id', req.params.id)
      .single();

    if (!task) return res.status(404).json({ error: 'Task not found' });

    const isCreator = task.creator_id === req.user.id;
    const isProjectOwner = task.projects.owner_id === req.user.id;
    const isAdmin = req.user.role === 'Admin';

    if (!isCreator && !isProjectOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized. Only the task creator, project owner, or an Admin can delete.' });
    }

    const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /tasks/:id/history — task-level history ─────────────────────────────
router.get('/:id/history', protect, async (req, res) => {
  try {
    const { data: history, error } = await supabase
      .from('task_history')
      .select('*')
      .eq('task_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ history: history || [] });
  } catch (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') {
      return res.json({ history: [] });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
