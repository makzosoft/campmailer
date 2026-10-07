// ONE serverless function for the whole app (Vercel's free plan allows only 12 per deployment).
// vercel.json sends every /api/... address (and the /join/... sign-up links) here, and Vercel keeps the
// original address in req.url, so we read it and pass the request on to the matching file in lib/routes/.
// Each route is loaded only when used, so a problem in one route can never stop the others
// (for example /api/health keeps working to tell you what is wrong).
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
const json = (res, code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let path = url.pathname.replace(/\/+$/, ''), route = null;
  const query = Object.fromEntries(url.searchParams);
  const join = path.match(/^\/join\/([^/]+)$/);
  if (join) { route = 'subscribe'; query.l = decodeURIComponent(join[1]); }              // the newsletter sign-up page
  else if (path.startsWith('/api/')) route = path.slice(5);
  else if (path === '/api' || path === '/api/index') return json(res, 200, { ok: true, app: 'CampMailer' });
  req.query = Object.assign({}, req.query, query);
  const load = route && Object.prototype.hasOwnProperty.call(ROUTES, route) ? ROUTES[route] : null;
  if (!load) return json(res, 404, { error: 'Not found.' });
  let handler;
  try { handler = load(); }
  catch (e) { return json(res, 500, { error: 'This part of the app could not start: ' + String(e.message).split('\n')[0].slice(0, 160) + '. Open /api/health?key=YOUR_CRON_SECRET to see what is missing.' }); }
  return handler(req, res);
};
