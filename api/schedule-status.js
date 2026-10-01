const schedule = require('../lib/schedule');

// ?id=...            summary (counts, settings)
// ?id=...&detail=1   also lists every recipient with sent / failed / queued
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.headers['x-requested-with'] !== 'gcm') return res.status(403).json({ error: 'Forbidden.' });
  const q = new URL(req.url, 'http://x').searchParams;
  const id = (req.query && req.query.id) || q.get('id');
  const detail = (req.query && req.query.detail) || q.get('detail');
  if (!id) return res.status(400).json({ error: 'Missing schedule id.' });
  try { res.status(200).json(await schedule.status(id, !!detail)); }
  catch (e) { res.status(e.status || 400).json({ error: e.message }); }
};
