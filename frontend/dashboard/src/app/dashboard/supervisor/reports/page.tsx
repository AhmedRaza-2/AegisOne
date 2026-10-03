"use client";
import { useAuth } from "@/lib/auth-context";
import {
  FileBarChart, Download, RefreshCw, ShieldAlert, Users, Activity, AlertTriangle,
  ShieldCheck, TrendingUp, Inbox,
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect, useMemo, useCallback } from "react";
import { getApiBaseUrl } from "@/lib/api";
import { toast } from "@/components/ui/toast";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

type Tab = "summary" | "employees" | "threats" | "incidents";

const RANGES = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const TABS: { id: Tab; label: string; hint: string; icon: any }[] = [
  { id: "summary", label: "Security Summary", hint: "Scans, threats and activity trend", icon: Activity },
  { id: "employees", label: "Employee Risk", hint: "Who is exposed and why", icon: Users },
  { id: "threats", label: "Threat Analysis", hint: "What was flagged and the reason", icon: ShieldAlert },
  { id: "incidents", label: "Incidents", hint: "Reports raised by your team", icon: AlertTriangle },
];

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function Kpi({ label, value, tone, sub }: { label: string; value: string | number; tone?: string; sub?: string }) {
  return (
    <div className="p-4 bg-surface-50 dark:bg-white/[0.02] rounded-xl border border-surface-100 dark:border-white/[0.04]">
      <p className="text-[11px] uppercase tracking-wider font-semibold text-surface-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${tone || "text-surface-900 dark:text-white"}`}>{value}</p>
      {sub && <p className="text-[11px] text-surface-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("summary");
  const [timeRange, setTimeRange] = useState("7d");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [allTime, setAllTime] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [flagged, setFlagged] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const headers = authHeaders();
    const base = getApiBaseUrl();
    const get = (path: string) => fetch(`${base}${path}`, { headers }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    try {
      const [s, all, u, inc, hr] = await Promise.all([
        get(`/admin/stats?time_range=${timeRange}`),
        timeRange === "all" ? Promise.resolve(null) : get(`/admin/stats?time_range=all`),
        get(`/admin/users?range=${timeRange}`),
        get(`/manager/incidents?limit=100`),
        get(`/manager/incidents/high-risk-employees`),
      ]);
      setStats(s);
      setAllTime(timeRange === "all" ? s : all);
      setUsersList(u?.users || []);
      setIncidents(Array.isArray(inc) ? inc : []);
      setFlagged(hr?.employees || []);
    } catch {
      toast("Could not load report data. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const rangeLabel = RANGES.find(r => r.value === timeRange)?.label || timeRange;
  const windowEmpty = !loading && stats && (stats.total_scans || 0) === 0;
  const hasOlderData = (allTime?.total_scans || 0) > 0;

  const trend = useMemo(() => (stats?.daily_trend || []) as { date: string; scans: number; threats: number }[], [stats]);
  const trendMax = Math.max(1, ...trend.map(t => t.scans || 0));

  const employees = useMemo(
    () => [...usersList].sort((a, b) => (a.security_score ?? 50) - (b.security_score ?? 50)),
    [usersList]
  );
  const avgScore = employees.length
    ? Math.round(employees.reduce((acc, e) => acc + (e.security_score ?? 50), 0) / employees.length)
    : 50;

  const incidentsByStatus = useMemo(() => {
    const m: Record<string, number> = {};
    incidents.forEach(i => { m[i.status] = (m[i.status] || 0) + 1; });
    return m;
  }, [incidents]);

  const downloadCSV = () => {
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    let csv = "";
    let fileName = "";
    if (tab === "summary") {
      fileName = `Security_Summary_${timeRange}.csv`;
      csv = "Metric,Value\n" + [
        ["Department", user?.department || ""], ["Time range", rangeLabel],
        ["Employees", stats?.total_users || 0], ["Total scans", stats?.total_scans || 0],
        ["Threats detected", stats?.threats_detected || 0], ["Active devices", stats?.active_devices || 0],
        ["Credential events", stats?.credential_events_total || 0], ["Download events", stats?.download_events_total || 0],
        ["Average security score", avgScore],
      ].map(r => r.map(esc).join(",")).join("\n");
    } else if (tab === "employees") {
      fileName = `Employee_Risk_${timeRange}.csv`;
      csv = "Name,Email,Role,Status,Scans,Threats,Security score\n" + employees.map(u =>
        [u.full_name, u.email, u.role, u.account_status || "active", u.total_scans || 0, u.threats || 0, u.security_score ?? 50].map(esc).join(",")
      ).join("\n");
    } else if (tab === "threats") {
      fileName = `Flagged_Events_${timeRange}.csv`;
      csv = "Employee,Type,Target,Risk %,Reason,When\n" + flagged.flatMap(e => e.events.map((ev: any) =>
        [e.name, ev.kind, ev.target, ev.risk_score, ev.finding, ev.when].map(esc).join(","))).join("\n");
    } else {
      fileName = `Incidents_${timeRange}.csv`;
      csv = "Incident,Status,Severity,Type,Target,Risk %,Reports,Created\n" + incidents.map(i =>
        [i.incident_id, i.status, i.severity, i.report_type, i.detection_event_ref, i.risk_score ?? "", i.reports_count, i.created_at].map(esc).join(",")
      ).join("\n");
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(`Downloaded ${fileName}`);
  };

  if (!user) return null;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-6xl mx-auto">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <FileBarChart className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Department Reports
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Security analytics for {user.department || "your"} department — {rangeLabel.toLowerCase()}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.08] rounded-xl text-xs font-medium text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
          >
            {RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button onClick={fetchData} title="Refresh" className="p-2 bg-surface-100 dark:bg-white/[0.04] text-surface-700 dark:text-surface-300 rounded-xl hover:bg-surface-200 dark:hover:bg-white/[0.08] transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={downloadCSV} className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors shadow-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-left p-3.5 rounded-xl border transition-all ${tab === t.id
              ? "bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300 dark:border-brand-500/50"
              : "border-surface-200 dark:border-white/[0.06] text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-white/[0.02]"}`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold"><t.icon className="w-4 h-4" /> {t.label}</div>
            <p className="text-[11px] text-surface-500 mt-1 font-normal">{t.hint}</p>
          </button>
        ))}
      </motion.div>

      {windowEmpty && (
        <motion.div variants={fadeUp} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 text-sm text-amber-800 dark:text-amber-300">
          <span className="flex items-center gap-2"><Inbox className="w-4 h-4 shrink-0" />
            No scans were recorded in {rangeLabel.toLowerCase()}.{hasOlderData ? ` Your department has ${allTime.total_scans} scans in total.` : " Scans appear here once employees browse with the extension installed."}
          </span>
          {hasOlderData && timeRange !== "all" && (
            <button onClick={() => setTimeRange("all")} className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500">Show all time</button>
          )}
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="stat-card space-y-5">
        {loading && !stats ? (
          <div className="py-12 text-center text-surface-400 text-sm">Loading report…</div>
        ) : tab === "summary" ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Kpi label="Employees" value={stats?.total_users ?? 0} />
              <Kpi label="Total scans" value={stats?.total_scans ?? 0} />
              <Kpi label="Threats" value={stats?.threats_detected ?? 0} tone="text-red-600 dark:text-red-400" />
              <Kpi label="Active devices" value={stats?.active_devices ?? 0} tone="text-emerald-600 dark:text-emerald-400" />
              <Kpi label="Avg security score" value={avgScore} tone={scoreTone(avgScore)} sub="50 = no history yet" />
              <Kpi label="Open incidents" value={(incidentsByStatus.open || 0) + (incidentsByStatus.investigating || 0)} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-brand-500" /> Scan activity
              </h3>
              {trend.length === 0 || trend.every(t => !t.scans) ? (
                <p className="text-xs text-surface-400 py-6 text-center">No activity in this window.</p>
              ) : (
                <div className="flex items-end gap-2 h-36">
                  {trend.map((t, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${t.date}: ${t.scans} scans, ${t.threats} threats`}>
                      <div className="w-full flex flex-col justify-end h-28 rounded-md bg-surface-100 dark:bg-white/[0.04] overflow-hidden">
                        <div className="w-full bg-red-500/80" style={{ height: `${((t.threats || 0) / trendMax) * 100}%` }} />
                        <div className="w-full bg-brand-500/70" style={{ height: `${(Math.max(0, (t.scans || 0) - (t.threats || 0)) / trendMax) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-surface-500 truncate">{t.date}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-4 mt-2 text-[11px] text-surface-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-500/70" /> Safe</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/80" /> Threats</span>
              </div>
            </div>
          </>
        ) : tab === "employees" ? (
          employees.length === 0 ? (
            <p className="py-8 text-center text-surface-400 text-sm">No employees found in your department.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-white/[0.06] text-surface-500">
                    <th className="py-2 font-medium">Employee</th><th className="py-2 font-medium">Scans</th>
                    <th className="py-2 font-medium">Threats</th><th className="py-2 font-medium w-48">Security score</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-white/[0.04]">
                  {employees.map(u => {
                    const sc = u.security_score ?? 50;
                    return (
                      <tr key={u.id}>
                        <td className="py-2.5"><div className="font-medium text-surface-900 dark:text-white">{u.full_name}</div><div className="text-surface-500">{u.email}</div></td>
                        <td className="py-2.5 text-surface-700 dark:text-surface-300">{u.total_scans || 0}</td>
                        <td className="py-2.5 text-surface-700 dark:text-surface-300">{u.threats || 0}</td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-surface-100 dark:bg-white/[0.06] overflow-hidden">
                              <div className={`h-full rounded-full ${sc >= 80 ? "bg-emerald-500" : sc >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${sc}%` }} />
                            </div>
                            <span className={`font-semibold w-8 text-right ${scoreTone(sc)}`}>{sc}</span>
                          </div>
                        </td>
                        <td className="py-2.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 capitalize">{u.account_status || "active"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : tab === "threats" ? (
          flagged.length === 0 ? (
            <p className="py-8 text-center text-surface-400 text-sm flex flex-col items-center gap-2"><ShieldCheck className="w-6 h-6 text-emerald-500" /> No flagged activity from your department.</p>
          ) : (
            <div className="space-y-4">
              {flagged.map(e => (
                <div key={e.id} className="rounded-xl border border-surface-200 dark:border-white/[0.06] p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-surface-900 dark:text-white">{e.name}</h4>
                    <span className="text-[11px] text-surface-500">{e.flagged_count} flagged • {e.blocked_count} blocked</span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {e.events.map((ev: any, i: number) => (
                      <div key={i} className="text-xs flex gap-3 items-start">
                        <span className="shrink-0 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-semibold uppercase text-[10px]">{ev.kind} {ev.risk_score}%</span>
                        <div className="min-w-0">
                          <div className="truncate text-surface-500" title={ev.target}>{ev.target}</div>
                          <div className="text-surface-800 dark:text-surface-200 first-letter:uppercase">{ev.finding}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : incidents.length === 0 ? (
          <p className="py-8 text-center text-surface-400 text-sm">No incidents have been raised by your team yet.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(incidentsByStatus).map(([s, n]) => (
                <span key={s} className="px-3 py-1 rounded-full bg-surface-100 dark:bg-white/[0.05] text-xs font-medium text-surface-700 dark:text-surface-300 capitalize">{s.replace("_", " ")}: {n}</span>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead><tr className="border-b border-surface-200 dark:border-white/[0.06] text-surface-500">
                  <th className="py-2 font-medium">Incident</th><th className="py-2 font-medium">Target</th><th className="py-2 font-medium">Severity</th><th className="py-2 font-medium">Status</th><th className="py-2 font-medium">Created</th>
                </tr></thead>
                <tbody className="divide-y divide-surface-100 dark:divide-white/[0.04]">
                  {incidents.slice(0, 50).map(i => (
                    <tr key={i.id}>
                      <td className="py-2.5 font-mono text-surface-900 dark:text-white">{i.incident_id}</td>
                      <td className="py-2.5 max-w-[260px] truncate text-surface-500" title={i.detection_event_ref}>{i.detection_event_ref}</td>
                      <td className="py-2.5 capitalize text-surface-700 dark:text-surface-300">{i.severity}</td>
                      <td className="py-2.5 capitalize text-surface-700 dark:text-surface-300">{i.status.replace("_", " ")}</td>
                      <td className="py-2.5 text-surface-500">{new Date(i.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
