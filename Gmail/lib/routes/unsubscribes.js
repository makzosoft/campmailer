const mail = require('../mail');
const { store } = require('../store');

// For the signed-in sender only (their Gmail sign-in is checked every time).
// POST { account, action: "check" | "list" | "remove", emails?, email? }
module.exports = async (req, res) => {
  if (!mail.allowed(req, res)) return;
  const b = mail.bodyOf(req);
  try {
    await mail.verify(b.account);
    const owner = String(b.account.email).trim().toLowerCase();
    if (b.action === 'check') {
      const emails = (Array.isArray(b.emails) ? b.emails : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, 5000);
      return res.status(200).json({ unsubscribed: await store().unsubFilter(owner, emails) });
    }
    if (b.action === 'list') return res.status(200).json({ items: await store().unsubList(owner) });
    if (b.action === 'remove') {
      const email = String(b.email || '').trim();
      if (!email) return res.status(400).json({ error: 'Missing email.' });
      await store().unsubRemove(owner, email);
      return res.status(200).json({ ok: true });
    }
    res.status(400).json({ error: 'Unknown action.' });
  } catch (e) { const f = mail.friendly(e); res.status(f.status || 400).json({ error: f.error }); }
};
