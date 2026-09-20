const mail = require('../lib/mail');

// Checks the Gmail address + App Password with Gmail. Saves nothing.
module.exports = async (req, res) => {
  if (!mail.allowed(req, res)) return;
  try { await mail.verify(mail.bodyOf(req).account); res.status(200).json({ ok: true }); }
  catch (e) { const f = mail.friendly(e); res.status(f.status).json({ error: f.error }); }
};
