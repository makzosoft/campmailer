// Server-side twin of the client's {{field}} / {{field|fallback}} substitution,
// used by the cron sender so scheduled batches match what the browser previewed.
const TOKEN = /\{\{\s*([^{}|]+?)\s*(?:\|([^{}]*?))?\s*\}\}/g;
const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');

function lookup(row, columns, nameCol, key) {
  const k = norm(key);
  for (const c of columns) if (norm(c) === k) return { found: true, value: (row.data && row.data[c]) || '' };
  if (k === 'firstname' && nameCol) return { found: true, value: String((row.data && row.data[nameCol]) || '').trim().split(/\s+/)[0] || '' };
  return { found: false, value: '' };
}

function merge(tpl, row, columns, nameCol) {
  let out = '', last = 0;
  for (const m of String(tpl || '').matchAll(TOKEN)) {
    out += tpl.slice(last, m.index);
    const r = row ? lookup(row, columns || [], nameCol, m[1]) : { found: false, value: '' };
    if (!r.found) out += m[0];
    else if (r.value) out += r.value;
    else if (m[2] !== undefined) out += m[2].trim();
    last = m.index + m[0].length;
  }
  return out + String(tpl || '').slice(last);
}

module.exports = { merge };
