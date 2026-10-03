"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Activity, Clock, ExternalLink, ChevronDown, ShieldAlert } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

function authHeaders() {
  const t = typeof window !== "undefined"
    ? (localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token"))
    : null;
  return { Authorization: `Bearer ${t || ""}` };
}

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  under_review: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  verified: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  rejected: "bg-surface-400/10 text-surface-500 border-surface-400/20",
};

const STATUS_HELP: Record<string, string> = {
  submitted: "Waiting for your manager or security team to review.",
  under_review: "Being reviewed right now.",
  verified: "Reviewed and confirmed by the security team.",
  rejected: "Reviewed — no action needed.",
};

export default function MyReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = () => {
      fetch(`${getApiBaseUrl()}/reports/my-reports`, { headers: authHeaders() })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          setReports(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };
    fetchReports();
    const interval = setInterval(fetchReports, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <ClipboardList className="w-6 h-6 text-brand-600 dark:text-brand-400" /> My Reports
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Track the status of false-positive reports and incidents you&apos;ve submitted, and see the evidence that went with each.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Activity className="w-6 h-6 text-brand-500 animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="stat-card p-8 text-center text-surface-500 text-sm">
          You haven&apos;t submitted any reports yet. Use &quot;Report a Threat&quot; or the Threat Center to flag a detection.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const ev = r.evidence || {};
            const findings: string[] = ev.findings || [];
            const expanded = open === r.report_id;
            return (
              <motion.div key={r.report_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="stat-card !p-0 overflow-hidden">
                <button onClick={() => setOpen(expanded ? null : r.report_id)} className="w-full text-left p-5 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-mono text-surface-500">{r.report_id}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLES[r.status] || STATUS_STYLES.submitted}`}>
                      {(r.status || "submitted").replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-surface-900 dark:text-white capitalize">
                    {(r.report_type || "").replace("_", " ")}
                    {typeof r.risk_score === "number" && <span className="ml-2 text-xs font-medium text-surface-500">{r.risk_score}% risk</span>}
                  </div>
                  {r.target_ref && (
                    <div className="flex items-center gap-1.5 text-xs text-surface-500 break-all">
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" /> {r.target_ref}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-surface-400 mt-1">
                    <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" />
                      {new Date(r.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                    <span className="flex items-center gap-1">{STATUS_HELP[r.status] || ""} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} /></span>
                  </div>
                </button>
                {expanded && (
                  <div className="px-5 pb-5 pt-1 border-t border-surface-100 dark:border-white/[0.05] space-y-3 text-xs">
                    {r.user_notes && (
                      <div>
                        <p className="font-semibold uppercase tracking-wider text-[10px] text-surface-500 mb-1">Your note</p>
                        <p className="text-surface-700 dark:text-surface-300 whitespace-pre-line leading-relaxed">{r.user_notes}</p>
                      </div>
                    )}
                    <div>
                      <p className="font-semibold uppercase tracking-wider text-[10px] text-surface-500 mb-1 flex items-center gap-1.5"><ShieldAlert className="w-3 h-3" /> Evidence sent with this report</p>
                      {findings.length === 0 ? (
                        <p className="text-surface-400">No automated findings were attached to this report.</p>
                      ) : (
                        <ul className="space-y-1 text-surface-700 dark:text-surface-300">
                          {findings.map((f, i) => <li key={i} className="first-letter:uppercase">• {f}</li>)}
                        </ul>
                      )}
                      {(ev.source_model || ev.scan_kind) && (
                        <p className="text-surface-400 mt-2">Source: {ev.scan_kind || "page"} • detected by {ev.source_model || "AegisOne models"}</p>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
