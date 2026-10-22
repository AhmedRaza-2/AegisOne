import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import path from 'node:path';

// Local application limits, NOT a claim about an account's Groq allowance.
// Production continues to require verified limits in the central Edge Function.
// Leave room for conservatively reserved setup prompts and auto-language schemas;
// the provider still enforces its actual account limits and may return 429.
const DEV_LIMITS = Object.freeze({
  GROQ_CHAT_RPM: '10', GROQ_CHAT_RPD: '25', GROQ_CHAT_TPM: '16000', GROQ_CHAT_TPD: '100000',
  GROQ_AUDIO_RPM: '6', GROQ_AUDIO_RPD: '20', GROQ_AUDIO_ASH: '120', GROQ_AUDIO_ASD: '300',
});
export function hasUsableKey(value) {
  return typeof value === 'string' && /^gsk_[A-Za-z0-9_-]{16,}$/.test(value.trim());
}
export function devGatewayEnabled(env = {}) {
  return hasUsableKey(env.GROQ_API_KEY) && env.VITE_ASSISTANT_ENABLED !== 'false' && env.ASSISTANT_DEV_ENABLED !== 'false';
}
function isLoopback(value) { return ['localhost', '127.0.0.1', '[::1]', '::1', '::ffff:127.0.0.1'].includes(String(value).toLowerCase()); }

function explicitlyAllowedLocalOrigin(origin, allowedOrigins) {
  if (typeof origin !== 'string' || typeof allowedOrigins !== 'string') return false;
  let page;
  try { page = new URL(origin); } catch { return false; }
  // Accept complete, canonical loopback origins only: no credentials, path,
  // query, fragment, wildcard or URL-normalized aliases of another host.
  if (!['http:', 'https:'].includes(page.protocol) || !isLoopback(page.hostname) || page.origin !== origin) return false;
  return allowedOrigins.split(',').some(value => value.trim() === origin);
}

/** Only trusted loopback pages can use the local server's private key. */
export function localRequestOrigin({ host, origin, remoteAddress, port, encrypted = false, fetchSite, allowedOrigins = '' }) {
  if (!isLoopback(remoteAddress) || !host || typeof host !== 'string' || host.includes(',')) return null;
  let target;
  try { target = new URL(`${encrypted ? 'https' : 'http'}://${host}`); } catch { return null; }
  if (!isLoopback(target.hostname) || target.username || target.password || target.pathname !== '/' || target.search || target.hash || Number(target.port || (encrypted ? 443 : 80)) !== port) return null;
  const trustedPage = explicitlyAllowedLocalOrigin(origin, allowedOrigins);
  if (origin && origin !== target.origin && !trustedPage) return null;
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite) && !(trustedPage && ['same-site', 'cross-site'].includes(fetchSite))) return null;
  return target.origin;
}

/**
 * Implements the same service-role RPC contract in one Node process. It is only
 * for local development; atomic synchronous operations, bounded maps and TTLs
 * prevent accidental unbounded use. No conversations or audio reach disk.
 */
