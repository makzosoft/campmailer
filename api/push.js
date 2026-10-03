const mail = require('../lib/mail');
const track = require('../lib/track');
const push = require('../lib/push');
const { store } = require('../lib/store');

const clean = p => ({ batch: !!(p && p.batch), done: !(p && p.done === false), problem: !(p && p.problem === false) });
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });

// For the signed-in sender only (their Gmail sign-in is checked every time).
// POST { account, action: "subscribe" | "unsubscribe" | "prefs" | "test", subscription?, endpoint?, prefs? }
module.exports = async (req, res) => {
  if (!mail.allowed(req, res)) return;
  const b = mail.bodyOf(req);
  try {
    await mail.verify(b.account);
    const owner = String(b.account.email).trim().toLowerCase();
    if (b.action === 'subscribe') {
      const s = b.subscription || {};
      if (!s.endpoint || !/^https:\/\//.test(s.endpoint) || !s.keys || !s.keys.p256dh || !s.keys.auth) throw bad('That device could not be registered.');
      await store().pushAdd({ endpoint: s.endpoint, owner, p256dh: s.keys.p256dh, auth: s.keys.auth, prefs: clean(b.prefs) });
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'unsubscribe') {
      if (b.endpoint) await store().pushRemove(String(b.endpoint));
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'prefs') {
      if (!b.endpoint) throw bad('Missing device.');
      await store().pushPrefs(String(b.endpoint), clean(b.prefs));
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'test') {
      const r = await push.notify(owner, 'test', { title: 'Notifications are on', body: 'You will get alerts like this when your emails go out.', tag: 'cm-test' }, track.baseUrlOf(req));
      if (!r.sent) throw bad('No device is registered yet. Turn notifications on first.', 404);
      return res.status(200).json({ ok: true, sent: r.sent });
    }
    res.status(400).json({ error: 'Unknown action.' });
  } catch (e) { const f = mail.friendly(e); res.status(e.status || f.status || 400).json({ error: e.status ? e.message : f.error }); }
};
