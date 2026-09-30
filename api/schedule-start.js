const mail = require('../lib/mail');
const schedule = require('../lib/schedule');

// Starts a scheduled campaign: verifies the Gmail sign-in once, then stores an
// encrypted copy of it (see lib/crypto.js) so the daily cron route can send
// without you present. Call api/schedule-cancel as soon as you no longer want that.
module.exports = async (req, res) => {
  if (!mail.allowed(req, res)) return;
  const b = mail.bodyOf(req);
  try {
    await mail.verify(b.account);
    const rec = await schedule.create(b);
    res.status(200).json(rec);
  } catch (e) {
    const f = mail.friendly(e);
    res.status(f.status || 400).json({ error: f.error || e.message });
  }
};
