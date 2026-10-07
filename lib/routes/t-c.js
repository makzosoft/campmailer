const track = require('../track');
const { store } = require('../store');

// A tracked link: records the click, then sends the person on to the real page.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const t = (req.query && req.query.t) || new URL(req.url, 'http://x').searchParams.get('t');
  const d = track.open(t);
  let dest = null;
  try { if (d && d.k === 'c' && /^https?:\/\//i.test(d.u)) dest = new URL(d.u).toString(); } catch (e) { dest = null; }
  if (!dest) {
    res.statusCode = 400; res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(track.page('Link not valid', '<h1>This link is not valid</h1><p>It may have been copied incorrectly.</p>'));
  }
  try { await store().eventAdd({ campaign: d.c, email: d.e, kind: 'click', url: d.u.slice(0, 500) }); } catch (e) { /* still send them on */ }
  res.statusCode = 302; res.setHeader('Location', dest); res.end();
};
