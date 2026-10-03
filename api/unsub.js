const track = require('../lib/track');
const { store } = require('../lib/store');

// GET shows a button. POST does the unsubscribing.
// Doing it only on POST means email scanners that "visit" links can't unsubscribe people by accident,
// and Gmail's own Unsubscribe button (a one-click POST) works instantly.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const t = (req.query && req.query.t) || new URL(req.url, 'http://x').searchParams.get('t');
  const d = track.open(t);
  if (!d || d.k !== 'u') { res.statusCode = 400; return res.end(track.page('Link not valid', '<h1>This link is not valid</h1><p>It may have been copied incorrectly.</p>')); }
  const who = track.esc(d.n || 'the sender');
  if (req.method === 'POST') {
    try {
      await store().unsubAdd(d.o, d.e, d.c);
      try { await store().subRemoveAll(d.o, d.e); } catch (e) { /* the unsubscribe itself is what matters */ }
      try { await store().eventAdd({ campaign: d.c, email: d.e, kind: 'unsub' }); } catch (e) { /* the list itself is what matters */ }
    } catch (e) {
      res.statusCode = 500;
      return res.end(track.page('Something went wrong', '<h1>Something went wrong</h1><p>Please try again in a moment.</p>'));
    }
    return res.end(track.page('Unsubscribed', '<div class="ok">&#10003;</div><h1>You are unsubscribed</h1><p><b>' + track.esc(d.e) + '</b> will not get any more emails from ' + who + '.</p><small>You can close this page.</small>'));
  }
  res.end(track.page('Unsubscribe', '<h1>Unsubscribe</h1><p>Stop emails from <b>' + who + '</b> to <b>' + track.esc(d.e) + '</b>?</p><form method="post" action="/api/unsub?t=' + encodeURIComponent(t) + '"><button type="submit">Yes, unsubscribe me</button></form>'));
};
