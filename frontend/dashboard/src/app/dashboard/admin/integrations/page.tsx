"use client";
import { useCallback, useEffect, useState } from "react";
import { Key, Webhook, Plus, Trash2, Copy, Check, Send, Loader2, AlertTriangle, ShieldCheck, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { getApiBaseUrl } from "@/lib/api";
import { toast } from "@/components/ui/toast";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

async function api(path: string, method = "GET", body?: any) {
  const res = await fetch(`${getApiBaseUrl()}${path}`, { method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Request failed");
  return data;
}

function CopyBox({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-100 dark:bg-white/[0.06] px-3 py-2">
      <code className="text-xs break-all flex-1 text-surface-800 dark:text-surface-100">{value}</code>
      <button onClick={() => { navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => { }); }}
        className="shrink-0 text-surface-500 hover:text-surface-800 dark:hover:text-white">{done ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}</button>
    </div>
  );
}

export default function IntegrationsPage() {
  const [meta, setMeta] = useState<{ scopes: string[]; events: string[] }>({ scopes: [], events: [] });
  const [keys, setKeys] = useState<any[]>([]);
  const [hooks, setHooks] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["incidents:read", "events:read"]);
  const [created, setCreated] = useState<{ title: string; value: string; note: string } | null>(null);
  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<string[]>(["*"]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, k, h, d] = await Promise.all([api("/admin/integrations/meta"), api("/admin/integrations/keys"), api("/admin/integrations/webhooks"), api("/admin/integrations/deliveries?limit=15")]);
      setMeta(m); setKeys(k); setHooks(h); setDeliveries(d);
    } catch (e: any) { toast(e.message, "error"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); await load(); } catch (e: any) { toast(e.message || "Something went wrong", "error"); } finally { setBusy(null); }
  };

  const base = typeof window !== "undefined" ? getApiBaseUrl() : "";

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-6 max-w-5xl mx-auto">
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">Integrations &amp; API</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Connect AegisOne to your SIEM, ticketing and chat tools, or call it from your own software.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-100 hover:bg-surface-200 dark:bg-white/[0.05] text-surface-700 dark:text-surface-200"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </motion.div>

      {created && (
        <motion.div variants={fadeUp} className="stat-card border border-amber-400/40">
          <p className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> {created.title}</p>
          <p className="text-xs text-surface-500 my-2">{created.note}</p>
          <CopyBox value={created.value} />
          <button onClick={() => setCreated(null)} className="mt-3 text-xs font-semibold text-brand-600">I have saved it</button>
        </motion.div>
      )}

      {/* API keys */}
      <motion.div variants={fadeUp} className="stat-card space-y-4">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2"><Key className="w-4 h-4 text-brand-500" /> API keys</h2>
        <p className="text-xs text-surface-500">Send a key as the <code>X-API-Key</code> header to <code>{base}/api/v1/…</code>: <code>/incidents</code>, <code>/events</code> (add <code>?format=cef</code> for SIEMs), <code>/threat-feed</code>, <code>/scan/url</code>. Limit: 120 requests a minute per key.</p>
        <div className="flex flex-wrap gap-2 items-end">
          <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name, e.g. Splunk connector"
            className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-lg bg-surface-100 dark:bg-white/[0.05] border border-transparent focus:border-brand-500 outline-none text-surface-900 dark:text-white" />
          <div className="flex flex-wrap gap-1.5">
            {meta.scopes.map(s => (
              <button key={s} onClick={() => setNewKeyScopes(v => v.includes(s) ? v.filter(x => x !== s) : [...v, s])}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${newKeyScopes.includes(s) ? "bg-brand-600/10 text-brand-600 dark:text-brand-400 border-brand-500/30" : "text-surface-500 border-surface-200 dark:border-white/[0.08]"}`}>{s}</button>
            ))}
          </div>
          <button disabled={!newKeyName.trim() || !newKeyScopes.length || busy === "newkey"}
            onClick={() => run("newkey", async () => {
              const r = await api("/admin/integrations/keys", "POST", { name: newKeyName.trim(), scopes: newKeyScopes });
              setCreated({ title: `API key “${r.name}” created`, value: r.api_key, note: r.note }); setNewKeyName("");
            })}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50">
            {busy === "newkey" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create key
          </button>
        </div>
        {keys.length === 0 ? <p className="text-xs text-surface-500">No keys yet.</p> : (
          <div className="space-y-2">
            {keys.map(k => (
              <div key={k.key_id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-200 dark:border-white/[0.06] p-3 text-xs ${k.revoked ? "opacity-50" : ""}`}>
                <div>
                  <p className="font-semibold text-surface-900 dark:text-white">{k.name} <span className="font-mono text-surface-400 ml-1">{k.prefix}</span></p>
                  <p className="text-surface-500">{(k.scopes || []).join(", ")} • last used {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}{k.revoked ? " • revoked" : ""}</p>
                </div>
                {!k.revoked && <button onClick={() => run(k.key_id, async () => { await api(`/admin/integrations/keys/${k.key_id}`, "DELETE"); toast("Key revoked."); })}
                  className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold"><Trash2 className="w-3.5 h-3.5" /> Revoke</button>}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Webhooks */}
      <motion.div variants={fadeUp} className="stat-card space-y-4">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2"><Webhook className="w-4 h-4 text-purple-500" /> Webhooks</h2>
        <p className="text-xs text-surface-500">Each event is a JSON POST signed with HMAC-SHA256 (<code>X-Aegis-Signature: t=…,v1=…</code> over <code>timestamp.body</code>). Only public https addresses are accepted.</p>
        <div className="flex flex-wrap gap-2 items-end">
          <input value={hookUrl} onChange={e => setHookUrl(e.target.value)} placeholder="https://siem.example.com/aegis-hook"
            className="flex-1 min-w-[240px] px-3 py-2 text-sm rounded-lg bg-surface-100 dark:bg-white/[0.05] border border-transparent focus:border-brand-500 outline-none text-surface-900 dark:text-white" />
          <div className="flex flex-wrap gap-1.5">
            {["*", ...meta.events].map(ev => (
              <button key={ev} onClick={() => setHookEvents(v => ev === "*" ? ["*"] : (v.includes(ev) ? v.filter(x => x !== ev) : [...v.filter(x => x !== "*"), ev]))}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${hookEvents.includes(ev) ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30" : "text-surface-500 border-surface-200 dark:border-white/[0.08]"}`}>{ev === "*" ? "all events" : ev}</button>
            ))}
          </div>
          <button disabled={!hookUrl.trim() || !hookEvents.length || busy === "newhook"}
            onClick={() => run("newhook", async () => {
              const r = await api("/admin/integrations/webhooks", "POST", { url: hookUrl.trim(), events: hookEvents });
              setCreated({ title: "Webhook created — signing secret", value: r.secret, note: r.note }); setHookUrl("");
            })}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50">
            {busy === "newhook" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add webhook
          </button>
        </div>
        {hooks.length === 0 ? <p className="text-xs text-surface-500">No webhooks yet.</p> : (
          <div className="space-y-2">
            {hooks.map(h => (
              <div key={h.webhook_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-200 dark:border-white/[0.06] p-3 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-surface-900 dark:text-white truncate max-w-md" title={h.url}>{h.url}</p>
                  <p className="text-surface-500">{(h.events || []).join(", ")} • {h.enabled ? <span className="text-emerald-600 dark:text-emerald-400">enabled</span> : <span className="text-red-500">disabled after repeated failures</span>} • last: {h.last_status || "never delivered"}</p>
                </div>
                <div className="flex gap-3 font-semibold">
                  <button onClick={() => run(h.webhook_id + "t", async () => { const r = await api(`/admin/integrations/webhooks/${h.webhook_id}/test`, "POST"); toast(r.ok ? "Test delivered." : `Test failed: ${r.error || "no response"}`, r.ok ? "success" : "error"); })}
                    className="flex items-center gap-1 text-brand-600 dark:text-brand-400">{busy === h.webhook_id + "t" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Test</button>
                  {!h.enabled && <button onClick={() => run(h.webhook_id + "e", async () => { await api(`/admin/integrations/webhooks/${h.webhook_id}/enable`, "POST"); })} className="text-emerald-600">Re-enable</button>}
                  <button onClick={() => run(h.webhook_id + "d", async () => { await api(`/admin/integrations/webhooks/${h.webhook_id}`, "DELETE"); })} className="text-red-600 dark:text-red-400">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {deliveries.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-2 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Recent deliveries</h3>
            <div className="text-[11px] space-y-1">
              {deliveries.map((d, i) => (
                <div key={i} className="flex flex-wrap gap-x-4 text-surface-500">
                  <span className={d.ok ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-red-500 font-semibold"}>{d.ok ? "OK" : "FAILED"}</span>
                  <span>{d.event}</span><span>{d.status_code ?? "—"}</span><span>{d.attempts} attempt{d.attempts === 1 ? "" : "s"}</span>
                  <span>{new Date(d.created_at).toLocaleString()}</span>{d.error && <span className="text-red-500">{d.error}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
