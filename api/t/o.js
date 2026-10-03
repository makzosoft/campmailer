const track = require('../../lib/track');
const { store } = require('../../lib/store');

// The invisible 1x1 picture. When an email app loads it, an "open" is recorded.
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  try {
    const t = (req.query && req.query.t) || new URL(req.url, 'http://x').searchParams.get('t');
    const d = track.open(t);
    if (d && d.k === 'o') await store().eventAdd({ campaign: d.c, email: d.e, kind: 'open' });
  } catch (e) { /* never break the picture */ }
  res.statusCode = 200;
  res.end(GIF);
};
