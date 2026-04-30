const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../supabase');

const generateTokens = (id) => {
  const access_token = jwt.sign({ id }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '24h' });
  const refresh_token = jwt.sign({ id }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '30d' });
  return { access_token, refresh_token };
};

router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { data: user, error } = await supabase
      .from('users')
      .insert([{ name, email, password: hashedPassword, role: role || 'Member' }])
      .select('id, name, email, role').single();

    if (error) throw error;
    const tokens = generateTokens(user.id);
    res.status(201).json({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data: user } = await supabase.from('users').select('*').eq('email', email).single();
    if (user && (await bcrypt.compare(password, user.password))) {
      const tokens = generateTokens(user.id);
      delete user.password;
      res.json({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, user });
    } else {
      res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/logout', (req, res) => res.status(204).send());
module.exports = router;
