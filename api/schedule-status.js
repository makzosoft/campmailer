const schedule = require('../lib/schedule');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.headers['x-requested-with'] !== 'gcm') return res.status(403).json({ error: 'Forbidden.' });
  const id = (req.query && req.query.id) || new URL(req.url, 'http://x').searchParams.get('id');
  if (!id) return res.status(400).json({ error: 'Missing schedule id.' });
  try { res.status(200).json(await schedule.status(id)); }
  catch (e) { res.status(e.status || 400).json({ error: e.message }); }
};
