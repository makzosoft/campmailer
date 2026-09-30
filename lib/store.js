// Key-value storage for schedules, via Upstash Redis (the integration Vercel's
// Marketplace now provisions — "Vercel KV" itself was retired). Reads whichever
// env var pair is present, since different integration flows name them
// differently: KV_REST_API_URL/TOKEN (Vercel KV-compatible naming) or
// UPSTASH_REDIS_REST_URL/TOKEN (Upstash's own naming). Falls back to an
// in-memory store when neither is set, so local `npm start` and demo mode still
// work — that fallback does NOT persist across restarts or Vercel's separate
// function instances, so real scheduling needs a real database attached.
let backend = null;
function creds() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

const mem = { data: new Map(), sets: new Map() };
const memStore = {
  async get(k) { return mem.data.has(k) ? JSON.parse(mem.data.get(k)) : null; },
  async set(k, v) { mem.data.set(k, JSON.stringify(v)); },
  async del(k) { mem.data.delete(k); },
  async sadd(k, v) { if (!mem.sets.has(k)) mem.sets.set(k, new Set()); mem.sets.get(k).add(v); },
  async srem(k, v) { if (mem.sets.has(k)) mem.sets.get(k).delete(v); },
  async smembers(k) { return [...(mem.sets.get(k) || [])]; }
};

function get() {
  if (backend) return backend;
  const c = creds();
  if (c) {
    const { Redis } = require('@upstash/redis');
    backend = new Redis(c);
  } else {
    backend = memStore;
  }
  return backend;
}

module.exports = { store: () => get(), dbReady: () => !!creds() };
