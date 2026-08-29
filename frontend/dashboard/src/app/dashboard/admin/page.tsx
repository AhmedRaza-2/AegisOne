"use client";
import { Shield, Users, AlertTriangle, Activity, BarChart3, TrendingUp, Cpu, Clock, Globe, Mail, FileText, Image, Building2, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect } from "react";
import Link from "next/link";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
};
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function AdminDashboard() {
  const { user, theme, fetchWithCache, invalidateCache } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isGlobalAdmin = user?.role === "global_admin" || user?.role === "super_admin";

  const [departments, setDepartments] = useState<any[]>([]);

  const fetchStatsData = async (isManual = false) => {
    if (!user) return;
    if (isManual) {
      setRefreshing(true);
      invalidateCache("http://localhost:8000/admin/");
    }
    try {
      const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
      const headers = { Authorization: `Bearer ${token || ""}` };
      const [data, dData] = await Promise.all([
        fetchWithCache("http://localhost:8000/admin/stats", { headers }, isManual ? 0 : 15000),
        fetchWithCache("http://localhost:8000/admin/departments", { headers }, isManual ? 0 : 15000)
      ]);
      if (data) setStats(data);
      if (dData) setDepartments(dData.departments || []);
    } catch (e) {
      console.error("Failed to fetch stats", e);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchStatsData();
    }
  }, [user]);

  if (!user) return null;

  const isDark = theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const tooltipBg = isDark ? "#1e293b" : "#ffffff";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tooltipColor = isDark ? "#ffffff" : "#0f172a";

  const modelIcons: Record<string, typeof Mail> = { email: Mail, url: Globe, text: FileText, image: Image, document: FileText, attachment: Cpu };

  // Dynamic Trend Data from Backend API
  const trendData = (stats?.daily_trend && stats.daily_trend.length > 0)
    ? stats.daily_trend
    : [
      { date: "Mon", safe: 0, threats: 0 },
      { date: "Tue", safe: 0, threats: 0 },
      { date: "Wed", safe: 0, threats: 0 },
      { date: "Thu", safe: 0, threats: 0 },
      { date: "Fri", safe: 0, threats: 0 },
      { date: "Sat", safe: 0, threats: 0 },
      { date: "Sun", safe: 0, threats: 0 },
    ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
            {isGlobalAdmin ? "Platform Operations Command" : "Organization Admin Center"}
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {isGlobalAdmin
              ? "Global multi-tenant system statistics and model health metrics"
              : `Security policies, threat feeds, and enterprise employee directory`}
          </p>
        </div>
        <button
          onClick={() => fetchStatsData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-100 hover:bg-surface-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-surface-700 dark:text-surface-200 border border-surface-200 dark:border-white/[0.08] text-xs font-semibold transition-all shrink-0 disabled:opacity-50"
          title="Refresh Analytics"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-brand-500" : ""}`} />
          <span>Refresh</span>
        </button>
      </motion.div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Employees", value: stats?.total_users || 0, icon: Users, color: "text-blue-600 dark:text-blue-400" },
          { label: "Active Devices", value: stats?.active_devices || 0, icon: Activity, color: "text-emerald-650 dark:text-emerald-400" },
          { label: "Total Scans", value: stats?.total_scans?.toLocaleString() || "0", icon: BarChart3, color: "text-brand-600 dark:text-brand-400" },
          { label: "Threats Blocked", value: stats?.threats_detected || 0, icon: Shield, color: "text-red-650 dark:text-red-400" },
          { label: "Open Incidents", value: stats?.threat_reports_pending || 0, icon: AlertTriangle, color: "text-amber-650 dark:text-amber-400" },
        ].map((s) => (
          <motion.div key={s.label} variants={fadeUp} className="stat-card">
            <s.icon className={`w-5 h-5 ${s.color} mb-3`} />
            <div className="text-2xl font-bold text-surface-900 dark:text-white">{loading ? "-" : s.value}</div>
            <div className="text-xs text-surface-500 mt-1">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* AI Model Health */}
      <motion.div variants={fadeUp} className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white"><Activity className="w-4 h-4 text-brand-600 dark:text-brand-400" /> AI Inference Engine Nodes</h3>
          {!isGlobalAdmin && (
            <Link href="/dashboard/admin/models" className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors">Details →</Link>
          )}
        </div>
        <div className="grid md:grid-cols-5 gap-3">
          {Object.entries(stats?.model_status || { url: true, text: true, email: true, image: false, attachment: true }).map(([key, isOnline]) => {
            const Icon = modelIcons[key] || Cpu;
            return (
              <div key={key} className="px-4 py-3 rounded-lg bg-surface-100/30 dark:bg-white/[0.02] border border-surface-200 dark:border-white/[0.04] hover:border-brand-500/20 dark:hover:border-white/[0.08] transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-surface-500 dark:text-surface-400" />
                  <span className="text-sm font-medium text-surface-800 dark:text-surface-200 uppercase">{key}</span>
                  <span className={`ml-auto w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500 dark:bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
                </div>
                <div className="text-[10px] text-surface-500 mt-1">
                  Status: {isOnline ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">Online</span> : <span className="text-red-500 font-medium">Offline</span>}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-5">
        <motion.div variants={fadeUp} className="lg:col-span-2 stat-card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-surface-900 dark:text-white"><TrendingUp className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Threat Trends (7 Days)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="aGradPhish" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                <linearGradient id="aGradSafe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.15} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12, color: tooltipColor }} labelStyle={{ color: tooltipColor }} />
              <Area type="monotone" dataKey="safe" stroke="#22c55e" fill="url(#aGradSafe)" strokeWidth={2} name="Safe Scans" />
              <Area type="monotone" dataKey="threats" stroke="#ef4444" fill="url(#aGradPhish)" strokeWidth={2} name="Threats" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div variants={fadeUp} className="stat-card flex flex-col">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-surface-900 dark:text-white">
            <Building2 className="w-4 h-4 text-brand-650 dark:text-brand-400" />
            Top Threat Types
          </h3>
          <div className="flex-1 space-y-3">
            {Object.keys(stats?.top_threat_types || {}).length === 0 ? (
              <p className="text-xs text-surface-500">No threats detected yet.</p>
            ) : (() => {
              const totalSum = Object.values(stats.top_threat_types || {}).reduce((acc: number, v: any) => acc + (Number(v) || 0), 0) || 1;
              return Object.entries(stats.top_threat_types).map(([type, count]: [string, any]) => {
                const countNum = Number(count) || 0;
                const percentage = Math.round((countNum / totalSum) * 100);
                const lower = type.toLowerCase();
                const barColor = lower.includes("safe")
                  ? "bg-emerald-500"
                  : lower.includes("phish") || lower.includes("warn")
                  ? "bg-amber-500"
                  : "bg-red-500";

                return (
                  <div key={type} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-surface-700 dark:text-surface-300 capitalize">{type.replace(/_/g, ' ')}</span>
                      <span className="text-surface-900 dark:text-white font-semibold">{countNum} ({percentage}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-200 dark:bg-white/[0.04] overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </motion.div>
      </div>

      {/* Department Snapshots Row */}
      <motion.div variants={fadeUp} className="stat-card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white">
            <Building2 className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Department Breakdown & Member Distribution
          </h3>
          <Link
            href="/dashboard/admin/analytics"
            className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors font-medium"
          >
            View Full Analytics →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {departments.length === 0 ? (
            <div className="col-span-4 text-center py-6 text-xs text-surface-400">Loading department snapshots...</div>
          ) : (
            departments.map((dept) => (
              <Link
                key={dept.id}
                href="/dashboard/admin/analytics"
                className="p-3.5 rounded-xl bg-surface-50 dark:bg-white/[0.02] border border-surface-100 dark:border-white/[0.04] hover:border-brand-500/30 transition-all cursor-pointer block"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-surface-900 dark:text-white truncate">{dept.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
                    {dept.employee_count} members
                  </span>
                </div>
                <p className="text-[11px] text-surface-500 truncate">
                  Lead: <span className="font-medium text-surface-700 dark:text-surface-300">{dept.manager_name || "Unassigned"}</span>
                </p>
              </Link>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

