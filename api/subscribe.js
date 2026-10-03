const track = require('../lib/track');
const { store } = require('../lib/store');

const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]{2,}$/;
const MAX_LIST = 20000;

function formOf(req) {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  const raw = Buffer.isBuffer(b) ? b.toString('utf8') : String(b || '');
  try { return JSON.parse(raw); } catch (e) { return Object.fromEntries(new URLSearchParams(raw)); }
}
const html = (res, code, title, inner) => { res.statusCode = code; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(track.page(title, inner)); };

// Public sign-up page for a newsletter: /join/<id>
module.exports = async (req, res) => {
  const l = String((req.query && req.query.l) || new URL(req.url, 'http://x').searchParams.get('l') || '').slice(0, 64);
  let list = null;
  try { list = l ? await store().nlGet(l) : null; } catch (e) { return html(res, 500, 'Something went wrong', '<h1>Something went wrong</h1><p>Please try again in a moment.</p>'); }
  if (!list) return html(res, 404, 'Not found', '<h1>This page is not available</h1><p>The sign-up link may be wrong or the newsletter may have been removed.</p>');
  const name = track.esc(list.name);

  if (req.method !== 'POST') {
    const s = track.enabled() ? track.sign({ k: 's', l, t: Date.now() }) : '';
    return html(res, 200, 'Subscribe to ' + list.name,
      '<h1>' + name + '</h1><p>Get emails from this newsletter. You can unsubscribe at any time from any email.</p>' +
      '<form method="post" action="/join/' + encodeURIComponent(l) + '"><label for="n">Name (optional)</label><input type="text" id="n" name="name" maxlength="80" autocomplete="name">' +
      '<label for="e">Email</label><input type="email" id="e" name="email" required maxlength="200" autocomplete="email">' +
      '<div class="hp" aria-hidden="true"><input type="text" name="website" tabindex="-1" autocomplete="off"></div>' +
      '<input type="hidden" name="s" value="' + track.esc(s) + '"><button class="blue" type="submit">Subscribe</button></form>' +
      '<p style="margin:16px 0 0"><small>Your email is only used to send you this newsletter.</small></p>');
  }

  const f = formOf(req);
  const done = () => html(res, 200, 'Subscribed', '<div class="ok">&#10003;</div><h1>You are subscribed</h1><p>You will now get emails from <b>' + name + '</b>.</p><small>You can close this page.</small>');
  if (String(f.website || '').trim()) return done();          // a bot filled the hidden field: pretend it worked, store nothing
  const tok = track.open(f.s);
  const age = tok && tok.k === 's' && tok.l === l ? Date.now() - tok.t : -1;
  if (age < 1500 || age > 48 * 3600 * 1000) return html(res, 400, 'Please try again', '<h1>Please try again</h1><p>That took a moment too long, or was too quick. Open the sign-up page again and resubmit.</p><p><a href="/join/' + encodeURIComponent(l) + '">Back to the form</a></p>');
  const email = String(f.email || '').trim().slice(0, 200);
  if (!EMAIL_RE.test(email)) return html(res, 400, 'Check your email', '<h1>Check your email address</h1><p>That does not look like a valid email address.</p><p><a href="/join/' + encodeURIComponent(l) + '">Try again</a></p>');
  try {
    if ((await store().unsubFilter(list.owner, [email])).length) {
      return html(res, 200, 'Unsubscribed earlier', '<h1>You unsubscribed earlier</h1><p>You asked to stop getting emails from this sender, so we cannot add you again from here. Please contact them directly if you changed your mind.</p>');
    }
    if ((await store().subCount(l)) >= MAX_LIST) return html(res, 400, 'List full', '<h1>This list is full</h1><p>Please contact the sender.</p>');
    await store().subAddMany(l, [{ email, name: String(f.name || '').trim().slice(0, 80) }]);
  } catch (e) { return html(res, 500, 'Something went wrong', '<h1>Something went wrong</h1><p>Please try again in a moment.</p>'); }
  done();
};
