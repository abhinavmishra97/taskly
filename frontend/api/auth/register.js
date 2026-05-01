import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import supabase from '../_lib/supabase.js';

function generateTokens(id) {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return {
    access_token: jwt.sign({ id }, secret, { expiresIn: '24h' }),
    refresh_token: jwt.sign({ id }, secret, { expiresIn: '30d' }),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
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
      .select('id, name, email, role')
      .single();

    if (error) throw error;
    const tokens = generateTokens(user.id);
    res.status(201).json({ ...tokens, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
