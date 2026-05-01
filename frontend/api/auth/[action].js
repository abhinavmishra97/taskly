const bcrypt = require('bcryptjs');
const { supabase, generateTokens } = require('../_helpers');

module.exports = async function handler(req, res) {
  const action = req.query.action;

  if (action === 'register' && req.method === 'POST') {
    const { name, email, password, role } = req.body;
    try {
      if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
      const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
      if (existing) return res.status(400).json({ error: 'User already exists' });
      const hashed = await bcrypt.hash(password, await bcrypt.genSalt(10));
      const { data: user, error } = await supabase
        .from('users')
        .insert([{ name, email, password: hashed, role: role || 'Member' }])
        .select('id, name, email, role').single();
      if (error) throw error;
      return res.status(201).json(Object.assign({}, generateTokens(user.id), { user }));
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (action === 'login' && req.method === 'POST') {
    const { email, password } = req.body;
    try {
      const { data: user } = await supabase.from('users').select('*').eq('email', email).single();
      if (user && (await bcrypt.compare(password, user.password))) {
        delete user.password;
        return res.json(Object.assign({}, generateTokens(user.id), { user }));
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (action === 'logout' && req.method === 'POST') return res.status(204).end();

  if (action === 'refresh' && req.method === 'POST') {
    const jwt = require('jsonwebtoken');
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(401).json({ error: 'No refresh token' });
    try {
      const decoded = jwt.verify(refresh_token, process.env.JWT_SECRET || 'dev-secret');
      return res.json(generateTokens(decoded.id));
    } catch { return res.status(401).json({ error: 'Invalid refresh token' }); }
  }

  res.status(404).json({ error: 'Not found' });
};
