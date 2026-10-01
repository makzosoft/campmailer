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

const mem = { data: new Map(), sets: new Map() };
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
  async release(k) { mem.data.delete(k); }
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
