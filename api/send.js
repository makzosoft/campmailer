const mail = require('../lib/mail');
const track = require('../lib/track');
const { store } = require('../lib/store');

module.exports = async (req, res) => {
  if (!mail.allowed(req, res)) return;
  const b = mail.bodyOf(req);
  try {
    const owner = String((b.account && b.account.email) || '').trim();
    const to = String(b.recipient || '').trim();
    // Never email someone who unsubscribed from this Gmail account (a test to yourself is always allowed).
    if (!b.isTest && owner && to) {
      let hit;
      try { hit = await store().unsubFilter(owner, [to]); }
      catch (e) { return res.status(503).json({ error: 'Could not check the unsubscribe list. Try again in a moment.' }); }
      if (hit.length) return res.status(409).json({ error: 'This person unsubscribed.', code: 'unsubscribed' });
    }
    const t = {
      baseUrl: track.baseUrlOf(req), campaignId: String(b.campaignId || 'direct').slice(0, 64),
      opens: !b.isTest && !!b.trackOpens, clicks: !b.isTest && !!b.trackClicks, footer: String(b.footer || '').slice(0, 300)
    };
    res.status(200).json(await mail.send(b.account, Object.assign({}, b, { track: t })));
  } catch (e) { const f = mail.friendly(e); res.status(f.status).json({ error: f.error }); }
};
