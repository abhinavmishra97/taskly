const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { protect } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    const { data: users, error } = await supabase.from('users').select('id, name, email, role');
    if (error) throw error;
    res.json({ users });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/me', protect, async (req, res) => res.json(req.user));
module.exports = router;
