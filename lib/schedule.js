const crypto = require('crypto');
const { store } = require('./store');
const { encrypt, decrypt } = require('./crypto');
const { merge } = require('./merge');
const mail = require('./mail');
const push = require('./push');

const ACTIVE_SET = 'sched:active';
const HEARTBEAT = 'sched:heartbeat';
const MAX_RECIPIENTS = 3000;
const MAX_DAILY = 500;          // what Gmail allows on a normal account
const MAX_PER_BATCH = 20;       // keeps one batch well inside the function time limit
const DEFAULT_TZ = 'Africa/Lagos';
const TIME_BUDGET_MS = 45000;   // stop starting new emails after this long in one run
const LOCK_MS = 90000;
const MAX_TRIES = 3;            // network hiccups are retried this many times before giving up
const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]{2,}$/;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const recordKey = id => 'sched:rec:' + id;
const lockKey = id => 'sched:lock:' + id;
const errOf = (msg, status) => Object.assign(new Error(msg), { status: status || 400 });
const msgOf = e => (e && e.message) || String(e);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const int = (v, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : d; };

function validTz(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; } catch (e) { return DEFAULT_TZ; }
}

// The person's own clock: calendar date, minutes since midnight, and weekday (0 = Sunday).
function localParts(date, tz) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short'
  });
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return {
    date: o.year + '-' + o.month + '-' + o.day,
    minutes: (+o.hour) * 60 + (+o.minute),
    dow: DAYS.indexOf(String(o.weekday).slice(0, 3))
  };
}

function cleanOptions(o) {
  o = o || {};
  const dailyLimit = clamp(int(o.dailyLimit != null ? o.dailyLimit : o.batchSize, 50), 1, MAX_DAILY);
  const perBatch = clamp(int(o.perBatch != null ? o.perBatch : o.perCall, Math.min(10, dailyLimit)), 1, Math.min(MAX_PER_BATCH, dailyLimit));
  const intervalMin = clamp(int(o.intervalMin, 15), 1, 1440);
  const windowStart = clamp(int(o.windowStart, 0), 0, 1439);
  const windowEnd = clamp(int(o.windowEnd, 1440), 1, 1440);
  if (windowEnd <= windowStart) throw errOf('The end time must be after the start time.');
  const days = Array.isArray(o.days) ? [...new Set(o.days.map(Number).filter(d => d >= 0 && d <= 6))] : [0, 1, 2, 3, 4, 5, 6];
  if (!days.length) throw errOf('Pick at least one sending day.');
  days.sort();
  let startAt = null;
  if (o.startAt) {
    const d = new Date(o.startAt);
    if (isNaN(d.getTime())) throw errOf('That start time is not valid.');
    startAt = d.toISOString();
  }
  return { dailyLimit, perBatch, intervalMin, windowStart, windowEnd, days, startAt, tz: validTz(o.timezone || DEFAULT_TZ) };
}

// Records made by the first version only know "batchSize" and "perCall". Fill in the rest.
function norm(rec) {
  if (!rec) return rec;
  rec.dailyLimit = rec.dailyLimit || rec.batchSize || 50;
  rec.perBatch = rec.perBatch || rec.perCall || 10;
  rec.intervalMin = rec.intervalMin || 1;
  if (rec.windowStart == null) rec.windowStart = 0;
  if (rec.windowEnd == null) rec.windowEnd = 1440;
  rec.days = rec.days && rec.days.length ? rec.days : [0, 1, 2, 3, 4, 5, 6];
  rec.tz = rec.tz || DEFAULT_TZ;
  rec.sentAt = rec.sentAt || {};
  rec.tries = rec.tries || {};
  rec.startAt = rec.startAt || null;
  rec.lastBatchAt = rec.lastBatchAt || rec.lastRunAt || null;
  rec.progress = rec.progress || { date: null, count: 0 };
  rec.sentEmails = rec.sentEmails || [];
  rec.failed = rec.failed || [];
  rec.skipped = rec.skipped || [];
  return rec;
}

