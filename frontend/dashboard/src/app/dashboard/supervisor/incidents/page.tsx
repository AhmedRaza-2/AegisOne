"use client";
import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Clock, ArrowUpCircle, CheckCircle2, MessageSquare, X, Activity, ShieldQuestion } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";
import { EvidencePanel } from "@/components/ui/EvidencePanel";

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

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/10 text-red-600 dark:text-red-400",
  high: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  medium: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  low: "bg-surface-200 text-surface-600 dark:bg-surface-800 dark:text-surface-400",
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);

  const fetchIncidents = useCallback(() => {
    const qs = filter !== "all" ? `?status=${filter}` : "";
    fetch(`${getApiBaseUrl()}/manager/incidents${qs}`, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setIncidents(Array.isArray(data) ? data : []);
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
    setNotes("");
    const res = await fetch(`${getApiBaseUrl()}/manager/incidents/${inc.incident_id}`, { headers: authHeaders() });
    if (res.ok) setDetail(await res.json());
  };

  const triage = async (action: "resolve" | "escalate" | "comment") => {
    if (!selected) return;
    setActing(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/manager/incidents/${selected.incident_id}/triage`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action, notes }),
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
          Reports from your department — review evidence, resolve, or escalate to the organization admin.
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
              className="w-full text-left glass-card p-5 hover:border-surface-300 dark:hover:border-white/[0.12] transition-all"
            >
              <div className="flex items-start gap-3">
                <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                  inc.severity === "critical" ? "bg-red-500 animate-pulse" :
                  inc.severity === "high" ? "bg-amber-500" :
                  inc.severity === "medium" ? "bg-blue-500" : "bg-surface-400"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h3 className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                      {inc.incident_id}
                    </h3>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[inc.status] || STATUS_STYLES.open}`}>
                      {(inc.status || "open").replace("_", " ")}
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${SEVERITY_STYLES[inc.severity] || SEVERITY_STYLES.low}`}>
                      {inc.severity} priority
                    </span>
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

      {/* Detail drawer */}
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
                  <div className="bg-surface-50 dark:bg-[#141A29] border border-surface-100 dark:border-white/[0.04] p-4 rounded-2xl">
                    <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">Detection reference</span>
                    <p className="text-sm text-surface-800 dark:text-surface-300 font-mono break-all mt-1.5">
                      {detail.incident?.detection_event_ref || "—"}
                    </p>
                    <p className="text-xs text-surface-500 mt-2">Sensitive details (emails, tokens) are automatically redacted before you see them.</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">Evidence</span>
                    <div className="mt-2"><EvidencePanel evidence={detail.incident?.evidence || detail.reports?.[0]?.evidence} /></div>
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
                    <label className="block text-xs font-bold text-surface-500 uppercase tracking-widest mb-1.5">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      maxLength={10000}
                      placeholder="Add context before resolving or escalating..."
                      className="w-full px-3 py-2 bg-surface-50 dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:border-brand-500/50 resize-none"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button disabled={acting} onClick={() => triage("comment")} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-surface-200 dark:border-white/[0.08] text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-white/[0.05] text-xs font-bold transition-all disabled:opacity-50">
                      <MessageSquare className="w-3.5 h-3.5" /> Add Comment
                    </button>
                    <button disabled={acting} onClick={() => triage("resolve")} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-all disabled:opacity-50">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                    </button>
                    <button disabled={acting} onClick={() => triage("escalate")} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 text-xs font-bold transition-all disabled:opacity-50">
                      <ArrowUpCircle className="w-3.5 h-3.5" /> Escalate to Admin
                    </button>
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