export function createMemoryRpc({ now = () => Date.now(), maxSessions = 50, maxUsage = 2000 } = {}) {
  const sessions = new Map(); const usage = new Map();
  function cleanup() {
    const time = now();
    for (const [id, session] of sessions) if (session.expiresAt <= time) sessions.delete(id);
    for (const [key, entry] of usage) if (entry.end + 86400000 <= time) usage.delete(key);
  }
  const timer = setInterval(cleanup, 60000); timer.unref?.();
  function quota(buckets) {
    const entries = buckets.map(b => ({ ...b, id: `${b.key}|${b.start}`, end: Date.parse(b.end) }));
    if (entries.some(b => !Number.isSafeInteger(b.amount) || b.amount < 0 || !Number.isSafeInteger(b.limit) || b.limit < 1 || !Number.isFinite(b.end))) throw new Error('Invalid quota');
    const additions = new Set(entries.filter(b => !usage.has(b.id)).map(b => b.id)).size;
    if (usage.size + additions > maxUsage) return { status: 'quota', retryAfter: 60 };
    let retryAfter = 0;
    for (const b of entries) if ((usage.get(b.id)?.used || 0) + b.amount > b.limit) retryAfter = Math.max(retryAfter, Math.max(1, Math.ceil((b.end - now()) / 1000)));
    if (retryAfter) return { status: 'quota', retryAfter };
    for (const b of entries) {
      const previous = usage.get(b.id);
      usage.set(b.id, { used: (previous?.used || 0) + b.amount, end: b.end });
    }
    return null;
  }
  function get(args) {
    const session = sessions.get(args.p_id);
    return session && session.hash === args.p_capability_hash && session.expiresAt > now() ? session : null;
  }
  const rpc = async (name, args) => {
    cleanup();
    if (name === 'assistant_create_session') {
      if (sessions.size >= maxSessions) return { status: 'quota', retryAfter: 60 };
      const denied = quota(args.p_buckets); if (denied) return denied;
      const expiresAt = now() + (args.p_scope === 'chat' ? 86400000 : 900000);
      sessions.set(args.p_id, { hash: args.p_capability_hash, scope: args.p_scope, expiresAt, turns: new Map() });
      return { status: 'created', expiresAt: new Date(expiresAt).toISOString() };
    }
    if (name === 'assistant_finish_turn') {
      const turn = sessions.get(args.p_id)?.turns.get(args.p_turn_id);
      if (!turn || turn.lease !== args.p_lease_id || turn.state !== 'pending' || turn.leaseExpiry <= now()) return { ok: false };
      turn.state = args.p_failed ? 'failed' : 'complete'; turn.result = args.p_result;
      // A successful completion reports real total usage. Reconcile only its
      // token reservations; ambiguous/cancelled failures retain the full budget.
      if (!args.p_failed && Number.isSafeInteger(args.p_actual_tokens) && args.p_actual_tokens >= 0 && args.p_actual_tokens < turn.tokens) {
        for (const b of turn.buckets) if (b.key.includes(':tokens:')) {
          const entry = usage.get(`${b.key}|${b.start}`);
          if (entry) entry.used = Math.max(0, entry.used - (turn.tokens - args.p_actual_tokens));
        }
      }
      return { ok: true };
    }
    const session = get(args);
    if (!session) return { status: 'not_found' };
    if (name === 'assistant_get_session') return {
      status: 'found', id: args.p_id, scope: session.scope, expiresAt: new Date(session.expiresAt).toISOString(),
      turns: [...session.turns.entries()].filter(([, t]) => t.kind === 'chat' && t.state === 'complete').map(([id, t]) => ({ turnId: id, message: t.message, ...t.result })),
    };
    if (name === 'assistant_delete_session') { sessions.delete(args.p_id); return { status: 'deleted' }; }
    if (name === 'assistant_feedback') {
      const turn = session.turns.get(args.p_turn_id);
      if (session.scope !== 'chat' || !turn || turn.state !== 'complete' || turn.kind !== 'chat') return { status: 'not_found' };
      turn.helpful = args.p_helpful; return { status: 'saved' };
    }
    if (name === 'assistant_reserve_turn') {
      if ((args.p_kind === 'chat' ? 'chat' : 'transcription') !== session.scope) return { status: 'wrong_scope' };
      const previous = session.turns.get(args.p_turn_id);
      if (previous) {
        if (previous.inputHash !== args.p_input_hash) return { status: 'conflict' };
        if (previous.state === 'complete') return { status: 'cached', result: previous.result };
        if (previous.state === 'failed') return { status: 'failed', result: previous.result };
        if (previous.leaseExpiry > now()) return { status: 'pending', retryAfter: 2 };
        previous.state = 'failed'; previous.result = { error: { code: 'interrupted' } }; return { status: 'failed', result: previous.result };
      }
      if ([...session.turns.values()].some(t => t.state === 'pending' && t.leaseExpiry > now())) return { status: 'busy', retryAfter: 2 };
      if (session.turns.size >= 60) return { status: 'quota', retryAfter: Math.max(1, Math.ceil((session.expiresAt - now()) / 1000)) };
      const denied = quota(args.p_buckets); if (denied) return denied;
      const lease = randomBytes(16).toString('hex');
      session.turns.set(args.p_turn_id, { state: 'pending', kind: args.p_kind, inputHash: args.p_input_hash, message: args.p_message, lease, leaseExpiry: now() + 45000, tokens: args.p_tokens, buckets: args.p_buckets });
      return { status: 'reserved', leaseId: lease };
    }
    throw new Error('Unsupported local RPC');
  };
  return { rpc, cleanup, dispose() { clearInterval(timer); sessions.clear(); usage.clear(); }, counts: () => ({ sessions: sessions.size, usageBuckets: usage.size }) };
}