async function create(b) {
  const { account, subject, body, isHtml, columns, emailCol, nameCol, recipients } = b;
  if (!Array.isArray(recipients) || !recipients.length) throw errOf('No recipients to schedule.');
  if (recipients.length > MAX_RECIPIENTS) throw errOf('Too many recipients for one schedule (max ' + MAX_RECIPIENTS + ').');
  if (!String(subject || '').trim() || !String(body || '').trim()) throw errOf('Add a subject and message before scheduling.');
  const opt = cleanOptions(b);

  const seen = new Set();
  const list = [];
  for (const r of recipients) {
    const email = String((r && r.email) || '').trim();
    const key = email.toLowerCase();
    if (!EMAIL_RE.test(email) || seen.has(key)) continue;
    seen.add(key);
    list.push({ email, data: (r && r.data) || {} });
  }
  if (!list.length) throw errOf('None of those recipients have a valid email address.');
  let unsubHits;
  try { unsubHits = new Set(await store().unsubFilter(account.email, list.map(r => r.email))); }
  catch (e) { throw errOf('Could not check the unsubscribe list. Try again in a moment.', 503); }
  if (unsubHits.size >= list.length) throw errOf('Everyone on this list has unsubscribed.');
  const nowIso = new Date().toISOString();
  const skipped = list.filter(r => unsubHits.has(r.email.toLowerCase())).map(r => ({ email: r.email, reason: 'unsubscribed', at: nowIso }));

  const id = crypto.randomBytes(12).toString('base64url');
  const rec = Object.assign({
    id, createdAt: new Date().toISOString(), createdBy: account.email, name: String(b.name || '').slice(0, 120),
    account: { email: account.email, name: account.name, password: encrypt(String(account.password || '').replace(/\s+/g, '')) },
    subject: String(subject), body: String(body), isHtml: !!isHtml,
    columns: Array.isArray(columns) ? columns : [], emailCol: emailCol || null, nameCol: nameCol || null,
    recipients: list, status: 'active', sentEmails: [], sentAt: {}, failed: [], skipped, tries: {},
    campaignId: String(b.campaignId || id).slice(0, 64), trackOpens: !!b.trackOpens, trackClicks: !!b.trackClicks,
    footer: String(b.footer || '').slice(0, 300), baseUrl: String(b.baseUrl || '').slice(0, 200),
    progress: { date: null, count: 0 }, lastRunAt: null, lastBatchAt: null, lastError: null, lastSend: null, finishedAt: null
  }, opt);
  await store().set(recordKey(id), rec);
  await store().sadd(ACTIVE_SET, id);
  const view = publicView(rec);
  view.skippedEmails = skipped.map(x => x.email);
  return view;
}

async function get(id) {
  const rec = await store().get(recordKey(id));
  if (!rec) throw errOf('Schedule not found. It may have been canceled or removed.', 404);
  return norm(rec);
}

async function status(id, detail) {
  const rec = await get(id);
  const view = publicView(rec, detail);
  try { const hb = await store().get(HEARTBEAT); view.checkerAt = (hb && hb.at) || null; } catch (e) { view.checkerAt = null; }
  return view;
}

async function cancel(id) {
  const rec = await get(id);
  if (rec.status === 'done' || rec.status === 'canceled') return publicView(rec);
  rec.status = 'canceled';
  rec.finishedAt = new Date().toISOString();
  rec.account.password = null; // only needed to keep sending; scrubbed the moment that stops
  await store().set(recordKey(id), rec);
  await store().srem(ACTIVE_SET, id);
  return publicView(rec);
}

async function setPaused(id, paused) {
  const rec = await get(id);
  if (rec.status === 'done' || rec.status === 'canceled') throw errOf('This schedule has already ended.');
  rec.status = paused ? 'paused' : 'active';
  if (!paused) rec.lastError = null;
  await store().set(recordKey(id), rec);
  if (paused) await store().srem(ACTIVE_SET, id); else await store().sadd(ACTIVE_SET, id);
  return publicView(rec);
}

