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

// ── Helper: get user name ───────────────────────────────────────────────────
async function getUserName(userId) {
  try {
    const { data } = await supabase.from('users').select('name').eq('id', userId).single();
    return data?.name || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

// ── Helper: check if user can modify a project (owner OR Admin) ─────────────
function canModifyProject(user, project) {
  return user.role === 'Admin' || project.owner_id === user.id;
}

// ── GET /projects — list all ────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*, owner:owner_id (id, name, email)');
    if (error) throw error;
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /projects — create ─────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .insert([{
        name: req.body.name,
        description: req.body.description,
        owner_id: req.user.id,
      }])
      .select('*, owner:owner_id (id, name, email)')
      .single();
    if (error) throw error;
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /projects/:id — single project ──────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .select('*, owner:owner_id(id, name, email)')
      .eq('id', req.params.id)
      .single();
    if (error || !project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── PATCH /projects/:id — update (owner OR Admin) ───────────────────────────
router.patch('/:id', protect, async (req, res) => {
  try {
    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', req.params.id)
      .single();
    if (!project) return res.status(404).json({ error: 'Not found' });
    if (!canModifyProject(req.user, project)) {
      return res.status(403).json({ error: 'Not authorized. Only the project owner or an Admin can edit.' });
    }

    const { data: updated, error } = await supabase
      .from('projects')
      .update(req.body)
      .eq('id', req.params.id)
      .select('*, owner:owner_id(id, name, email)')
      .single();
    if (error) throw error;
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE /projects/:id (owner OR Admin) ───────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', req.params.id)
      .single();
    if (!project) return res.status(404).json({ error: 'Not found' });
    if (!canModifyProject(req.user, project)) {
      return res.status(403).json({ error: 'Not authorized. Only the project owner or an Admin can delete.' });
    }

    await supabase.from('projects').delete().eq('id', req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /projects/:id/tasks — list tasks with filters ───────────────────────
router.get('/:id/tasks', protect, async (req, res) => {
  try {
    let query = supabase
      .from('tasks')
      .select('*, assignee:assignee_id(id, name, email), creator:creator_id(id, name, email)')
      .eq('project_id', req.params.id);

    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.assignee) query = query.eq('assignee_id', req.query.assignee);

    const { data: tasks, error } = await query;
    if (error) throw error;
    res.json({
      tasks,
      total: tasks.length,
      page: 1,
      limit: 500,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /projects/:id/tasks — create task + record history ─────────────────
router.post('/:id/tasks', protect, async (req, res) => {
  const { title, description, priority, assignee_id, due_date } = req.body;
  try {
    const { data: task, error } = await supabase
      .from('tasks')
      .insert([{
        title,
        description,
        priority,
        status: 'todo',
        project_id: req.params.id,
        assignee_id: assignee_id || null,
        creator_id: req.user.id,
        due_date,
      }])
      .select('*, assignee:assignee_id(id, name, email), creator:creator_id(id, name, email)')
      .single();

    if (error) throw error;

    // Record "created" history entry
    const userName = await getUserName(req.user.id);
    await recordHistory(task.id, req.user.id, userName, 'created', null, null);

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /projects/:id/history — project-level activity feed ─────────────────
router.get('/:id/history', protect, async (req, res) => {
  const limit = parseInt(req.query.limit) || 15;
  const offset = parseInt(req.query.offset) || 0;

  try {
    // Get all task IDs for this project
    const { data: tasks, error: taskErr } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('project_id', req.params.id);

    if (taskErr) throw taskErr;
    if (!tasks || tasks.length === 0) {
      return res.json({ history: [], has_more: false });
    }

    const taskIds = tasks.map(t => t.id);
    const taskTitleMap = Object.fromEntries(tasks.map(t => [t.id, t.title]));

    // Fetch history entries for those tasks
    const { data: history, error: histErr } = await supabase
      .from('task_history')
      .select('*')
      .in('task_id', taskIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (histErr) throw histErr;

    // Attach task_title to each entry
    const enriched = (history || []).map(h => ({
      ...h,
      task_title: taskTitleMap[h.task_id] || 'Deleted task',
    }));

    res.json({
      history: enriched,
      has_more: (history || []).length > limit,
    });
  } catch (error) {
    // If table doesn't exist yet, return empty
    if (error.code === 'PGRST205' || error.code === '42P01') {
      return res.json({ history: [], has_more: false });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
