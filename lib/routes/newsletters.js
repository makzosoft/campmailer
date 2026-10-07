const crypto = require('crypto');
const mail = require('../mail');
const track = require('../track');
const { store } = require('../store');

const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]{2,}$/;
const MAX_LISTS = 10, MAX_LIST = 20000, MAX_ADD = 5000;
const fail = (msg, status) => Object.assign(new Error(msg), { status: status || 400 });

// For the signed-in sender only (their Gmail sign-in is checked every time).
// POST { account, action, ... }  actions: list | create | delete | subscribers | add | remove
module.exports = async (req, res) => {
  if (!mail.allowed(req, res)) return;
  const b = mail.bodyOf(req);
  try {
    await mail.verify(b.account);
    const owner = String(b.account.email).trim().toLowerCase(), base = track.baseUrlOf(req);
    const mine = async id => {
      const l = id ? await store().nlGet(String(id).slice(0, 64)) : null;
      if (!l || l.owner !== owner) throw fail('That newsletter was not found.', 404);
      return l;
    };
    const link = id => base + '/join/' + id;

    if (b.action === 'list') {
      const items = (await store().nlList(owner)).map(x => Object.assign({}, x, { link: link(x.id) }));
      return res.status(200).json({ items });
    }
    if (b.action === 'create') {
      const name = String(b.name || '').trim().slice(0, 80);
      if (!name) throw fail('Give the newsletter a name.');
      if ((await store().nlList(owner)).length >= MAX_LISTS) throw fail('You can have up to ' + MAX_LISTS + ' newsletters.');
      const id = crypto.randomBytes(9).toString('base64url');
      await store().nlCreate(owner, { id, name });
      return res.status(200).json({ id, name, count: 0, link: link(id) });
    }
    if (b.action === 'delete') { await mine(b.id); await store().nlDelete(owner, b.id); return res.status(200).json({ ok: true }); }
    if (b.action === 'remove') {
      await mine(b.id);
      if (!b.email) throw fail('Missing email.');
      await store().subRemove(b.id, String(b.email));
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'subscribers') {
      const l = await mine(b.id);
      const subs = await store().subList(l.id, MAX_ADD);
      const gone = new Set(await store().unsubFilter(owner, subs.map(x => x.email)));
      return res.status(200).json({ name: l.name, items: subs.filter(x => !gone.has(x.email)).map(x => ({ email: x.email, name: x.name || '' })) });
    }
    if (b.action === 'add') {
      const l = await mine(b.id);
      const seen = new Set(), items = []; let invalid = 0;
      for (const it of (Array.isArray(b.items) ? b.items : []).slice(0, MAX_ADD)) {
        const email = String((it && it.email) || '').trim(), key = email.toLowerCase();
        if (!EMAIL_RE.test(email)) { invalid++; continue; }
        if (seen.has(key)) continue;
        seen.add(key); items.push({ email, name: String((it && it.name) || '').trim().slice(0, 80) });
      }
      if (!items.length) throw fail('No valid email addresses to add.');
      if ((await store().subCount(l.id)) + items.length > MAX_LIST) throw fail('That would go over ' + MAX_LIST + ' people in one newsletter.');
      const un = new Set(await store().unsubFilter(owner, items.map(x => x.email)));
      const ok = items.filter(x => !un.has(x.email.toLowerCase()));
      const added = ok.length ? await store().subAddMany(l.id, ok) : 0;
      return res.status(200).json({ added, already: ok.length - added, invalid, unsubscribed: un.size, count: await store().subCount(l.id) });
    }
    res.status(400).json({ error: 'Unknown action.' });
  } catch (e) { const f = mail.friendly(e); res.status(e.status || f.status || 400).json({ error: e.status ? e.message : f.error }); }
};
