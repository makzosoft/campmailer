// Key-value storage for schedules, backed by Supabase (Postgres).
// Needs two env vars in Vercel (server-side only, never sent to the browser):
//   SUPABASE_URL                (or NEXT_PUBLIC_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY
// Tables come from supabase-setup.sql. Without the env vars it falls back to an
// in-memory store, which does NOT persist across Vercel function instances.
let backend = null;

function creds() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

const mem = { data: new Map(), sets: new Map(), events: [], unsubs: new Map(), nl: new Map(), subs: new Map(), push: new Map() };
const lc = v => String(v == null ? '' : v).trim().toLowerCase();
const memStore = {
  async get(k) { return mem.data.has(k) ? JSON.parse(mem.data.get(k)) : null; },
  async set(k, v) { mem.data.set(k, JSON.stringify(v)); },
  async del(k) { mem.data.delete(k); },
  async sadd(k, v) { if (!mem.sets.has(k)) mem.sets.set(k, new Set()); mem.sets.get(k).add(v); },
  async srem(k, v) { if (mem.sets.has(k)) mem.sets.get(k).delete(v); },
  async smembers(k) { return [...(mem.sets.get(k) || [])]; },
  async acquire(k, ttlMs) {
    const cur = mem.data.get(k);
    if (cur && JSON.parse(cur).exp > Date.now()) return false;
    mem.data.set(k, JSON.stringify({ exp: Date.now() + ttlMs }));
    return true;
  },
  async release(k) { mem.data.delete(k); },
  async setIfAbsent(k, v) { if (mem.data.has(k)) return false; mem.data.set(k, JSON.stringify(v)); return true; },
  async pushAdd(x) { mem.push.set(x.endpoint, { endpoint: x.endpoint, owner: lc(x.owner), p256dh: x.p256dh, auth: x.auth, prefs: x.prefs || {}, at: new Date().toISOString() }); },
  async pushList(o) { return [...mem.push.values()].filter(x => x.owner === lc(o)); },
  async pushRemove(endpoint) { mem.push.delete(endpoint); },
  async pushPrefs(endpoint, prefs) { const x = mem.push.get(endpoint); if (x) x.prefs = prefs; },
  async eventAdd(e) { mem.events.push({ campaign: e.campaign, email: lc(e.email), kind: e.kind, url: e.url || null, at: new Date().toISOString() }); },
  async eventsFor(c) { return mem.events.filter(x => x.campaign === c); },
  async unsubAdd(o, e, c) { mem.unsubs.set(lc(o) + '|' + lc(e), { email: lc(e), campaign: c || null, at: new Date().toISOString() }); },
  async unsubFilter(o, emails) { return [...new Set(emails.map(lc))].filter(e => mem.unsubs.has(lc(o) + '|' + e)); },
  async unsubList(o) { return [...mem.unsubs.entries()].filter(([k]) => k.startsWith(lc(o) + '|')).map(([, v]) => ({ email: v.email, at: v.at })).sort((a, b) => b.at.localeCompare(a.at)); },
  async unsubRemove(o, e) { mem.unsubs.delete(lc(o) + '|' + lc(e)); },
  // ----- newsletters (saved subscriber lists)
  async nlCreate(o, { id, name }) { mem.nl.set(id, { id, owner: lc(o), name, at: new Date().toISOString() }); mem.subs.set(id, new Map()); },
  async nlGet(id) { return mem.nl.get(id) || null; },
  async nlList(o) { return [...mem.nl.values()].filter(x => x.owner === lc(o)).map(x => ({ id: x.id, name: x.name, at: x.at, count: (mem.subs.get(x.id) || new Map()).size })).sort((a, b) => b.at.localeCompare(a.at)); },
  async nlDelete(o, id) { const x = mem.nl.get(id); if (x && x.owner === lc(o)) { mem.nl.delete(id); mem.subs.delete(id); } },
  async subCount(id) { return (mem.subs.get(id) || new Map()).size; },
  async subAddMany(id, items) { const m = mem.subs.get(id) || (mem.subs.set(id, new Map()), mem.subs.get(id)); let added = 0; for (const it of items) { const e = lc(it.email); if (!m.has(e)) added++; m.set(e, { email: e, name: it.name || '', at: (m.get(e) || {}).at || new Date().toISOString() }); } return added; },
  async subList(id, limit) { return [...(mem.subs.get(id) || new Map()).values()].slice(0, limit || 5000); },
  async subRemove(id, e) { (mem.subs.get(id) || new Map()).delete(lc(e)); },
  async subRemoveAll(o, e) { for (const x of mem.nl.values()) if (x.owner === lc(o)) (mem.subs.get(x.id) || new Map()).delete(lc(e)); }
};

