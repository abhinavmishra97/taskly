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
  const { email, password } = req.body;
  try {
    const { data: user } = await supabase.from('users').select('*').eq('email', email).single();
    if (user && (await bcrypt.compare(password, user.password))) {
      const tokens = generateTokens(user.id);
      delete user.password;
      res.json({ ...tokens, user });
    } else {
      res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
