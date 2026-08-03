"use client";
import { ClipboardList, Search, RefreshCw, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useState, useEffect, useMemo, useDeferredValue } from "react";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

const actionColors: Record<string, string> = {
  "user.role_changed": "bg-purple-500/10 text-purple-650 dark:text-purple-400",
  "policy.updated": "bg-brand-500/10 text-brand-650 dark:text-brand-400",
  "incident.resolved": "bg-emerald-500/10 text-emerald-650 dark:text-emerald-450",
  "user.deactivated": "bg-red-500/10 text-red-650 dark:text-red-400",
  "incident.assigned": "bg-amber-500/10 text-amber-650 dark:text-amber-400",
  "user.created": "bg-cyan-500/10 text-cyan-650 dark:text-cyan-400",
};

export default function AuditPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [loading, setLoading] = useState(true);

  const getHeaders = () => {
    const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    return { Authorization: `Bearer ${token || ""}` };
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/admin/audit", { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLogs();
      // Real-time polling every 15 seconds
      const interval = setInterval(fetchLogs, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const filteredLogs = useMemo(() => {
    if (!deferredSearch) return logs;
    const q = deferredSearch.toLowerCase();
    return logs.filter(
      (l) =>
        l.action?.toLowerCase().includes(q) ||
        l.actor?.toLowerCase().includes(q) ||
        l.module?.toLowerCase().includes(q) ||
        l.target?.toLowerCase().includes(q)
    );
  }, [logs, deferredSearch]);

  if (!user) return null;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-6xl mx-auto">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <ClipboardList className="w-6 h-6 text-brand-650 dark:text-brand-400" /> System Audit Trail
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Immutable operational and administrative activity logs for your organization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter logs by actor, action..."
              className="w-full bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-xs text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Live</span>
          </div>
          <button
            onClick={fetchLogs}
            className="p-2 bg-surface-100 dark:bg-white/[0.04] text-surface-700 dark:text-surface-300 rounded-xl hover:bg-surface-200 transition-colors shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </motion.div>

      {/* Audit Logs Table */}
      <motion.div variants={fadeUp} className="stat-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-200 dark:border-white/[0.06] text-surface-500 uppercase tracking-wider">
                <th className="py-3 px-2">Timestamp</th>
                <th className="py-3 px-2">Actor</th>
                <th className="py-3 px-2">Action</th>
                <th className="py-3 px-2">Module</th>
                <th className="py-3 px-2">Target</th>
                <th className="py-3 px-2 text-right">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-surface-400">Loading audit records...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-surface-400">No audit records found</td>
                </tr>
              ) : (
                filteredLogs.map((l, i) => (
                  <tr key={i} className="hover:bg-surface-50 dark:hover:bg-white/[0.01] transition-colors">
                    <td className="py-3 px-2 font-mono text-surface-500">{l.timestamp}</td>
                    <td className="py-3 px-2 font-medium text-surface-900 dark:text-white">{l.actor}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] ${actionColors[l.action] || "bg-surface-100 text-surface-700 dark:bg-white/[0.06] dark:text-surface-300"}`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-surface-600 dark:text-surface-400">{l.module || "System"}</td>
                    <td className="py-3 px-2 font-medium text-surface-800 dark:text-surface-200">{l.target || "N/A"}</td>
                    <td className="py-3 px-2 text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 capitalize">
                        {l.result}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}

