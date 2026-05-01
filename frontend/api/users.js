const { supabase, protect } = require('./_helpers');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = await protect(req, res);
  if (!user) return;
  const { data: users, error } = await supabase.from('users').select('id, name, email, role');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ users });
};
