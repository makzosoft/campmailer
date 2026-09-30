const schedule = require('../lib/schedule');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST' || req.headers['x-requested-with'] !== 'gcm') return res.status(403).json({ error: 'Forbidden.' });
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  const id = b && b.id;
  if (!id) return res.status(400).json({ error: 'Missing schedule id.' });
  try { res.status(200).json(await schedule.cancel(id)); }
  catch (e) { res.status(e.status || 400).json({ error: e.message }); }
};
