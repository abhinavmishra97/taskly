const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function protect(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authorized, no token' });
    return null;
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const { data: user, error } = await supabase
      .from('users').select('id, name, email, role').eq('id', decoded.id).single();
    if (error || !user) throw new Error('User not found');
    return user;
  } catch {
    res.status(401).json({ error: 'Not authorized, token failed' });
    return null;
  }
}

async function recordHistory(taskId, userId, userName, field, oldValue, newValue) {
  try {
    await supabase.from('task_history').insert([{
      task_id: taskId, user_id: userId, user_name: userName || 'Unknown', field,
      old_value: oldValue != null ? String(oldValue) : null,
      new_value: newValue != null ? String(newValue) : null,
    }]);
  } catch (e) { console.error('recordHistory failed:', e.message); }
}

async function getUserName(userId) {
  try {
    const { data } = await supabase.from('users').select('name').eq('id', userId).single();
    return data ? data.name : 'Unknown';
  } catch { return 'Unknown'; }
}

function generateTokens(id) {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return {
    access_token:  jwt.sign({ id }, secret, { expiresIn: '24h' }),
    refresh_token: jwt.sign({ id }, secret, { expiresIn: '30d' }),
  };
}

module.exports = { supabase, protect, recordHistory, getUserName, generateTokens };
