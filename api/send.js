const mail = require('../lib/mail');

module.exports = async (req, res) => {
  if (!mail.allowed(req, res)) return;
  const b = mail.bodyOf(req);
  try { res.status(200).json(await mail.send(b.account, b)); }
  catch (e) { const f = mail.friendly(e); res.status(f.status).json({ error: f.error }); }
};
