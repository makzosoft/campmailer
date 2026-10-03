const push = require('../lib/push');

// The public half of the signing key, so a phone can subscribe to notifications.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try { res.status(200).json({ key: await push.publicKey() }); }
  catch (e) { res.status(500).json({ error: 'Notifications are not available right now.' }); }
};
