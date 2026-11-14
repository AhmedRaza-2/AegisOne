"use client";
import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";
import { visibleInterval } from "@/lib/visible-interval";

type Row = {
  user_id: number; name?: string; email?: string; department?: string;
  score: number; level: "low" | "medium" | "high"; status: "baseline" | "learning"; reasons: string[];
};

const LEVEL: Record<Row["level"], string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

/** People whose last 24 hours differ most from their own history (scope 7.3, behavioural anomaly detection). */
export default function BehaviorAnomalies() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token") || "";
      const res = await fetch(`${getApiBaseUrl()}/admin/behavior/anomalies`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data.users) ? data.users : []);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Could not load behaviour analysis.");
    }
  };

  useEffect(() => {
    load();
    const t = visibleInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const flagged = (rows || []).filter(r => r.level !== "low");

  return (
    <section className="stat-card space-y-3" aria-labelledby="behavior-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="behavior-heading" className="text-sm font-bold text-surface-900 dark:text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-600" aria-hidden="true" /> Unusual behaviour (last 24 hours)
          </h2>
          <p className="text-[11px] text-surface-500 mt-0.5">
            Compared with each person&apos;s own history and with the rest of the organisation. Uses only what the protection recorded, never page content.
          </p>
        </div>
        <button onClick={load} aria-label="Refresh behaviour analysis" className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/5 text-surface-500">
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      {!error && rows === null && <p className="text-xs text-surface-500">Loading…</p>}
      {rows !== null && flagged.length === 0 && !error && (
        <p className="text-xs text-surface-500">
          Nothing unusual. {rows.filter(r => r.status === "learning").length > 0 && `${rows.filter(r => r.status === "learning").length} people have too little history yet (needs 5 days).`}
        </p>
      )}

      <ul className="divide-y divide-surface-100 dark:divide-white/5">
        {flagged.slice(0, 8).map(r => (
          <li key={r.user_id} className="py-2.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{r.name || r.email || `User ${r.user_id}`}</p>
              <p className="text-[11px] text-surface-500 truncate">{[r.email, r.department].filter(Boolean).join(" · ")}</p>
              <ul className="mt-1 space-y-0.5">
                {r.reasons.map((why, i) => <li key={i} className="text-[11px] text-surface-600 dark:text-surface-300">• {why}</li>)}
              </ul>
            </div>
            <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold capitalize tabular-nums ${LEVEL[r.level]}`}>
              {r.level} · {r.score}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
