"use client";
import { useCallback, useEffect, useState } from "react";
import { Server, Send, Download, Undo2, Loader2, CheckCircle2, XCircle, Clock, Cpu } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";
import { toast } from "@/components/ui/toast";

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

const pct = (v: any) => (v == null ? "—" : `${(Number(v) * 100).toFixed(1)}%`);

const PKG_STATUS: Record<string, { label: string; cls: string }> = {
  validated: { label: "Ready to share", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  submitted: { label: "Vendor reviewing", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  accepted: { label: "Accepted by vendor", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  rejected: { label: "Not accepted", cls: "bg-red-500/10 text-red-600 dark:text-red-400" },
};

/** Server-side improved weights: train here, share with the vendor, receive vendor releases. */
export function WeightsPanel({ onChange }: { onChange?: () => void }) {
  const [status, setStatus] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [releases, setReleases] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const base = getApiBaseUrl(), headers = authHeaders();
    const get = (p: string) => fetch(`${base}${p}`, { headers }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const [s, p, r] = await Promise.all([get("/admin/model-updates/status"), get("/admin/model-updates/packages"), get("/admin/model-updates/releases")]);
    if (s) setStatus(s);
    if (Array.isArray(p)) setPackages(p);
    if (r) setReleases(r);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!packages.some(p => p.status === "submitted")) return;
    const t = setInterval(async () => {
      for (const p of packages.filter(x => x.status === "submitted")) {
        await fetch(`${getApiBaseUrl()}/admin/model-updates/packages/${p.package_id}/vendor-status`, { headers: authHeaders() }).catch(() => null);
      }
      load();
    }, 15000);
    return () => clearInterval(t);
  }, [packages, load]);

  const post = async (key: string, path: string, ok: string) => {
    setBusy(key);
    try {
      const res = await fetch(`${getApiBaseUrl()}${path}`, { method: "POST", headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { toast(ok); await load(); onChange?.(); }
      else toast(typeof data.detail === "string" ? data.detail : "That did not work.", "error");
    } catch { toast("Network error.", "error"); } finally { setBusy(null); }
  };

  const enough = (status?.verified_url_samples ?? 0) >= (status?.min_samples ?? 20);

  return (
    <div className="stat-card space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2"><Server className="w-4 h-4 text-purple-500" /> Improved URL model weights (trained on this server)</h2>
          <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 max-w-2xl">
            Fine-tunes the URL model&apos;s decision layers on your verified incidents. Training runs on your AegisOne server, never on a laptop. The result goes live only if it
            beats the current model on data it has never seen without adding false alarms. Sharing the result with AegisOne is optional, and only the small weights file leaves your network.
          </p>
        </div>
        <div className="text-right text-[11px] text-surface-500">
          <div>Active: <b className="text-surface-800 dark:text-surface-200">{status?.active_version ?? "…"}</b></div>
          <div>{status?.verified_url_samples ?? 0} verified URL examples (need {status?.min_samples ?? 20})</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => post("train", "/admin/model-updates/train", "Training started on the server. Progress shows under Retraining jobs.")}
          disabled={busy === "train" || !enough}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50 disabled:cursor-not-allowed">
          {busy === "train" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />} Train improved weights
        </button>
        <button onClick={() => post("revert", "/admin/model-updates/revert", "URL model returned to its shipped weights.")} disabled={busy === "revert"}
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl border border-surface-300 dark:border-white/[0.1] text-surface-700 dark:text-surface-200">
          <Undo2 className="w-4 h-4" /> Revert to shipped weights
        </button>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-2">Your trained packages</h3>
        {packages.length === 0 ? <p className="text-xs text-surface-500">None yet. A package appears when a training run passes the safety check.</p> : (
          <div className="space-y-2">
            {packages.map(p => {
              const st = PKG_STATUS[p.status] || PKG_STATUS.validated;
              const oh = p.org_holdout, ref = p.reference?.candidate?.hard_set || p.reference?.candidate?.v7_test;
              return (
                <div key={p.package_id} className="rounded-xl border border-surface-200 dark:border-white/[0.06] p-3.5 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-surface-700 dark:text-surface-200">{p.version_tag}</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-surface-500">
                    Your hold-out: recall {pct(oh?.base?.recall)} → {pct(oh?.candidate?.recall)}, false alarms {pct(oh?.base?.fpr)} → {pct(oh?.candidate?.fpr)}
                    {ref ? ` • benchmark F1 ${pct(ref.f1)}` : ""}
                  </p>
                  {p.vendor_verdict?.reason && <p className="text-surface-500 flex gap-1.5"><XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-500" /> {p.vendor_verdict.reason}</p>}
                  {p.status === "validated" && (
                    <button onClick={() => post(p.package_id, `/admin/model-updates/packages/${p.package_id}/submit`, "Sent to AegisOne for evaluation.")}
                      disabled={busy === p.package_id || !status?.vendor_configured || !status?.contribution_allowed}
                      title={!status?.contribution_allowed ? "Turn Sharing ON under Global AegisOne learning first" : !status?.vendor_configured ? "No AegisOne hub is configured for this server" : ""}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-white/[0.06] font-semibold text-surface-700 dark:text-surface-200 disabled:opacity-50">
                      {busy === p.package_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Share with AegisOne for evaluation
                    </button>
                  )}
                  {p.status === "submitted" && <p className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><Clock className="w-3.5 h-3.5" /> Being benchmarked against the current global model…</p>}
                  {p.status === "accepted" && <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Promoted to a global release.</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-2">Global releases from AegisOne</h3>
        {releases?.error && <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">{releases.error}</p>}
        {!releases?.vendor_configured ? <p className="text-xs text-surface-500">This server is not connected to an AegisOne hub (AEGIS_VENDOR_URL).</p>
          : (releases?.releases?.length ?? 0) === 0 ? <p className="text-xs text-surface-500">No global releases yet.</p> : (
          <div className="space-y-2">
            {releases.releases.map((r: any) => (
              <div key={r.release_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-200 dark:border-white/[0.06] p-3.5 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-surface-900 dark:text-white">AegisOne {r.version_tag}</p>
                  <p className="text-surface-500 truncate max-w-xl" title={r.release_notes}>{r.release_notes}</p>
                </div>
                {r.deployed ? <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold"><CheckCircle2 className="w-4 h-4" /> Active</span> : (
                  <button onClick={() => post(r.release_id, `/admin/model-updates/releases/${r.release_id}/deploy`, "Checking the release against your data, then activating if it passes.")}
                    disabled={busy === r.release_id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-white/[0.06] font-semibold text-surface-700 dark:text-surface-200">
                    {busy === r.release_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Validate &amp; deploy
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
