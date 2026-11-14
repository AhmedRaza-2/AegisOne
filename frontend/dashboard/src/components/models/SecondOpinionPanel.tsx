"use client";
import { useEffect, useState } from "react";
import { Scale, RefreshCw, Loader2 } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { visibleInterval } from "@/lib/visible-interval";

type Metrics = { auc: number; tpr_1pct: number; "tpr_0.1pct": number; ap_1pct_base: number };
type Status = {
  mode: "off" | "shadow" | "upgrade";
  modes: Record<string, string>;
  model: { id?: string; repo?: string; revision?: string; licence?: string; description?: string; upgrade_threshold?: number };
  available: boolean;
  error?: string | null;
  live: { scored: number; agree: number; disagree_open_higher: number; disagree_aegis_higher: number; upgraded: number;
          agreement_rate: number | null; avg_ms: number | null; since: string };
  evaluation: {
    same_data?: { n_genuine: number; n_phishing: number; models: Record<string, Metrics>; licences: Record<string, string>;
                  fusion: Record<string, Record<string, Metrics>> };
    temporal_check?: Record<string, number | string>;
  };
};

const MODE_LABEL: Record<Status["mode"], string> = { off: "Off", shadow: "Show only", upgrade: "Can raise to block" };
const pct = (v?: number) => (typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "–");

