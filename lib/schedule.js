const crypto = require('crypto');
const { store } = require('./store');
const { encrypt, decrypt } = require('./crypto');
const { merge } = require('./merge');
const mail = require('./mail');

const ACTIVE_SET = 'sched:active';
const MAX_RECIPIENTS = 3000;

function today() { return new Date().toISOString().slice(0, 10); } // UTC date
function recordKey(id) { return 'sched:rec:' + id; }

async function create({ account, subject, body, isHtml, batchSize, perCall, columns, emailCol, nameCol, recipients }) {
  if (!Array.isArray(recipients) || !recipients.length) throw Object.assign(new Error('No recipients to schedule.'), { status: 400 });
  if (recipients.length > MAX_RECIPIENTS) throw Object.assign(new Error('Too many recipients for one schedule (max ' + MAX_RECIPIENTS + ').'), { status: 400 });
  if (!String(subject || '').trim() || !String(body || '').trim()) throw Object.assign(new Error('Add a subject and message before scheduling.'), { status: 400 });
  const daily = Math.min(500, Math.max(1, Number(batchSize) || 50));
  const slice = Math.min(daily, Math.max(1, Number(perCall) || Math.min(10, daily)));

  const id = crypto.randomBytes(12).toString('base64url');
  const rec = {
    id, createdAt: new Date().toISOString(), createdBy: account.email,
    account: { email: account.email, name: account.name, password: encrypt(account.password) },
    subject: String(subject), body: String(body), isHtml: !!isHtml,
    columns: Array.isArray(columns) ? columns : [], emailCol: emailCol || null, nameCol: nameCol || null,
    recipients: recipients.map(r => ({ email: String(r.email || '').trim(), data: r.data || {} })).filter(r => r.email),
    batchSize: daily, perCall: slice, status: 'active', sentEmails: [], failed: [],
    progress: { date: null, count: 0 }, lastRunAt: null, lastError: null
  };
  await store().set(recordKey(id), rec);
  await store().sadd(ACTIVE_SET, id);
  return publicView(rec);
}

async function get(id) {
  const rec = await store().get(recordKey(id));
  if (!rec) throw Object.assign(new Error('Schedule not found. It may have been canceled or already finished a while ago.'), { status: 404 });
  return rec;
}

async function status(id) { return publicView(await get(id)); }

async function cancel(id) {
  const rec = await get(id);
  rec.status = 'canceled';
  rec.account.password = null; // credential is only ever needed to keep sending; scrub it the moment that stops
  await store().set(recordKey(id), rec);
  await store().srem(ACTIVE_SET, id);
  return publicView(rec);
}

function publicView(rec) {
  const day = today();
  const todayCount = rec.progress.date === day ? rec.progress.count : 0;
  return {
    id: rec.id, status: rec.status, subject: rec.subject,
    total: rec.recipients.length, sent: rec.sentEmails.length, failed: rec.failed.length,
    batchSize: rec.batchSize, perCall: rec.perCall, sentToday: todayCount,
    lastRunAt: rec.lastRunAt, createdAt: rec.createdAt, createdBy: rec.createdBy, lastError: rec.lastError
  };
}

// Called every time the sending route is hit — by Vercel's own once-a-day Cron
// entry, and by any outside pinger the person adds on top of it. Each call sends
// at most one "perCall" slice, and never more than "batchSize" for the calendar
// day (UTC) no matter how many times it's called — extra pings on a day that's
// already hit its cap are cheap no-ops, so pinging often is always safe.
async function tick() {
  const day = today();
  const ids = await store().smembers(ACTIVE_SET);
  const results = [];
  for (const id of ids) {
    try {
      const rec = await store().get(recordKey(id));
      if (!rec || rec.status !== 'active') { await store().srem(ACTIVE_SET, id); continue; }
      if (rec.progress.date !== day) rec.progress = { date: day, count: 0 };
      const remainingToday = rec.batchSize - rec.progress.count;
      if (remainingToday <= 0) { results.push({ id, skipped: "today's cap already sent" }); continue; }

      const doneSet = new Set([...rec.sentEmails, ...rec.failed.map(f => f.email)]);
      const pending = rec.recipients.filter(r => !doneSet.has(r.email));
      const slice = pending.slice(0, Math.min(rec.perCall, remainingToday));
      const password = pending.length ? decrypt(rec.account.password) : null;
      let sent = 0, failed = 0;
      for (const r of slice) {
        try {
          const subject = merge(rec.subject, r, rec.columns, rec.nameCol);
          const body = merge(rec.body, r, rec.columns, rec.nameCol);
          await mail.send({ email: rec.account.email, password, name: rec.account.name }, { recipient: r.email, subject, body, isHtml: rec.isHtml });
          rec.sentEmails.push(r.email); sent++;
        } catch (e) {
          rec.failed.push({ email: r.email, error: (e && e.message) || String(e) }); failed++;
          rec.lastError = (e && e.message) || String(e);
        }
        rec.progress.count++;
      }
      rec.lastRunAt = new Date().toISOString();
      const done = (rec.sentEmails.length + rec.failed.length) >= rec.recipients.length;
      if (done) { rec.status = 'done'; rec.account.password = null; await store().srem(ACTIVE_SET, id); }
      await store().set(recordKey(id), rec);
      results.push({ id, sent, failed, done });
    } catch (e) {
      results.push({ id, error: (e && e.message) || String(e) });
    }
  }
  return results;
}

module.exports = { create, status, cancel, tick };
