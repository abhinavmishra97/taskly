import supabase from '../_lib/supabase.js';
import { protect } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = await protect(req, res);
  if (!user) return;

  try {
    const { data: users, error } = await supabase
      .from('users').select('id, name, email, role');
    if (error) throw error;
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