function publicView(rec, detail) {
  const lp = localParts(new Date(), rec.tz);
  const failedMap = {};
  rec.failed.forEach(f => { failedMap[f.email] = f; });
  const sentSet = new Set(rec.sentEmails);
  const total = rec.recipients.length;
  const view = {
    id: rec.id, name: rec.name || '', status: rec.status, subject: rec.subject,
    total, sent: rec.sentEmails.length, failed: rec.failed.length,
    skipped: rec.skipped.length, campaignId: rec.campaignId || null,
    trackOpens: !!rec.trackOpens, trackClicks: !!rec.trackClicks,
    queued: Math.max(0, total - rec.sentEmails.length - rec.failed.length - rec.skipped.length),
    dailyLimit: rec.dailyLimit, perBatch: rec.perBatch, intervalMin: rec.intervalMin,
    windowStart: rec.windowStart, windowEnd: rec.windowEnd, days: rec.days, tz: rec.tz, startAt: rec.startAt,
    sentToday: rec.progress.date === lp.date ? rec.progress.count : 0,
    lastRunAt: rec.lastRunAt, lastBatchAt: rec.lastBatchAt, createdAt: rec.createdAt, createdBy: rec.createdBy,
    finishedAt: rec.finishedAt || null, lastError: rec.lastError || null
  };
  if (detail) {
    const skipSet = new Set(rec.skipped.map(x => x.email));
    view.recipients = rec.recipients.map(r => {
      if (skipSet.has(r.email)) return { email: r.email, state: 'unsub' };
      if (sentSet.has(r.email)) return { email: r.email, state: 'sent', at: rec.sentAt[r.email] || null };
      if (failedMap[r.email]) return { email: r.email, state: 'failed', error: failedMap[r.email].error, at: failedMap[r.email].at || null };
      return { email: r.email, state: 'queued' };
    });
  }
  return view;
}

