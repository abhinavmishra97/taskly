import jwt from 'jsonwebtoken';
import supabase from './supabase.js';

export async function protect(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authorized, no token' });
    return null;
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('id', decoded.id)
      .single();
    if (error || !user) throw new Error('User not found');
    return user;
  } catch {
    res.status(401).json({ error: 'Not authorized, token failed' });
    return null;
  }
}
