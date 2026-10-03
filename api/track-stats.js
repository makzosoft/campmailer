const { store } = require('../lib/store');

// Opens, clicks and unsubscribes for one campaign. The campaign id is a long random code, so only
// the person who made the campaign (whose browser holds it) can ask for these numbers.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.headers['x-requested-with'] !== 'gcm') return res.status(403).json({ error: 'Forbidden.' });
  const c = String((req.query && req.query.c) || new URL(req.url, 'http://x').searchParams.get('c') || '').slice(0, 64);
  if (c.length < 12) return res.status(400).json({ error: 'Missing campaign id.' });
  try {
    const opens = {}, clicks = {}, unsub = [], times = { o: [], c: [], u: [] }, urls = {};
    for (const ev of await store().eventsFor(c)) {
      const at = new Date(ev.at).toISOString(), sec = Math.round(new Date(ev.at).getTime() / 1000);
      if (ev.kind === 'open') { times.o.push(sec); const o = opens[ev.email] || (opens[ev.email] = { count: 0, first: at, last: at }); o.count++; o.last = at; }
      else if (ev.kind === 'click') { times.c.push(sec); if (ev.url) { const u = urls[ev.url] || (urls[ev.url] = { url: ev.url, count: 0, people: new Set() }); u.count++; u.people.add(ev.email); } const o = clicks[ev.email] || (clicks[ev.email] = { count: 0, first: at, last: at, url: null }); o.count++; o.last = at; o.url = ev.url || o.url; }
      else if (ev.kind === 'unsub') { times.u.push(sec); unsub.push(ev.email); }
    }
    const top = Object.values(urls).sort((a, b) => b.count - a.count).slice(0, 12).map(u => ({ url: u.url, count: u.count, people: u.people.size }));
    res.status(200).json({ opens, clicks, unsub, events: { o: times.o.slice(-5000), c: times.c.slice(-5000), u: times.u.slice(-2000) }, urls: top, totals: { opened: Object.keys(opens).length, clicked: Object.keys(clicks).length, unsubscribed: unsub.length } });
  } catch (e) { res.status(500).json({ error: 'Could not load tracking numbers.' }); }
};