async function runOne(id, started, fallbackBase) {
  const key = recordKey(id);
  const rec = norm(await store().get(key));
  if (!rec || rec.status !== 'active') { await store().srem(ACTIVE_SET, id); return { id, skipped: 'not active' }; }

  const now = new Date();
  const lp = localParts(now, rec.tz);
  if (rec.startAt && now < new Date(rec.startAt)) return { id, skipped: 'waiting for the start time' };
  if (!rec.days.includes(lp.dow)) return { id, skipped: 'not a sending day' };
  if (lp.minutes < rec.windowStart || lp.minutes >= rec.windowEnd) return { id, skipped: 'outside sending hours' };
  if (rec.progress.date !== lp.date) rec.progress = { date: lp.date, count: 0 };
  const left = rec.dailyLimit - rec.progress.count;
  if (left <= 0) return { id, skipped: "today's limit reached" };
  if (rec.lastBatchAt && now - new Date(rec.lastBatchAt) < rec.intervalMin * 60000 - 30000) return { id, skipped: 'waiting for the next batch' };

  const finished = new Set([...rec.sentEmails, ...rec.failed.map(f => f.email), ...rec.skipped.map(x => x.email)]);
  const pending = rec.recipients.filter(r => !finished.has(r.email));
  let sent = 0, failed = 0, note = null;

  if (pending.length) {
    const slice = pending.slice(0, Math.min(rec.perBatch, left));
    // Anyone who unsubscribed since the schedule began is skipped (and doesn't use up today's limit).
    let unsubNow;
    try { unsubNow = new Set(await store().unsubFilter(rec.account.email, slice.map(r => r.email))); }
    catch (e) { return { id, error: 'could not check the unsubscribe list, will retry' }; }
    const password = decrypt(rec.account.password);
    const trackOpts = { baseUrl: rec.baseUrl || fallbackBase || '', campaignId: rec.campaignId || rec.id, opens: !!rec.trackOpens, clicks: !!rec.trackClicks, footer: rec.footer || '' };
    const markFailed = (r, error) => { rec.failed.push({ email: r.email, error, at: new Date().toISOString() }); failed++; rec.lastError = error; };
    for (const r of slice) {
      if (unsubNow.has(r.email.toLowerCase())) { rec.skipped.push({ email: r.email, reason: 'unsubscribed', at: new Date().toISOString() }); continue; }
      if (Date.now() - started > TIME_BUDGET_MS) { note = 'ran out of time, rest goes next check'; break; }
      try {
        const subject = merge(rec.subject, r, rec.columns, rec.nameCol);
        const body = merge(rec.body, r, rec.columns, rec.nameCol);
        const out = await mail.send({ email: rec.account.email, password, name: rec.account.name }, { recipient: r.email, subject, body, isHtml: rec.isHtml, track: trackOpts });
        const at = new Date().toISOString();
        rec.sentEmails.push(r.email); rec.sentAt[r.email] = at; rec.progress.count++; sent++;
        rec.lastSend = { to: r.email, at, accepted: out.accepted, rejected: out.rejected, messageId: out.messageId, response: out.response };
        rec.lastError = null;
      } catch (e) {
        const f = mail.friendly(e);
        if (f.status === 401) {                       // sign-in problem: stop everything, don't burn through the list
          rec.status = 'paused'; rec.lastError = f.error; note = 'paused: Gmail sign-in rejected';
          await store().srem(ACTIVE_SET, id);
          break;
        }
        if (f.status === 502) {                       // Gmail unreachable: try this person again next time
          rec.tries[r.email] = (rec.tries[r.email] || 0) + 1;
          rec.lastError = f.error;
          if (rec.tries[r.email] >= MAX_TRIES) { markFailed(r, f.error); continue; }
          note = 'Gmail unreachable, will retry'; break;
        }
        if (/quota|limit exceeded|too many|rate limit|daily user sending/i.test(f.error)) {
          rec.lastError = 'Gmail says the daily sending limit has been reached. It will try again tomorrow.';
          rec.progress.count = rec.dailyLimit; note = 'Gmail limit reached'; break;
        }
        markFailed(r, f.error);                       // bad address etc: never retried
      }
    }
    rec.lastRunAt = new Date().toISOString();
    rec.lastBatchAt = rec.lastRunAt;
  }

  const done = (rec.sentEmails.length + rec.failed.length + rec.skipped.length) >= rec.recipients.length;
  if (done && rec.status === 'active') { rec.status = 'done'; rec.finishedAt = new Date().toISOString(); rec.account.password = null; await store().srem(ACTIVE_SET, id); }

  // If someone canceled or paused while this batch was running, keep their choice.
  const fresh = await store().get(key);
  if (fresh && rec.status === 'active' && fresh.status !== 'active') { rec.status = fresh.status; rec.account.password = fresh.account && fresh.account.password; rec.finishedAt = fresh.finishedAt || null; }
  await store().set(key, rec);

  // Tell the sender's phone what just happened (never lets a notification problem affect sending).
  try {
    const who = rec.name || 'Campaign', base = rec.baseUrl || fallbackBase || '', sentTotal = rec.sentEmails.length;
    if (rec.status === 'done') {
      await push.notify(rec.account.email, 'done', { title: 'Campaign finished', body: who + ': ' + sentTotal + ' sent' + (rec.failed.length ? ', ' + rec.failed.length + ' failed' : '') + '.', tag: 'done-' + rec.id, url: '/?open=history' }, base);
    } else if (rec.status === 'paused' && rec.lastError) {
      await push.notify(rec.account.email, 'problem', { title: 'Sending paused', body: who + ': ' + rec.lastError, tag: 'problem-' + rec.id, url: '/' }, base);
    } else if (note === 'Gmail limit reached') {
      await push.notify(rec.account.email, 'problem', { title: 'Gmail limit reached', body: who + ': Gmail stopped sending for today. It will continue tomorrow.', tag: 'problem-' + rec.id, url: '/' }, base);
    } else if (sent > 0) {
      await push.notify(rec.account.email, 'batch', { title: who + ': ' + sent + (sent === 1 ? ' email' : ' emails') + ' sent', body: sentTotal + ' of ' + rec.recipients.length + ' done' + (failed ? ', ' + failed + ' failed' : '') + '.', tag: 'batch-' + rec.id, url: '/' }, base);
    }
  } catch (e) { /* notifications are a bonus */ }
  return { id, sent, failed, done, status: rec.status, note };
}

// Called every time the sending route is hit (by cron-job.org every minute).
// Each schedule decides for itself whether it is due: start time, day, hours,
// time since the last batch, and the daily limit. A lock stops two overlapping
// runs from ever sending the same batch twice.
async function tick(fallbackBase) {
  const started = Date.now();
  try { await store().set(HEARTBEAT, { at: new Date().toISOString() }); } catch (e) { /* not critical */ }
  const ids = await store().smembers(ACTIVE_SET);
  const results = [];
  for (const id of ids) {
    if (Date.now() - started > TIME_BUDGET_MS) { results.push({ id, skipped: 'out of time, next check' }); continue; }
    let locked = false;
    try {
      locked = await store().acquire(lockKey(id), LOCK_MS);
      if (!locked) { results.push({ id, skipped: 'another run is working on it' }); continue; }
      results.push(await runOne(id, started, fallbackBase));
    } catch (e) {
      results.push({ id, error: msgOf(e) });
    } finally {
      if (locked) { try { await store().release(lockKey(id)); } catch (e) { /* lock expires on its own */ } }
    }
  }
  return results;
}

module.exports = { create, status, cancel, setPaused, tick };
