// Push notifications to the sender's phone(s), through the browser's own push service.
// No setup needed: the signing keys (VAPID) are created the first time they are needed and kept in the database.
const webpush = require('web-push');
const { store } = require('./store');

const KEY = 'push:vapid';
let cached = null;

async function vapid() {
  if (cached) return cached;
  let k = await store().get(KEY);
  if (!k || !k.publicKey) {
    const fresh = webpush.generateVAPIDKeys();
    k = (await store().setIfAbsent(KEY, fresh)) ? fresh : await store().get(KEY);
  }
  return (cached = k);
}
const publicKey = async () => (await vapid()).publicKey;
const subjectFor = (owner, base) => (/^https:\/\//.test(base || '') ? base : 'mailto:' + owner);

// Sends one notification to every device of `owner` that wants this kind of alert.
// kind: 'batch' | 'done' | 'problem' | 'test'.  A dead device (gone/expired) is forgotten automatically.
async function notify(owner, kind, payload, base) {
  const subs = (await store().pushList(owner)).filter(s => kind === 'test' || (s.prefs && s.prefs[kind]));
  if (!subs.length) return { sent: 0 };
  const v = await vapid(), details = { vapidDetails: { subject: subjectFor(owner, base), publicKey: v.publicKey, privateKey: v.privateKey }, TTL: 3600, urgency: kind === 'problem' ? 'high' : 'normal' };
  const body = JSON.stringify(Object.assign({ url: '/' }, payload));
  let sent = 0;
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, details);
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410 || e.statusCode === 403)) { try { await store().pushRemove(s.endpoint); } catch (x) { /* fine */ } }
    }
  }));
  return { sent };
}

module.exports = { publicKey, notify, webpush };
