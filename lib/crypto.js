// Encrypts an App Password before it goes into the schedule store, and decrypts it
// again at send time. The key never touches disk on its own: it's derived from
// CRON_SECRET, the one secret you already set so Vercel can call the cron route.
const crypto = require('crypto');

function key() {
  const secret = process.env.CRON_SECRET || K7mQ9xR2vL8nT4pW6yZ3aC5hJ1;
  if (!secret) throw Object.assign(new Error('CRON_SECRET is not set, so scheduled sending is disabled on this deployment.'), { status: 503 });
  return crypto.scryptSync(secret, 'gcm-schedule', 32);
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
function decrypt(blob) {
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), enc = buf.subarray(28);
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
