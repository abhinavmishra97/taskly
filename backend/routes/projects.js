const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { protect } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    const { data: projects, error } = await supabase.from('projects').select('*, owner:owner_id (id, name, email)');
    if (error) throw error;
    res.json(projects);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/', protect, async (req, res) => {
  try {
    const { data: project, error } = await supabase.from('projects').insert([{ name: req.body.name, description: req.body.description, owner_id: req.user.id }]).select('*, owner:owner_id (id, name, email)').single();
    if (error) throw error;
    res.status(201).json(project);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const { data: project, error } = await supabase.from('projects').select('*, owner:owner_id(id, name, email)').eq('id', req.params.id).single();
    if (error || !project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.patch('/:id', protect, async (req, res) => {
  try {
    const { data: project } = await supabase.from('projects').select('owner_id').eq('id', req.params.id).single();
    if (!project) return res.status(404).json({ error: 'Not found' });
    if (project.owner_id !== req.user.id && req.user.role !== 'Admin') return res.status(403).json({ error: 'Not authorized' });

    const { data: updated, error } = await supabase.from('projects').update(req.body).eq('id', req.params.id).select('*, owner:owner_id(id, name, email)').single();
    if (error) throw error;
    res.json(updated);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const { data: project } = await supabase.from('projects').select('owner_id').eq('id', req.params.id).single();
    if (!project) return res.status(404).json({ error: 'Not found' });
    if (project.owner_id !== req.user.id && req.user.role !== 'Admin') return res.status(403).json({ error: 'Not authorized' });

    await supabase.from('projects').delete().eq('id', req.params.id);
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/:id/tasks', protect, async (req, res) => {
  try {
    let query = supabase.from('tasks').select('*, assignee:assignee_id(id, name, email), creator:creator_id(id, name, email)').eq('project_id', req.params.id);
    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.assignee) query = query.eq('assignee_id', req.query.assignee);
    const { data: tasks, error } = await query;
    if (error) throw error;
    res.json({
      tasks,
      total: tasks.length,
      page: 1,
      limit: 500
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/tasks', protect, async (req, res) => {
  const { title, description, priority, assignee_id, due_date } = req.body;
  try {
    const { data: task, error } = await supabase.from('tasks').insert([{ title, description, priority, status: 'todo', project_id: req.params.id, assignee_id: assignee_id || null, creator_id: req.user.id, due_date }]).select('*, assignee:assignee_id(id, name, email), creator:creator_id(id, name, email)').single();
    if (error) throw error;
    res.status(201).json(task);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
module.exports = router;
