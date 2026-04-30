const jwt = require('jsonwebtoken');
const supabase = require('../supabase');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
      
      const { data: user, error } = await supabase.from('users').select('id, name, email, role').eq('id', decoded.id).single();
      if (error || !user) throw new Error('User not found');
      
      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ error: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'Admin') next();
  else res.status(403).json({ error: 'Not authorized as an admin' });
};

module.exports = { protect, admin };
