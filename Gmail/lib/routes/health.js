// A quick self-check you can open in a browser:  /api/health?key=YOUR_CRON_SECRET
// Without the key it only says the site is up. With the key it lists what is working and what is missing (never any secrets).
const tryLoad = fn => { try { fn(); return 'ok'; } catch (e) { return 'MISSING: ' + String(e.message).split('\n')[0].slice(0, 120); } };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = (req.query && req.query.key) || new URL(req.url, 'http://x').searchParams.get('key') || '';
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) return res.status(200).json({ ok: true, hint: 'Add ?key=YOUR_CRON_SECRET for details.' });
  const out = {
    env: { CRON_SECRET: true, SUPABASE_URL: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY },
    packages: { nodemailer: tryLoad(() => require('nodemailer')), supabase: tryLoad(() => require('@supabase/supabase-js')), 'web-push': tryLoad(() => require('web-push')) },
    files: { 'lib/store': tryLoad(() => require('../store')), 'lib/mail': tryLoad(() => require('../mail')), 'lib/schedule': tryLoad(() => require('../schedule')), 'lib/track': tryLoad(() => require('../track')), 'lib/push': tryLoad(() => require('../push')) },
    database: 'not checked'
  };
  try { const { store, dbReady } = require('../store'); await store().get('health:ping'); out.database = dbReady() ? 'connected' : 'NOT CONNECTED (using temporary memory, set the Supabase variables)'; }
  catch (e) { out.database = 'ERROR: ' + String(e.message).slice(0, 160); }
  out.ok = [out.packages, out.files].every(g => Object.values(g).every(v => v === 'ok')) && out.database === 'connected';
  res.status(200).json(out);
};
