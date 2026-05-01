import jwt from 'jsonwebtoken';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(401).json({ error: 'No refresh token' });

  try {
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const decoded = jwt.verify(refresh_token, secret);
    const access_token = jwt.sign({ id: decoded.id }, secret, { expiresIn: '24h' });
    const new_refresh_token = jwt.sign({ id: decoded.id }, secret, { expiresIn: '30d' });
    res.json({ access_token, refresh_token: new_refresh_token });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
}
