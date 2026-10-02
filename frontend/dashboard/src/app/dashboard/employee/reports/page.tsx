"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Activity, Clock, ExternalLink } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

function authHeaders() {
  const t = typeof window !== "undefined"
    ? (localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token"))
    : null;
  return { Authorization: `Bearer ${t || ""}` };
}

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  under_review: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  verified: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  rejected: "bg-surface-400/10 text-surface-500 border-surface-400/20",
};

export default function MyReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-brand-400" /> My Reports
        </h1>
        <p className="text-sm text-surface-400 mt-1">
          Track the status of false-positive reports and incidents you've submitted.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Activity className="w-6 h-6 text-brand-400 animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="glass-card p-8 text-center text-surface-400 text-sm">
          You haven't submitted any reports yet. Use "Report a Threat" or the Threat
          Center to flag a detection.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <motion.div
              key={r.report_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-mono text-surface-500">{r.report_id}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLES[r.status] || STATUS_STYLES.submitted}`}>
                  {(r.status || "submitted").replace("_", " ")}
                </span>
              </div>
              <div className="text-sm font-semibold text-white capitalize">
                {(r.report_type || "").replace("_", " ")}
              </div>
              {r.target_ref && (
                <div className="flex items-center gap-1.5 text-xs text-surface-400 break-all">
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" /> {r.target_ref}
                </div>
              )}
              {r.user_notes && (
                <p className="text-xs text-surface-500 leading-relaxed">{r.user_notes}</p>
              )}
              <div className="flex items-center gap-1.5 text-[11px] text-surface-500 mt-1">
                <Clock className="w-3 h-3" />
                {new Date(r.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