export function localHandlerEnvironment(env) {
  const secret = randomBytes(32).toString('hex');
  return key => ({
    ...DEV_LIMITS,
    ASSISTANT_ENABLED: devGatewayEnabled(env) ? 'true' : 'false',
    ASSISTANT_VOICE_ENABLED: env.VITE_ASSISTANT_VOICE_ENABLED === 'true' ? 'true' : 'false',
    ASSISTANT_QUOTAS_VERIFIED: 'true', // Internal local budgets above; never deployed.
    ASSISTANT_IP_HASH_SECRET: secret,
    GROQ_API_KEY: env.GROQ_API_KEY?.trim(),
    ASSISTANT_CHAT_MODEL: env.ASSISTANT_CHAT_MODEL || 'openai/gpt-oss-120b',
  })[key];
}

function localError(res, status, code, message) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify({ error: { code, message } }));
}

/**
 * @param {{env?: Record<string, string | undefined>, projectRoot: string, fetcher?: typeof globalThis.fetch}} options
 * @returns {import('vite').Plugin}
 */
export function createAssistantDevPlugin({ env = {}, projectRoot, fetcher = globalThis.fetch }) {
  const available = devGatewayEnabled(env);
  return {
    name: 'aegis-local-assistant', apply: 'serve',
    async configureServer(server) {
      if (!available) return;
      const store = createMemoryRpc();
      // Vite's SSR graph invalidates reviewed knowledge/provider modules when
      // they change. Node import() would keep stale modules after a Vite restart.
      // The RAM store stays outside that graph, preserving ordinary conversations.
      const handlerDirectory = path.join(projectRoot, 'supabase/functions/assistant');
      const handlerId = `/@fs/${path.join(handlerDirectory, 'handler.mjs').replace(/\\/g, '/')}`;
      server.watcher?.add(['handler.mjs', 'provider.mjs', 'policy.mjs', 'knowledge.mjs', 'quotas.mjs', 'scope.mjs'].map(name => path.join(handlerDirectory, name)));
      const getEnv = localHandlerEnvironment(env);
      server.httpServer?.once('close', () => store.dispose());
      server.middlewares.use(async (req, res, next) => {
        const rawPath = req.url || '/';
        if (rawPath !== '/api/assistant' && !rawPath.startsWith('/api/assistant/')) return next();
        const origin = localRequestOrigin({ host: req.headers.host, origin: req.headers.origin, remoteAddress: req.socket.remoteAddress, port: req.socket.localPort, encrypted: Boolean(req.socket.encrypted), fetchSite: req.headers['sec-fetch-site'], allowedOrigins: env.ASSISTANT_DEV_ALLOWED_ORIGINS });
        if (!origin) return localError(res, 403, 'local_only', 'The development assistant is available only from this localhost page.');
        const abort = new AbortController();
        const disconnected = () => { if (!res.writableEnded) abort.abort(); };
        req.once('aborted', disconnected); res.once('close', disconnected);
        try {
          const headers = new Headers();
          for (const [name, value] of Object.entries(req.headers)) if (value !== undefined && !['cf-connecting-ip', 'x-forwarded-for', 'cookie'].includes(name)) headers.set(name, Array.isArray(value) ? value.join(',') : value);
          headers.set('cf-connecting-ip', req.socket.remoteAddress || 'unknown');
          const init = { method: req.method || 'GET', headers, signal: abort.signal };
          if (!['GET', 'HEAD'].includes(init.method)) { init.body = Readable.toWeb(req); init.duplex = 'half'; }
          const { createHandler } = await server.ssrLoadModule(handlerId);
          let fallbackReason;
          const handler = createHandler({ getEnv, fetcher, rpc: store.rpc, onProviderError: code => { fallbackReason = code; } });
          const response = await handler(new Request(`${origin}/assistant${rawPath.slice('/api/assistant'.length)}`, init));
          if (res.destroyed) return;
          res.statusCode = response.status;
          response.headers.forEach((value, name) => { if (name !== 'access-control-allow-origin') res.setHeader(name, value); });
          if (fallbackReason) res.setHeader('X-Assistant-Fallback-Reason', fallbackReason);
          if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
          res.setHeader('Vary', 'Origin');
          const body = Buffer.from(await response.arrayBuffer());
          if (!res.destroyed) res.end(body);
        } catch { if (!res.destroyed) localError(res, 503, 'local_unavailable', 'The local AI request could not complete. Please try again.'); }
        finally { req.off('aborted', disconnected); res.off('close', disconnected); }
      });
    },
  };
}
