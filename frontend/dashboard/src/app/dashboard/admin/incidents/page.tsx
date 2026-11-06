"use client";
import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Clock, CheckCircle2, Ban, ShieldQuestion, X, Activity, ArrowUpCircle, Download, Printer, Route, ListChecks, Users, Globe, Timer, CheckSquare, Square } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";
import { EvidencePanel } from "@/components/ui/EvidencePanel";
import { toast } from "@/components/ui/toast";

function authHeaders() {
  const t = typeof window !== "undefined"
    ? (localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token"))
    : null;
  return { Authorization: `Bearer ${t || ""}`, "Content-Type": "application/json" };
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  investigating: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  escalated: "bg-brand-500/10 text-brand-600 dark:text-brand-400",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  false_positive: "bg-surface-200 text-surface-600 dark:bg-surface-800 dark:text-surface-400",
};

const ACTION_LABELS: Record<string, string> = {
  block_domain: "Block domain",
  allow_domain: "Allow domain",
  notify_affected: "Notify people",
  revoke_sessions: "Sign them out",
  reset_credentials: "Sign out + reset passwords",
  assign_training: "Assign training",
  warn_organization: "Warn everyone",
};

// actions that change other people's accounts or reach the whole organization ask first
const CONFIRM: Record<string, string> = {
  revoke_sessions: "Sign the affected people out of every AegisOne session now?",
  reset_credentials: "Sign the affected people out and e-mail each of them a code to set a new password?",
  warn_organization: "Send a security warning to everyone in the organization?",
};

const fmtMin = (m: number | null | undefined) =>
  m === null || m === undefined ? "—" : m < 120 ? `${Math.round(m)} min` : m < 2880 ? `${(m / 60).toFixed(1)} h` : `${(m / 1440).toFixed(1)} d`;

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
  const [tab, setTab] = useState<"review" | "trace" | "playbook">("review");
  const [trace, setTrace] = useState<any>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);

  const fetchMetrics = useCallback(() => {
    fetch(`${getApiBaseUrl()}/admin/incidents/metrics?days=30`, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((m) => m && setMetrics(m))
      .catch(() => {});
  }, []);

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
    fetchMetrics();
    const interval = setInterval(() => { fetchIncidents(); fetchMetrics(); }, 10000);
    return () => clearInterval(interval);
  }, [fetchIncidents, fetchMetrics]);

  const openDetail = async (inc: any) => {
    setSelected(inc);
    setDetail(null);
    setTrace(null);
    setTab("review");
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
        const out = await res.json().catch(() => ({}));
        toast(out.allowlisted_domain
          ? `Decision recorded. ${out.allowlisted_domain} is now allowed for your whole organization.`
          : `Decision recorded for ${selected.incident_id}. Eligible decisions were added to the retraining samples.`);
        setSelected(null);
        fetchIncidents();
      } else {
        toast("Could not record the decision. Please try again.", "error");
      }
    } finally {
      setActing(false);
    }
  };

  const loadTrace = async () => {
    if (!selected || trace) return;
    setTraceLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/incidents/${selected.incident_id}/backtrace`, { headers: authHeaders() });
      if (res.ok) setTrace(await res.json());
      else toast("Could not load the full trace.", "error");
    } finally {
      setTraceLoading(false);
    }
  };

  const switchTab = (t: "review" | "trace" | "playbook") => {
    setTab(t);
    if (t !== "review") loadTrace();
  };

  const downloadBlob = async (path: string, filename: string) => {
    const res = await fetch(`${getApiBaseUrl()}${path}`, { headers: authHeaders() });
    if (!res.ok) { toast("Export failed. Please try again.", "error"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const openPrintableReport = async () => {
    if (!selected) return;
    const res = await fetch(`${getApiBaseUrl()}/admin/incidents/${selected.incident_id}/report`, { headers: authHeaders() });
    if (!res.ok) { toast("Could not build the report.", "error"); return; }
    const blob = new Blob([await res.text()], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) toast("Allow pop-ups to open the report, then try again.", "error");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const traceRedirects = async () => {
    if (!selected) return;
    setBusyAction("trace");
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/incidents/${selected.incident_id}/trace-redirects`, { method: "POST", headers: authHeaders() });
      if (res.ok) {
        const rt = await res.json();
        setTrace((t: any) => ({ ...t, redirect_trace: rt }));
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.detail || "Could not trace this link.", "error");
      }
    } finally { setBusyAction(null); }
  };

  const reloadTrace = async () => {
    if (!selected) return;
    const res = await fetch(`${getApiBaseUrl()}/admin/incidents/${selected.incident_id}/backtrace`, { headers: authHeaders() });
    if (res.ok) setTrace(await res.json());
  };

  const runAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!selected) return;
    if (CONFIRM[action] && !extra.scope && !window.confirm(CONFIRM[action])) return;
    setBusyAction(action);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/incidents/${selected.incident_id}/actions`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ action, ...extra }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok) {
        const msg: Record<string, string> = {
          notify_affected: `${out.notified} people notified.`,
          warn_organization: `Security warning sent to ${out.notified} people.`,
          block_domain: `${out.domain} is now blocked for your organization.`,
          allow_domain: `${out.domain} is now allowed for your organization.`,
          revoke_sessions: `${out.signed_out} people were signed out of every session.`,
          reset_credentials: `${out.signed_out} people signed out; ${out.reset_codes_sent} password reset codes e-mailed.`,
          assign_training: `Training assigned to ${out.assigned} people${out.already_assigned ? ` (${out.already_assigned} already had it)` : ""}.`,
        };
        toast(msg[action] || "Done.");
        await reloadTrace();
        fetchMetrics();
      } else if (res.status === 400 && (action === "revoke_sessions" || action === "reset_credentials") && !extra.scope
                 && window.confirm(`${out.detail}\n\nApply it to everyone who opened it instead?`)) {
        setBusyAction(null);
        return runAction(action, { scope: "exposed" });
      } else {
        toast(out.detail || "Action failed.", "error");
      }
    } finally { setBusyAction(null); }
  };

  const toggleStep = async (stepId: string, done: boolean) => {
    if (!selected) return;
    setBusyAction(`step:${stepId}`);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/incidents/${selected.incident_id}/playbook/steps/${stepId}`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ done }),
      });
      if (res.ok) {
        const out = await res.json();
        setTrace((t: any) => ({ ...t, playbook: out.playbook, response: { ...(t?.response || {}), sla: out.sla,
          time_to_acknowledge_min: out.time_to_acknowledge_min, time_to_contain_min: out.time_to_contain_min, time_to_resolve_min: out.time_to_resolve_min } }));
        fetchMetrics();
      } else {
        toast("Could not update this step.", "error");
      }
    } finally { setBusyAction(null); }
  };

  const person = (p: any) => p ? `${p.name || p.email}${p.department ? " · " + p.department : ""}` : "Unknown";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <AlertTriangle className="w-6 h-6 text-amber-500" /> Incidents Queue
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Organization-wide reports and manager escalations — verifying a decision here feeds the retraining pipeline.
        </p>
      </div>
      <button
        onClick={() => downloadBlob("/admin/incidents/export?days=365", `aegisone-incidents-${new Date().toISOString().slice(0, 10)}.csv`)}
        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-surface-200 dark:border-white/[0.1] text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-white/[0.05] transition-all"
      >
        <Download className="w-4 h-4" /> Export CSV
      </button>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            ["Open now", Object.values(metrics.open_by_severity || {}).reduce((a: number, b: any) => a + Number(b), 0),
              Object.entries(metrics.open_by_severity || {}).map(([k, v]) => `${v} ${k}`).join(" · ") || "nothing open"],
            ["Response SLA met", metrics.sla?.compliance == null ? "—" : `${Math.round(metrics.sla.compliance * 100)}%`,
              metrics.sla?.breaching_now ? `${metrics.sla.breaching_now} waiting past target` : "none overdue"],
            ["Time to first response", fmtMin(metrics.time_to_acknowledge_min?.median), "median, last 30 days"],
            ["Time to contain", fmtMin(metrics.time_to_contain_min?.median), "median, last 30 days"],
            ["Time to resolve", fmtMin(metrics.time_to_resolve_min?.median), "median, last 30 days"],
          ].map(([label, value, sub]: any) => (
            <div key={label} className="glass-card p-4">
              <div className="text-[10px] font-bold text-surface-500 uppercase tracking-widest flex items-center gap-1"><Timer className="w-3 h-3" /> {label}</div>
              <div className={`text-2xl font-bold mt-1 ${label === "Response SLA met" && metrics.sla?.breaching_now ? "text-red-600 dark:text-red-400" : "text-surface-900 dark:text-white"}`}>{value}</div>
              <div className="text-[11px] text-surface-500 mt-0.5 truncate">{sub}</div>
            </div>
          ))}
        </div>
      )}

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
              className={`w-full text-left glass-card p-5 hover:border-surface-300 dark:hover:border-white/[0.12] transition-all ${inc.status === "escalated" ? "ring-1 ring-brand-500/30" : ""}`}
            >
              <div className="flex items-start gap-3">
                {inc.status === "escalated" && <ArrowUpCircle className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />}
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
                    {inc.sla?.breached && !inc.sla?.acknowledged_at && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                        No response · past {inc.sla.target_minutes} min target
                      </span>
                    )}
                    {!inc.sla?.acknowledged_at && !inc.sla?.breached && inc.sla?.due_at && ["open", "escalated"].includes(inc.status) && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        Respond by {new Date(inc.sla.due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-surface-600 dark:text-surface-300 capitalize">
                    {(inc.report_type || "").replace("_", " ")} · Risk {inc.risk_score ?? "—"}
                    {inc.evidence?.scan_kind && <span className="ml-2 text-[11px] normal-case text-surface-400">source: {inc.evidence.scan_kind}</span>}
                  </p>
                  {inc.evidence?.findings?.[0] && (
                    <p className="mt-1 text-xs text-surface-500 line-clamp-2 first-letter:uppercase">{inc.evidence.findings[0]}</p>
                  )}
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
          <div className="bg-white dark:bg-[#0B101E] border border-surface-200 dark:border-white/[0.08] rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden">
            <div className="p-6 sm:p-8 max-h-[80vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl font-extrabold text-surface-900 dark:text-white">{selected.incident_id}</h3>
                  <p className="text-xs text-surface-500 mt-1 capitalize">{(selected.report_type || "").replace("_", " ")} · {selected.severity} severity</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={openPrintableReport} title="Open a printable end-to-end report" className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-surface-100 dark:bg-white/[0.05] text-xs font-semibold text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white transition-all">
                    <Printer className="w-3.5 h-3.5" /> Report
                  </button>
                  <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-100 dark:bg-white/[0.05] text-surface-500 hover:text-surface-900 dark:hover:text-white transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex gap-1 mb-5 border-b border-surface-100 dark:border-white/[0.06]">
                {([["review", "Review & decide"], ["trace", "Full trace"], ["playbook", "Response playbook"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => switchTab(k)}
                    className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-all ${tab === k ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-surface-500 hover:text-surface-800 dark:hover:text-white"}`}>
                    {label}
                  </button>
                ))}
              </div>

              {tab === "trace" && (
                traceLoading || !trace ? (
                  <div className="flex items-center justify-center py-10"><Activity className="w-5 h-5 text-brand-400 animate-spin" /></div>
                ) : (
                  <div className="space-y-5 text-sm">
                    <section>
                      <h4 className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-2">What was detected and why</h4>
                      <div className="rounded-2xl border border-surface-100 dark:border-white/[0.05] p-4 space-y-2">
                        <p className="font-mono text-xs break-all text-surface-700 dark:text-surface-300">{trace.detection.target || "—"}</p>
                        <p className="text-xs text-surface-500">
                          Risk <b>{trace.detection.risk_score ?? "—"}%</b> · {trace.detection.predicted_class || "no model verdict"} · decision <b>{trace.detection.decision || "—"}</b>
                          {trace.detection.model_version ? ` · model ${trace.detection.model_version}` : ""}
                        </p>
                        <ul className="list-disc pl-5 text-xs text-surface-700 dark:text-surface-300 space-y-1">
                          {(trace.detection.why || []).length ? trace.detection.why.map((w: string, i: number) => <li key={i} className="first-letter:uppercase">{w}</li>) : <li className="text-surface-400">No stored findings for this incident.</li>}
                        </ul>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-1"><Globe className="w-3 h-3" /> Domain</h4>
                      <p className="text-xs text-surface-700 dark:text-surface-300">
                        {trace.detection.domain || "—"} · registered {trace.domain_info?.registered_on || "unknown"}
                        {trace.domain_info?.age_label && trace.domain_info.age_label !== "Unknown" ? ` (${trace.domain_info.age_label} ago)` : ""}
                        <span className="text-surface-400"> · source: registry (RDAP)</span>
                      </p>
                    </section>

                    <section>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-bold text-surface-500 uppercase tracking-widest flex items-center gap-1"><Route className="w-3 h-3" /> Redirect chain</h4>
                        <button onClick={traceRedirects} disabled={busyAction === "trace"} className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50">
                          {busyAction === "trace" ? "Tracing…" : trace.redirect_trace ? "Trace again" : "Trace now"}
                        </button>
                      </div>
                      {trace.redirect_trace?.chain?.length ? (
                        <div className="rounded-2xl border border-surface-100 dark:border-white/[0.05] p-4">
                          <ol className="list-decimal pl-5 space-y-1 text-xs font-mono break-all text-surface-700 dark:text-surface-300">
                            {trace.redirect_trace.chain.map((h: any, i: number) => (
                              <li key={i}>{h.url} <span className="text-surface-400">→ {h.status ?? "not followed"}{h.note ? ` (${h.note})` : ""}</span></li>
                            ))}
                          </ol>
                          {trace.redirect_trace.flags?.length > 0 && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{trace.redirect_trace.flags.join(" · ")}</p>}
                        </div>
                      ) : <p className="text-xs text-surface-400">Not traced yet. The server follows the link safely (no private addresses, no page downloads).</p>}
                    </section>

                    <section>
                      <h4 className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-2">Who reported it ({trace.reporters.length})</h4>
                      <div className="space-y-2">
                        {trace.reporters.map((r: any) => (
                          <div key={r.report_id} className="rounded-xl border border-surface-100 dark:border-white/[0.05] p-3 text-xs">
                            <div className="flex justify-between gap-2"><b>{person(r.person)}</b><span className="text-surface-400">{r.at ? new Date(r.at).toLocaleString() : ""}</span></div>
                            <div className="text-surface-500 capitalize">{r.type.replace("_", " ")} · {r.status}</div>
                            {r.note && <p className="mt-1 text-surface-700 dark:text-surface-300">{r.note}</p>}
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h4 className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-1"><Users className="w-3 h-3" /> Exposure inside the organization</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        {[["Times seen", trace.exposure.scans], ["People", trace.exposure.users], ["Blocked", trace.exposure.blocked], ["Credentials entered", trace.exposure.credential_events - trace.exposure.credentials_blocked]].map(([k, v]: any) => (
                          <div key={k} className="rounded-xl bg-surface-50 dark:bg-[#0F2038] p-3"><div className="text-lg font-bold text-surface-900 dark:text-white">{v}</div><div className="text-[10px] text-surface-500">{k}</div></div>
                        ))}
                      </div>
                      {trace.exposure.credential_people?.length > 0 && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">Reset passwords for: {trace.exposure.credential_people.map((p: any) => p.name).join(", ")}</p>
                      )}
                      {trace.exposure.people?.length > 0 && (
                        <p className="mt-2 text-xs text-surface-500">Seen by: {trace.exposure.people.slice(0, 10).map((p: any) => p.name).join(", ")}{trace.exposure.people.length > 10 ? "…" : ""}</p>
                      )}
                    </section>

                    <section>
                      <h4 className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-2">Timeline</h4>
                      <ol className="space-y-2 border-l border-surface-200 dark:border-white/[0.08] pl-4">
                        {trace.timeline.map((t: any, i: number) => (
                          <li key={i} className="text-xs">
                            <div className="text-surface-400">{t.at ? new Date(t.at).toLocaleString() : ""}</div>
                            <div className="font-semibold text-surface-800 dark:text-surface-200">{t.event}{t.actor ? ` — ${person(t.actor)}` : ""}</div>
                            {t.detail && <div className="text-surface-600 dark:text-surface-400">{t.detail}</div>}
                          </li>
                        ))}
                      </ol>
                    </section>
                  </div>
                )
              )}

              {tab === "playbook" && (
                traceLoading || !trace ? (
                  <div className="flex items-center justify-center py-10"><Activity className="w-5 h-5 text-brand-400 animate-spin" /></div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-brand-500/5 border border-brand-500/20 p-4">
                      <h4 className="text-sm font-bold text-surface-900 dark:text-white flex items-center gap-2"><ListChecks className="w-4 h-4 text-brand-500" /> {trace.playbook.title}</h4>
                      <p className="text-xs text-surface-600 dark:text-surface-300 mt-1">{trace.playbook.summary}</p>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-surface-200 dark:bg-white/[0.06] overflow-hidden">
                          <div className="h-full bg-brand-500 transition-all" style={{ width: `${trace.playbook.steps_total ? (100 * trace.playbook.steps_done) / trace.playbook.steps_total : 0}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-surface-700 dark:text-surface-200 shrink-0">{trace.playbook.steps_done}/{trace.playbook.steps_total} steps</span>
                      </div>
                      {trace.response && (
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          {[
                            ["Response SLA", trace.response.sla?.met ? "Met" : trace.response.sla?.breached ? "Missed" : `${trace.response.sla?.target_minutes ?? "—"} min`],
                            ["First response", fmtMin(trace.response.time_to_acknowledge_min)],
                            ["Contained", fmtMin(trace.response.time_to_contain_min)],
                            ["Resolved", fmtMin(trace.response.time_to_resolve_min)],
                          ].map(([k, v]) => (
                            <div key={k} className="rounded-xl bg-white/60 dark:bg-[#0F2038] p-2">
                              <div className={`text-sm font-bold ${v === "Missed" ? "text-red-600 dark:text-red-400" : v === "Met" ? "text-emerald-600 dark:text-emerald-400" : "text-surface-900 dark:text-white"}`}>{v}</div>
                              <div className="text-[10px] text-surface-500">{k}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {trace.playbook.phases.map((ph: any) => (
                      <section key={ph.phase}>
                        <h4 className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                          {ph.phase} {ph.complete && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                        </h4>
                        <ul className="space-y-2">
                          {ph.steps.map((st: any) => (
                            <li key={st.id} className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-xs ${st.done ? "border-emerald-500/20 bg-emerald-500/5" : "border-surface-100 dark:border-white/[0.05]"}`}>
                              <button onClick={() => toggleStep(st.id, !st.done)} disabled={busyAction === `step:${st.id}`}
                                className="flex items-start gap-2 text-left text-surface-700 dark:text-surface-300 disabled:opacity-50" title={st.done ? "Mark as not done" : "Mark as done"}>
                                {st.done ? <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" /> : <Square className="w-4 h-4 text-surface-400 shrink-0" />}
                                <span>
                                  <span className={st.done ? "line-through decoration-surface-400" : ""}>{st.text}</span>
                                  {st.done && st.done_by && (
                                    <span className="block text-[11px] text-surface-500 mt-0.5">{st.done_by} · {st.done_at ? new Date(st.done_at).toLocaleString() : ""}{st.note ? ` · ${st.note}` : ""}</span>
                                  )}
                                </span>
                              </button>
                              {st.action && (
                                <button disabled={busyAction === st.action} onClick={() => runAction(st.action)}
                                  className="shrink-0 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold disabled:opacity-50">
                                  {busyAction === st.action ? "Working…" : ACTION_LABELS[st.action] || st.action}
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                )
              )}

              {tab === "review" && (!detail ? (
                <div className="flex items-center justify-center py-10"><Activity className="w-5 h-5 text-brand-400 animate-spin" /></div>
              ) : (
                <div className="space-y-4">
                  {detail.incident?.manager_notes && (
                    <div className="bg-brand-500/5 border border-brand-500/20 p-4 rounded-2xl">
                      <span className="text-[10px] font-bold text-brand-500 uppercase tracking-widest">Manager Notes</span>
                      <p className="text-sm text-surface-700 dark:text-surface-300 mt-1.5">{detail.incident.manager_notes}</p>
                    </div>
                  )}

                  <div className="bg-surface-50 dark:bg-[#0F2038] border border-surface-100 dark:border-white/[0.04] p-4 rounded-2xl">
                    <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">Detection reference</span>
                    <p className="text-sm text-surface-800 dark:text-surface-300 font-mono break-all mt-1.5">
                      {detail.incident?.detection_event_ref || "—"}
                    </p>
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
                    <label className="block text-xs font-bold text-surface-500 uppercase tracking-widest mb-1.5">Admin Notes</label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={3}
                      maxLength={10000}
                      placeholder="Reasoning for this decision..."
                      className="w-full px-3 py-2 bg-surface-50 dark:bg-[#0F2038] border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:border-brand-500/50 resize-none"
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
                    <p className="text-[11px] text-surface-500 mt-2">Confirmed Phishing / False Positive / False Negative / Benign create a deduplicated training sample for the local retraining pipeline. A False Positive also allows the domain for your whole organization.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