function headers(): Record<string, string> {
  const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token") || "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

/** Open-source URL model scored on the same data as AegisOne, and the switch that decides how much it may do. */
export function SecondOpinionPanel() {
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState<Status["mode"] | null>(null);

  const load = async () => {
    try {
      const r = await fetch(`${getApiBaseUrl()}/admin/models/second-opinion`, { headers: headers() });
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      setS(await r.json());
      setErr("");
    } catch (e: any) {
      setErr(e?.message || "Could not load the second opinion.");
    }
  };

  useEffect(() => {
    load();
    const t = visibleInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const setMode = async (mode: Status["mode"]) => {
    setSaving(mode);
    try {
      const r = await fetch(`${getApiBaseUrl()}/admin/models/second-opinion`, { method: "PUT", headers: headers(), body: JSON.stringify({ mode }) });
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      setS(await r.json());
      toast(`Second opinion set to "${MODE_LABEL[mode]}".`, "success");
    } catch (e: any) {
      toast(e?.message || "Could not change the mode.", "error");
    }
    setSaving(null);
  };

  const sd = s?.evaluation?.same_data;
  const tc = s?.evaluation?.temporal_check;
  const rows = sd ? Object.entries(sd.models) : [];
  const chosen = s?.model?.repo;
  const fusion = chosen && sd?.fusion?.[chosen]?.["stacked (logistic, 5-fold out-of-fold)"];

  return (
    <section className="stat-card space-y-4" aria-labelledby="second-opinion-heading">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 id="second-opinion-heading" className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2">
            <Scale className="w-4 h-4 text-brand-500" aria-hidden="true" /> Second opinion (open-source URL model)
          </h2>
          <p className="text-[11px] text-surface-500 mt-0.5 max-w-2xl">
            Open-source models were scored on exactly the same links as AegisOne. The best one runs next to AegisOne;
            it can never lower a verdict and never touches rule decisions.
          </p>
        </div>
        <button onClick={load} aria-label="Refresh second opinion" className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/5 text-surface-500">
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {err && <p className="text-xs text-red-600" role="alert">{err}</p>}
      {!err && !s && <p className="text-xs text-surface-500">Loading…</p>}

      {s && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="Second opinion mode" className="inline-flex rounded-xl border border-surface-200 dark:border-white/10 p-0.5">
              {(["off", "shadow", "upgrade"] as const).map(m => (
                <button key={m} role="radio" aria-checked={s.mode === m} disabled={!!saving} onClick={() => s.mode !== m && setMode(m)}
                  title={s.modes?.[m]}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 ${s.mode === m
                    ? "bg-brand-950 text-white shadow-sm dark:bg-white dark:text-brand-950"
                    : "text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-white/5"}`}>
                  {saving === m && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}{MODE_LABEL[m]}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-surface-500">{s.modes?.[s.mode]}</span>
          </div>

          <div className="text-[11px] text-surface-600 dark:text-surface-300 flex flex-wrap gap-x-4 gap-y-1">
            <span><strong className="text-surface-900 dark:text-white">{s.model.repo}</strong> · {s.model.licence} · revision {s.model.revision?.slice(0, 8)}</span>
            <span className={s.available ? "text-emerald-600" : "text-amber-600"}>{s.available ? "Loaded" : s.mode === "off" ? "Not loaded (off)" : `Unavailable${s.error ? `: ${s.error}` : ""}`}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Links checked", s.live.scored.toLocaleString()],
              ["Both agree", s.live.agreement_rate == null ? "–" : pct(s.live.agreement_rate)],
              ["Raised to block", s.live.upgraded.toLocaleString()],
              ["Extra time per link", s.live.avg_ms == null ? "–" : `${s.live.avg_ms} ms`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-surface-200 dark:border-white/[0.06] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-surface-500 font-semibold">{k}</p>
                <p className="text-sm font-bold text-surface-900 dark:text-white tabular-nums">{v}</p>
              </div>
            ))}
          </div>
          {s.live.scored > 0 && (
            <p className="text-[11px] text-surface-500">
              Disagreements since {new Date(s.live.since).toLocaleString()}: open model warned and AegisOne did not {s.live.disagree_open_higher},
              AegisOne warned and the open model did not {s.live.disagree_aegis_higher}.
            </p>
          )}

          {sd && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs tabular-nums">
                <caption className="text-left text-[11px] text-surface-500 pb-2">
                  Same data for every model: {sd.n_genuine.toLocaleString()} genuine links and {sd.n_phishing} fresh phishing links
                  (OpenPhish, after training). "Caught" is measured with each model&apos;s threshold set so that only 1% / 0.1% of the genuine links are flagged.
                </caption>
                <thead>
                  <tr className="text-left text-surface-500 border-b border-surface-200 dark:border-white/[0.06]">
                    <th className="py-1.5 pr-3 font-semibold">Model</th><th className="pr-3 font-semibold">Licence</th>
                    <th className="pr-3 font-semibold">AUC</th><th className="pr-3 font-semibold">Caught @1%</th>
                    <th className="pr-3 font-semibold">Caught @0.1%</th><th className="font-semibold">AP @1% phishing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-white/[0.04]">
                  {rows.map(([name, m]) => (
                    <tr key={name} className={name === chosen ? "bg-accent-50/60 dark:bg-accent-900/20" : ""}>
                      <td className="py-1.5 pr-3 font-medium text-surface-900 dark:text-white">{name}{name === chosen ? " (in use)" : ""}</td>
                      <td className="pr-3 text-surface-500">{sd.licences?.[name] || "ours"}</td>
                      <td className="pr-3">{m.auc.toFixed(3)}</td><td className="pr-3">{pct(m.tpr_1pct)}</td>
                      <td className="pr-3">{pct(m["tpr_0.1pct"])}</td><td>{m.ap_1pct_base.toFixed(3)}</td>
                    </tr>
                  ))}
                  {fusion && (
                    <tr className="font-semibold">
                      <td className="py-1.5 pr-3 text-surface-900 dark:text-white">AegisOne + {s.model.id} (combined)</td>
                      <td className="pr-3 text-surface-500">–</td>
                      <td className="pr-3">{fusion.auc.toFixed(3)}</td><td className="pr-3">{pct(fusion.tpr_1pct)}</td>
                      <td className="pr-3">{pct(fusion["tpr_0.1pct"])}</td><td>{fusion.ap_1pct_base.toFixed(3)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tc && (
            <p className="text-[11px] text-surface-600 dark:text-surface-300">
              <strong>Test on a later feed</strong> (fitted on {String(tc.fit)}, tested on {String(tc.test)}): phishing blocked{" "}
              {tc.aegisone_block_caught_pct}% → {tc.with_second_opinion_block_caught_pct}%, genuine links wrongly blocked{" "}
              {tc.aegisone_block_false_pct}% → {tc.with_second_opinion_block_false_pct}%. Warnings are unchanged.
            </p>
          )}
        </>
      )}
    </section>
  );
}
