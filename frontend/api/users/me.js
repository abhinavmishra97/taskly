const { protect } = require('../_helpers');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = await protect(req, res);
  if (!user) return;
  res.json(user);
};
