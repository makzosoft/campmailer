// ONE serverless function for the whole app (Vercel's free plan allows only 12 per deployment).
// Every address stays the same: /api/send, /api/schedule-status, /api/cron/run, /api/t/o ... they all land here
// and are passed on to the matching file in lib/routes/. Each route is loaded only when it is used, so a problem
// in one route can never stop the others (for example, /api/health keeps working to tell you what is wrong).
const ROUTES = {
  'login': () => require('../lib/routes/login'),
  'send': () => require('../lib/routes/send'),
  'schedule-start': () => require('../lib/routes/schedule-start'),
  'schedule-status': () => require('../lib/routes/schedule-status'),
  'schedule-cancel': () => require('../lib/routes/schedule-cancel'),
  'schedule-pause': () => require('../lib/routes/schedule-pause'),
  'cron/run': () => require('../lib/routes/cron-run'),
  'unsub': () => require('../lib/routes/unsub'),
  'unsubscribes': () => require('../lib/routes/unsubscribes'),
  'track-stats': () => require('../lib/routes/track-stats'),
  't/o': () => require('../lib/routes/t-o'),
  't/c': () => require('../lib/routes/t-c'),
  'subscribe': () => require('../lib/routes/subscribe'),
  'newsletters': () => require('../lib/routes/newsletters'),
  'push': () => require('../lib/routes/push'),
  'push-key': () => require('../lib/routes/push-key'),
  'health': () => require('../lib/routes/health')
};

module.exports = async (req, res) => {
  const route = new URL(req.url, 'http://x').pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
  const load = Object.prototype.hasOwnProperty.call(ROUTES, route) ? ROUTES[route] : null;
  if (!load) { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ error: 'Not found.' })); }
  let handler;
  try { handler = load(); }
  catch (e) {
    res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'This part of the app could not start: ' + String(e.message).split('\n')[0].slice(0, 160) + '. Open /api/health?key=YOUR_CRON_SECRET to see what is missing.' }));
  }
  return handler(req, res);
};
