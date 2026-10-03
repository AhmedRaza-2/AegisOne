"use client";
import { ClipboardList, Search, RefreshCw, Download, AlertTriangle, CheckCircle2, Users, Activity } from "lucide-react";
import { useState, useEffect, useMemo, useDeferredValue, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { getApiBaseUrl } from "@/lib/api";
import { toast } from "@/components/ui/toast";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

// Plain-English meaning of the machine action codes written by the backend.
const ACTION_INFO: Record<string, { label: string; tone: string }> = {
  REPORT_SUBMITTED: { label: "Employee submitted a report", tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  INCIDENT_VERIFIED: { label: "Admin verified an incident", tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  INCIDENT_ESCALATE: { label: "Manager escalated an incident", tone: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  INCIDENT_RESOLVE: { label: "Manager resolved an incident", tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  INCIDENT_COMMENT: { label: "Manager commented on an incident", tone: "bg-surface-200 text-surface-700 dark:bg-white/[0.08] dark:text-surface-300" },
  EMPLOYEE_ESCALATED: { label: "Manager escalated an employee", tone: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  MODEL_RETRAINING_TRIGGERED: { label: "Retraining started", tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  MODEL_TRAINED_AND_ACTIVATED: { label: "New model trained and activated", tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  MODEL_ACTIVATED: { label: "Model version activated", tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  MODEL_ROLLBACK_EXECUTED: { label: "Model rolled back", tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  GLOBAL_POLICY_UPDATED: { label: "Global learning policy changed", tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  "user.role_changed": { label: "User role changed", tone: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  "user.deactivated": { label: "User deactivated", tone: "bg-red-500/10 text-red-600 dark:text-red-400" },
  "user.created": { label: "User created", tone: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
  "policy.updated": { label: "Policy updated", tone: "bg-brand-500/10 text-brand-600 dark:text-brand-400" },
};

function describeAction(code: string) {
  if (ACTION_INFO[code]) return ACTION_INFO[code];
  const pretty = (code || "").replace(/[._]/g, " ").toLowerCase();
  return { label: pretty.charAt(0).toUpperCase() + pretty.slice(1), tone: "bg-surface-100 text-surface-700 dark:bg-white/[0.06] dark:text-surface-300" };
}

function parseUtc(ts: string) {
  if (!ts) return new Date(NaN);
  const iso = ts.replace(" ", "T");
  return new Date(/Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");
}

function ago(d: Date) {
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (isNaN(s)) return "";
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

const PAGE = 40;

export default function AuditPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
      const res = await fetch(`${getApiBaseUrl()}/admin/audit`, { headers: { Authorization: `Bearer ${token || ""}` } });
      if (res.ok) setLogs((await res.json()).logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchLogs();
    if (!live) return;
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [user, live, fetchLogs]);

  const modules = useMemo(() => Array.from(new Set(logs.map(l => l.module || "system"))).sort(), [logs]);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return logs.filter(l => {
      if (moduleFilter !== "all" && (l.module || "system") !== moduleFilter) return false;
      if (resultFilter !== "all" && (l.result || "").toLowerCase() !== resultFilter) return false;
      if (!q) return true;
      const info = describeAction(l.action).label.toLowerCase();
      return [l.action, info, l.actor, l.module, l.target].some(v => String(v || "").toLowerCase().includes(q));
    });
  }, [logs, deferredSearch, moduleFilter, resultFilter]);

  const stats = useMemo(() => {
    const dayAgo = Date.now() - 86400000;
    const last24 = logs.filter(l => parseUtc(l.timestamp).getTime() >= dayAgo);
    const actors = new Set(last24.map(l => l.actor));
    const failures = last24.filter(l => (l.result || "").toLowerCase() !== "success").length;
    return { last24: last24.length, actors: actors.size, failures };
  }, [logs]);

  const exportCsv = () => {
    if (!filtered.length) return toast("There are no log entries to export.", "error");
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = "Timestamp (UTC),Actor,Action,Description,Module,Target,Result\n" + filtered.map(l =>
      [l.timestamp, l.actor, l.action, describeAction(l.action).label, l.module, l.target, l.result].map(esc).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `aegisone_audit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (!user) return null;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-6xl mx-auto">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <ClipboardList className="w-6 h-6 text-brand-650 dark:text-brand-400" /> System Audit Trail
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Who did what in your organisation, in plain English. Times are shown in your local time zone.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLive(v => !v)}
            title={live ? "Pause live updates" : "Resume live updates"}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${live ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400" : "bg-surface-100 dark:bg-white/[0.04] border-surface-200 dark:border-white/[0.08] text-surface-500"}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-surface-400"}`} /> {live ? "Live" : "Paused"}
          </button>
          <button onClick={fetchLogs} title="Refresh" className="p-2 bg-surface-100 dark:bg-white/[0.04] text-surface-700 dark:text-surface-300 rounded-xl hover:bg-surface-200 dark:hover:bg-white/[0.08] transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={exportCsv} className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Events in the last 24h", value: stats.last24, icon: Activity, tone: "text-surface-900 dark:text-white" },
          { label: "People active", value: stats.actors, icon: Users, tone: "text-surface-900 dark:text-white" },
          { label: "Failed actions (24h)", value: stats.failures, icon: stats.failures ? AlertTriangle : CheckCircle2, tone: stats.failures ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400" },
        ].map(c => (
          <div key={c.label} className="stat-card flex items-center gap-3 !py-4">
            <c.icon className={`w-5 h-5 ${c.tone}`} />
            <div>
              <div className={`text-xl font-bold ${c.tone}`}>{c.value}</div>
              <div className="text-[11px] text-surface-500">{c.label}</div>
            </div>
          </div>
        ))}
      </motion.div>

      <motion.div variants={fadeUp} className="stat-card space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text" value={search} onChange={(e) => { setSearch(e.target.value); setShown(PAGE); }}
              placeholder="Search by person, what happened, or target…"
              className="w-full bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-xs text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:border-brand-500"
            />
          </div>
          <select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setShown(PAGE); }}
            className="bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-xs text-surface-900 dark:text-white focus:outline-none focus:border-brand-500">
            <option value="all">All areas</option>
            {modules.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
          </select>
          <select value={resultFilter} onChange={e => { setResultFilter(e.target.value); setShown(PAGE); }}
            className="bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-xs text-surface-900 dark:text-white focus:outline-none focus:border-brand-500">
            <option value="all">Any result</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-200 dark:border-white/[0.06] text-surface-500 uppercase tracking-wider">
                <th className="py-3 px-2 font-medium">When</th>
                <th className="py-3 px-2 font-medium">Who</th>
                <th className="py-3 px-2 font-medium">What happened</th>
                <th className="py-3 px-2 font-medium">Area</th>
                <th className="py-3 px-2 font-medium">Details</th>
                <th className="py-3 px-2 font-medium text-right">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-white/[0.04]">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-surface-400">Loading audit records…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-surface-400">No matching audit records.</td></tr>
              ) : (
                filtered.slice(0, shown).map((l, i) => {
                  const d = parseUtc(l.timestamp);
                  const info = describeAction(l.action);
                  const ok = (l.result || "").toLowerCase() === "success";
                  return (
                    <tr key={`${l.timestamp}-${i}`} className="hover:bg-surface-50 dark:hover:bg-white/[0.02] transition-colors align-top">
                      <td className="py-3 px-2 whitespace-nowrap">
                        <div className="text-surface-800 dark:text-surface-200 font-medium">{ago(d)}</div>
                        <div className="text-[10px] text-surface-400">{isNaN(d.getTime()) ? l.timestamp : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</div>
                      </td>
                      <td className="py-3 px-2 font-medium text-surface-900 dark:text-white break-all">{l.actor}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${info.tone}`} title={l.action}>{info.label}</span>
                      </td>
                      <td className="py-3 px-2 text-surface-600 dark:text-surface-400 capitalize">{(l.module || "system").replace(/_/g, " ")}</td>
                      <td className="py-3 px-2 text-surface-700 dark:text-surface-300 max-w-[320px] break-words">{l.target || "—"}</td>
                      <td className="py-3 px-2 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${ok ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>{l.result || "—"}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > shown && (
          <div className="text-center">
            <button onClick={() => setShown(s => s + PAGE)} className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface-100 dark:bg-white/[0.05] hover:bg-surface-200 dark:hover:bg-white/[0.1] text-surface-700 dark:text-surface-200">
              Show {Math.min(PAGE, filtered.length - shown)} more ({filtered.length - shown} remaining)
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
