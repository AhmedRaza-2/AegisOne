"use client";
import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Clock, CheckCircle2, Ban, ShieldQuestion, X, Activity, ArrowUpCircle } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

function authHeaders() {
  const t = typeof window !== "undefined"
    ? (localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token"))
    : null;
  return { Authorization: `Bearer ${t || ""}`, "Content-Type": "application/json" };
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  investigating: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  escalated: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  false_positive: "bg-surface-200 text-surface-600 dark:bg-surface-800 dark:text-surface-400",
};

const DECISIONS = [
  { value: "CONFIRMED_PHISHING", label: "Confirmed Phishing", icon: Ban, cls: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20" },
  { value: "FALSE_POSITIVE", label: "False Positive", icon: CheckCircle2, cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20" },
  { value: "FALSE_NEGATIVE", label: "False Negative", icon: AlertTriangle, cls: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20" },
  { value: "BENIGN", label: "Benign", icon: CheckCircle2, cls: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20" },
  { value: "NEEDS_INVESTIGATION", label: "Needs Investigation", icon: ShieldQuestion, cls: "border-surface-300 dark:border-white/[0.1] text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-white/[0.05]" },
  { value: "INVALID", label: "Invalid Report", icon: X, cls: "border-surface-300 dark:border-white/[0.1] text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-white/[0.05]" },
];

export default function AdminIncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [acting, setActing] = useState(false);

  const fetchIncidents = useCallback(() => {
    const qs = filter !== "all" ? `?status=${filter}` : "";
    fetch(`${getApiBaseUrl()}/admin/incidents${qs}`, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        // Escalated incidents surface first so admins triage them before routine reports
        const sorted = [...(Array.isArray(data) ? data : [])].sort((a, b) => {
          if (a.status === "escalated" && b.status !== "escalated") return -1;
          if (b.status === "escalated" && a.status !== "escalated") return 1;
          return 0;
        });
        setIncidents(sorted);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 10000);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  const openDetail = async (inc: any) => {
    setSelected(inc);
    setDetail(null);
    setAdminNotes("");
    const res = await fetch(`${getApiBaseUrl()}/admin/incidents/${inc.incident_id}`, { headers: authHeaders() });
    if (res.ok) setDetail(await res.json());
  };

  const verify = async (decision: string) => {
    if (!selected) return;
    setActing(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/incidents/${selected.incident_id}/verify`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ decision, admin_notes: adminNotes, create_training_candidate: true }),
      });
      if (res.ok) {
        setSelected(null);
        fetchIncidents();
      }
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <AlertTriangle className="w-6 h-6 text-amber-500" /> Incidents Queue
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Organization-wide reports and manager escalations — verifying a decision here feeds the retraining pipeline.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "open", "investigating", "escalated", "resolved", "false_positive"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${
              filter === f
                ? "bg-brand-600/10 text-brand-650 dark:text-brand-400 border border-brand-500/20"
                : "text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white border border-transparent hover:bg-surface-100 dark:hover:bg-white/[0.04]"
            }`}
          >
            {f === "all" ? "All Incidents" : f.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Activity className="w-6 h-6 text-brand-400 animate-spin" />
          </div>
        ) : incidents.length === 0 ? (
          <div className="glass-card p-8 text-center text-surface-500">
            No incidents found matching these parameters.
          </div>
        ) : (
          incidents.map((inc) => (
            <button
              key={inc.incident_id}
              onClick={() => openDetail(inc)}
              className={`w-full text-left glass-card p-5 hover:border-surface-300 dark:hover:border-white/[0.12] transition-all ${inc.status === "escalated" ? "ring-1 ring-purple-500/30" : ""}`}
            >
              <div className="flex items-start gap-3">
                {inc.status === "escalated" && <ArrowUpCircle className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />}
                <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                  inc.severity === "critical" ? "bg-red-500 animate-pulse" :
                  inc.severity === "high" ? "bg-amber-500" :
                  inc.severity === "medium" ? "bg-blue-500" : "bg-surface-400"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h3 className="text-sm font-semibold text-surface-900 dark:text-white truncate">{inc.incident_id}</h3>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[inc.status] || STATUS_STYLES.open}`}>
                      {(inc.status || "open").replace("_", " ")}
                    </span>
                    {inc.admin_decision && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-200 text-surface-700 dark:bg-white/[0.06] dark:text-surface-300 capitalize">
                        {inc.admin_decision.replace("_", " ").toLowerCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-surface-600 dark:text-surface-300 capitalize">
                    {(inc.report_type || "").replace("_", " ")} · Risk {inc.risk_score ?? "—"}
                  </p>
                  <div className="mt-3.5 pt-3.5 border-t border-surface-150 dark:border-white/[0.04] flex flex-wrap gap-4 text-xs text-surface-500">
                    <span>{inc.reports_count} report{inc.reports_count === 1 ? "" : "s"}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(inc.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-[#0B101E] border border-surface-200 dark:border-white/[0.08] rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden">
            <div className="p-6 sm:p-8 max-h-[80vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl font-extrabold text-surface-900 dark:text-white">{selected.incident_id}</h3>
                  <p className="text-xs text-surface-500 mt-1 capitalize">{(selected.report_type || "").replace("_", " ")} · {selected.severity} severity</p>
                </div>
                <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-100 dark:bg-white/[0.05] text-surface-500 hover:text-surface-900 dark:hover:text-white transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!detail ? (
                <div className="flex items-center justify-center py-10"><Activity className="w-5 h-5 text-brand-400 animate-spin" /></div>
              ) : (
                <div className="space-y-4">
                  {detail.incident?.manager_notes && (
                    <div className="bg-purple-500/5 border border-purple-500/20 p-4 rounded-2xl">
                      <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">Manager Notes</span>
                      <p className="text-sm text-surface-700 dark:text-surface-300 mt-1.5">{detail.incident.manager_notes}</p>
                    </div>
                  )}

                  <div className="bg-surface-50 dark:bg-[#141A29] border border-surface-100 dark:border-white/[0.04] p-4 rounded-2xl">
                    <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">Detection reference</span>
                    <p className="text-sm text-surface-800 dark:text-surface-300 font-mono break-all mt-1.5">
                      {detail.incident?.detection_event_ref || "—"}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">Reports ({detail.reports?.length || 0})</span>
                    <div className="mt-2 space-y-2">
                      {(detail.reports || []).map((r: any) => (
                        <div key={r.report_id} className="border border-surface-100 dark:border-white/[0.05] rounded-xl p-3 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-surface-500">{r.report_id}</span>
                            <span className="capitalize text-surface-500">{r.report_type?.replace("_", " ")}</span>
                          </div>
                          {r.user_notes && <p className="text-surface-600 dark:text-surface-300">{r.user_notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-surface-500 uppercase tracking-widest mb-1.5">Admin Notes</label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={3}
                      maxLength={10000}
                      placeholder="Reasoning for this decision..."
                      className="w-full px-3 py-2 bg-surface-50 dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:border-brand-500/50 resize-none"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">Decision</span>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {DECISIONS.map((d) => (
                        <button
                          key={d.value}
                          disabled={acting}
                          onClick={() => verify(d.value)}
                          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-50 ${d.cls}`}
                        >
                          <d.icon className="w-3.5 h-3.5" /> {d.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-surface-500 mt-2">Confirmed Phishing / False Positive / False Negative / Benign create a deduplicated training sample for the local retraining pipeline.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
