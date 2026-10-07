// Signed links for open tracking, click tracking and unsubscribe, plus the footer.
// Every link carries a signature made with CRON_SECRET, so nobody can forge one:
// a link can only record what the server itself put in it.
const crypto = require('crypto');

const enabled = () => !!process.env.CRON_SECRET;
const key = () => crypto.createHmac('sha256', String(process.env.CRON_SECRET || '')).update('gcm-track-v1').digest();
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function sign(obj) {
  const p = Buffer.from(JSON.stringify(obj)).toString('base64url');
  return p + '.' + crypto.createHmac('sha256', key()).update(p).digest('base64url');
}
// Returns the payload if the signature is genuine, otherwise null.
function open(token) {
  try {
    if (!enabled()) return null;
    const [p, sig] = String(token || '').split('.');
    if (!p || !sig) return null;
    const want = crypto.createHmac('sha256', key()).update(p).digest(), got = Buffer.from(sig, 'base64url');
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
    return JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  } catch (e) { return null; }
}

function baseUrlOf(req) {
  if (process.env.APP_URL) return String(process.env.APP_URL).replace(/\/+$/, '');
  const h = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!h) return '';
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || (/^(localhost|127\.)/.test(h) ? 'http' : 'https');
  return proto + '://' + h;
}

// Adds the Unsubscribe footer (always), plus the open pixel and click links when switched on.
// t = { baseUrl, campaignId, owner, senderName, recipient, opens, clicks, footer }
function decorate({ html, text, t }) {
  if (!t || !t.baseUrl || !enabled()) return { html, text, headers: {} };
  const c = String(t.campaignId || 'direct').slice(0, 64), e = String(t.recipient).toLowerCase(), base = t.baseUrl;
  const name = String(t.senderName || t.owner || '').slice(0, 80);
  const unsubUrl = base + '/api/unsub?t=' + encodeURIComponent(sign({ k: 'u', c, e, o: String(t.owner).toLowerCase(), n: name }));

  if (t.clicks) {
    html = html.replace(/(<a\b[^>]*?\bhref\s*=\s*)(["'])(https?:\/\/[^"']{1,1500})\2/gi, (m, pre, q, url) => {
      const u = url.replace(/&amp;/g, '&');
      if (u.includes('/api/unsub') || u.includes('/api/t/')) return m;
      return pre + q + esc(base + '/api/t/c?t=' + encodeURIComponent(sign({ k: 'c', c, e, u }))) + q;
    });
  }
  const footer = String(t.footer || '').slice(0, 300);
  const box = '<div style="margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;font:12px/1.5 Arial,Helvetica,sans-serif;color:#6b7280">' +
    (footer ? esc(footer) + '<br>' : '') + 'Sent by ' + esc(name) + '. Don\'t want these emails? <a href="' + esc(unsubUrl) + '" style="color:#6b7280;text-decoration:underline">Unsubscribe</a></div>';
  const pixel = t.opens ? '<img src="' + esc(base + '/api/t/o?t=' + encodeURIComponent(sign({ k: 'o', c, e }))) + '" width="1" height="1" alt="" style="border:0;width:1px;height:1px">' : '';
  const add = box + pixel;
  html = /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, () => add + '</body>') : html + add;
  text = String(text || '') + '\n\n--\n' + (footer ? footer + '\n' : '') + 'Sent by ' + name + '. Unsubscribe: ' + unsubUrl;
  return { html, text, headers: { 'List-Unsubscribe': '<' + unsubUrl + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };
}

// A small, clean page for the unsubscribe screens.
function page(title, inner) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title>' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#eceff3;font:16px/1.55 Segoe UI,system-ui,Arial,sans-serif;color:#16202e}' +
    '.c{background:#fff;border:1px solid #d9dee6;border-radius:14px;padding:30px 26px;width:min(92vw,420px);text-align:center;box-shadow:0 24px 48px -30px rgba(22,32,46,.5);animation:u .5s cubic-bezier(.22,.9,.3,1)}' +
    '@keyframes u{from{opacity:0;transform:translateY(14px)}}h1{font-size:21px;margin:0 0 8px}p{margin:0 0 18px;color:#5d6b7e}' +
    'button{border:0;border-radius:9px;background:#b42318;color:#fff;font:inherit;font-weight:600;padding:11px 22px;cursor:pointer}button:hover{background:#912016}' +
    'input[type=text],input[type=email]{width:100%;box-sizing:border-box;margin:0 0 10px;padding:11px 13px;border:1.5px solid #d9dee6;border-radius:9px;font:inherit;transition:border-color .15s,box-shadow .2s}input:focus{outline:none;border-color:#1f5fbf;box-shadow:0 0 0 4px rgba(31,95,191,.14)}.hp{position:absolute;left:-9999px;height:0;overflow:hidden}button.blue{background:#1f5fbf}button.blue:hover{background:#184c99}label{display:block;text-align:left;font-size:13px;font-weight:600;color:#5d6b7e;margin:0 0 4px}' +
    '.ok{width:54px;height:54px;border-radius:50%;background:#e0f4ec;color:#13795b;display:grid;place-items:center;margin:0 auto 14px;font-size:28px}small{color:#8a96a6}</style></head><body><div class="c">' + inner + '</div></body></html>';
}

module.exports = { enabled, sign, open, baseUrlOf, decorate, page, esc };
