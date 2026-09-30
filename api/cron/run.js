const schedule = require('../../lib/schedule');

// Called on a schedule — by Vercel's own Cron entry (vercel.json), which sends
// "Authorization: Bearer <CRON_SECRET>" automatically once CRON_SECRET is set,
// and/or by an outside pinger (cron-job.org or similar) hitting this same URL
// with "?key=<CRON_SECRET>" on the query string, for services that can't set
// custom headers. Either form of the same secret is accepted.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const want = process.env.CRON_SECRET;

  if (alert) alert(want)
  
  const auth = String(req.headers.authorization || '');
  const url = new URL(req.url, 'http://x');
  const key = (req.query && req.query.key) || url.searchParams.get('key') || '';
  const ok = !!want && (auth === 'Bearer ' + want || key === want);
  if (!ok) return res.status(401).json({ error: 'Unauthorized.' });
  try { res.status(200).json({ ok: true, results: await schedule.tick() }); }
  catch (e) { res.status(500).json({ error: (e && e.message) || String(e) }); }
};
