// Gmail sending. Nothing is stored on the server: the browser sends the account details with each request.
const nodemailer = require('nodemailer');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanAccount(a) {
  a = a || {};
  const email = String(a.email || '').trim();
  const password = String(a.password || '').replace(/\s+/g, '');
  const name = String(a.name || '').replace(/[\r\n"<>]/g, '').trim().slice(0, 80) || email.split('@')[0];
  if (!EMAIL_RE.test(email)) throw Object.assign(new Error('Enter your full Gmail address.'), { status: 400 });
  if (!password) throw Object.assign(new Error('App Password is missing.'), { status: 400 });
  return { email, password, name };
}

function transport(a) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: a.email, pass: a.password },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 25000
  });
}

const escHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function textToHtml(text) {
  return escHtml(text)
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)"'])/g, '<a href="$1">$1</a>')
    .replace(/\r?\n/g, '<br>');
}

// Turn nodemailer/Gmail errors into something readable. 401 means "the sign-in itself is the problem".
function friendly(e) {
  const msg = String((e && e.message) || e || 'Unknown error');
  if (e && e.status) return { status: e.status, error: msg };
  if ((e && e.code === 'EAUTH') || /535|Invalid login|not accepted|BadCredentials|Application-specific password/i.test(msg)) {
    return { status: 401, error: 'Gmail rejected this sign-in. Use a 16-letter App Password, not your normal Gmail password.' };
  }
  if (e && /^(ETIMEDOUT|ECONNECTION|ESOCKET|EDNS|ECONNRESET|ENOTFOUND)$/.test(e.code)) {
    return { status: 502, error: 'Could not reach Gmail. Try again in a moment.' };
  }
  return { status: 400, error: msg.replace(/^(Error|Exception):\s*/, '') };
}

async function verify(account) {
  await transport(cleanAccount(account)).verify();
}

// Very rough HTML -> text fallback, just for the plain-text alternative part of the email.
function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n').trim();
}
// Strip the few tags that have no place in an email and could carry a live script.
function sanitizeHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

async function send(account, p) {
  const a = cleanAccount(account);
  p = p || {};
  const recipient = String(p.recipient || '').trim(), subject = String(p.subject || '').trim(), body = String(p.body || '').trim();
  const isHtml = !!p.isHtml;
  if (!recipient) throw new Error('Recipient email is missing.');
  if (!subject) throw new Error('Email subject is missing.');
  if (!body) throw new Error('Email body is missing.');
  if (!EMAIL_RE.test(recipient)) throw new Error('Invalid email address: ' + recipient);
  if (subject.length > 300 || body.length > 300000) throw new Error('Message is too long.');
  const html = isHtml ? sanitizeHtml(body) : textToHtml(body);
  const text = isHtml ? htmlToText(body) : body;
  await transport(a).sendMail({
    from: '"' + a.name + '" <' + a.email + '>',
    replyTo: a.email, to: recipient, subject, text, html
  });
  return { success: true, message: 'Sent to ' + recipient };
}

function bodyOf(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b || {};
}
function allowed(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST' || req.headers['x-requested-with'] !== 'gcm') { res.status(403).json({ error: 'Forbidden.' }); return false; }
  return true;
}

module.exports = { verify, send, friendly, bodyOf, allowed };