function supabaseStore({ url, key }) {
  const { createClient } = require('@supabase/supabase-js');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const check = (error) => { if (error) throw new Error('Database error: ' + error.message); };
  return {
    async get(k) {
      const { data, error } = await db.from('kv').select('value').eq('key', k).maybeSingle();
      check(error);
      return data ? data.value : null;
    },
    async set(k, v) {
      const { error } = await db.from('kv').upsert({ key: k, value: v, updated_at: new Date().toISOString() });
      check(error);
    },
    async del(k) {
      const { error } = await db.from('kv').delete().eq('key', k);
      check(error);
    },
    async sadd(k, v) {
      const { error } = await db.from('kv_sets').upsert({ set_key: k, member: v });
      check(error);
    },
    async srem(k, v) {
      const { error } = await db.from('kv_sets').delete().eq('set_key', k).eq('member', v);
      check(error);
    },
    async smembers(k) {
      const { data, error } = await db.from('kv_sets').select('member').eq('set_key', k);
      check(error);
      return (data || []).map(r => r.member);
    },
    // Short-lived lock so two overlapping runs can never send the same batch twice.
    // The primary key makes the insert atomic: only one caller can create the row.
    async acquire(k, ttlMs) {
      const now = new Date();
      const ins = await db.from('kv').insert({ key: k, value: { exp: now.getTime() + ttlMs }, updated_at: now.toISOString() });
      if (!ins.error) return true;
      if (ins.error.code !== '23505') throw new Error('Database error: ' + ins.error.message);
      // Someone holds it. Take over only if it is older than the lock time (a crashed run).
      const stale = new Date(now.getTime() - ttlMs).toISOString();
      const del = await db.from('kv').delete().eq('key', k).lt('updated_at', stale).select('key');
      if (del.error || !del.data || !del.data.length) return false;
      const again = await db.from('kv').insert({ key: k, value: { exp: now.getTime() + ttlMs }, updated_at: now.toISOString() });
      return !again.error;
    },
    async release(k) {
      const { error } = await db.from('kv').delete().eq('key', k);
      check(error);
    },
    // Insert only if the key is new. Returns false when someone else got there first.
    async setIfAbsent(k, v) {
      const { error } = await db.from('kv').insert({ key: k, value: v, updated_at: new Date().toISOString() });
      if (!error) return true;
      if (error.code === '23505') return false;
      throw new Error('Database error: ' + error.message);
    },
    // ----- devices that get push notifications
    async pushAdd(x) {
      const { error } = await db.from('push_subs').upsert({ endpoint: x.endpoint, owner: lc(x.owner), p256dh: x.p256dh, auth: x.auth, prefs: x.prefs || {} }, { onConflict: 'endpoint' });
      check(error);
    },
    async pushList(o) {
      const { data, error } = await db.from('push_subs').select('endpoint,p256dh,auth,prefs').eq('owner', lc(o)).limit(50);
      check(error);
      return data || [];
    },
    async pushRemove(endpoint) {
      const { error } = await db.from('push_subs').delete().eq('endpoint', endpoint);
      check(error);
    },
    async pushPrefs(endpoint, prefs) {
      const { error } = await db.from('push_subs').update({ prefs }).eq('endpoint', endpoint);
      check(error);
    },
    // ----- tracking events (opens, clicks, unsubscribes). Insert-only, so nothing can be overwritten.
    async eventAdd(e) {
      const { error } = await db.from('track_events').insert({ campaign: e.campaign, email: lc(e.email), kind: e.kind, url: e.url || null });
      check(error);
    },
    async eventsFor(c) {
      const out = [];
      for (let from = 0; from < 20000; from += 1000) {
        const { data, error } = await db.from('track_events').select('email,kind,url,at').eq('campaign', c).order('id', { ascending: true }).range(from, from + 999);
        check(error);
        out.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
    // ----- people who unsubscribed, kept per sending Gmail account
    async unsubAdd(o, e, c) {
      const { error } = await db.from('unsubscribes').upsert({ owner: lc(o), email: lc(e), campaign: c || null }, { onConflict: 'owner,email' });
      check(error);
    },
    async unsubFilter(o, emails) {
      const list = [...new Set(emails.map(lc))], hit = new Set();
      for (let i = 0; i < list.length; i += 100) {
        const { data, error } = await db.from('unsubscribes').select('email').eq('owner', lc(o)).in('email', list.slice(i, i + 100));
        check(error);
        (data || []).forEach(r => hit.add(r.email));
      }
      return [...hit];
    },
    async unsubList(o) {
      const { data, error } = await db.from('unsubscribes').select('email,at').eq('owner', lc(o)).order('at', { ascending: false }).limit(2000);
      check(error);
      return data || [];
    },
    async unsubRemove(o, e) {
      const { error } = await db.from('unsubscribes').delete().eq('owner', lc(o)).eq('email', lc(e));
      check(error);
    },
    // ----- newsletters (saved subscriber lists)
    async nlCreate(o, { id, name }) {
      const { error } = await db.from('newsletters').insert({ id, owner: lc(o), name });
      check(error);
    },
    async nlGet(id) {
      const { data, error } = await db.from('newsletters').select('id,owner,name,at').eq('id', id).maybeSingle();
      check(error);
      return data || null;
    },
    async nlList(o) {
      const { data, error } = await db.from('newsletters').select('id,name,at').eq('owner', lc(o)).order('at', { ascending: false }).limit(50);
      check(error);
      const out = [];
      for (const x of data || []) out.push(Object.assign({}, x, { count: await this.subCount(x.id) }));
      return out;
    },
    async nlDelete(o, id) {
      const { error } = await db.from('newsletters').delete().eq('id', id).eq('owner', lc(o));
      check(error);
      const r = await db.from('subscribers').delete().eq('list_id', id);
      check(r.error);
    },
    async subCount(id) {
      const { count, error } = await db.from('subscribers').select('email', { count: 'exact', head: true }).eq('list_id', id);
      check(error);
      return count || 0;
    },
    async subAddMany(id, items) {
      const before = await this.subCount(id);
      for (let i = 0; i < items.length; i += 500) {
        const rows = items.slice(i, i + 500).map(x => ({ list_id: id, email: lc(x.email), name: x.name || '' }));
        const { error } = await db.from('subscribers').upsert(rows, { onConflict: 'list_id,email' });
        check(error);
      }
      return (await this.subCount(id)) - before;
    },
    async subList(id, limit) {
      const { data, error } = await db.from('subscribers').select('email,name,at').eq('list_id', id).order('at', { ascending: true }).limit(limit || 5000);
      check(error);
      return data || [];
    },
    async subRemove(id, e) {
      const { error } = await db.from('subscribers').delete().eq('list_id', id).eq('email', lc(e));
      check(error);
    },
    async subRemoveAll(o, e) {
      const { data, error } = await db.from('newsletters').select('id').eq('owner', lc(o));
      check(error);
      const ids = (data || []).map(x => x.id);
      if (!ids.length) return;
      const r = await db.from('subscribers').delete().in('list_id', ids).eq('email', lc(e));
      check(r.error);
    }
  };
}

function get() {
  if (backend) return backend;
  const c = creds();
  backend = c ? supabaseStore(c) : memStore;
  return backend;
}

module.exports = { store: () => get(), dbReady: () => !!creds() };
