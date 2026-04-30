const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { protect } = require('../middleware/auth');

router.patch('/:id', protect, async (req, res) => {
  const updates = { ...req.body };
  try {
    if (updates.clear_assignee) {
      updates.assignee_id = null;
      delete updates.clear_assignee;
    } else if (updates.assignee_id) {
      // keep assignee_id
    }

    const { data: task, error } = await supabase.from('tasks').update(updates).eq('id', req.params.id).select('*, assignee:assignee_id(id, name, email), creator:creator_id(id, name, email)').single();
    if (error) throw error;
    res.json(task);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const { data: task } = await supabase.from('tasks').select('creator_id, projects!inner(owner_id)').eq('id', req.params.id).single();
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const isCreator = task.creator_id === req.user.id;
    const isProjectOwner = task.projects.owner_id === req.user.id;
    if (!isCreator && !isProjectOwner && req.user.role !== 'Admin') return res.status(403).json({ error: 'Not authorized' });

    const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: error.message }); }
});
module.exports = router;
