"use client";
import { Shield, Users, AlertTriangle, Activity, BarChart3, TrendingUp, Cpu, Clock, Globe, Mail, FileText, Image, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
};
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function AdminDashboard() {
  const { user, theme } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isGlobalAdmin = user?.role === "global_admin" || user?.role === "super_admin";

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("aegis_access_token");
        const res = await fetch("http://localhost:8000/admin/stats", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (e) {
        console.error("Failed to fetch stats", e);
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchStats();
    }
  }, [user]);

  if (!user) return null;

  const isDark = theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const tooltipBg = isDark ? "#1e293b" : "#ffffff";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tooltipColor = isDark ? "#ffffff" : "#0f172a";

  const modelIcons: Record<string, typeof Mail> = { email: Mail, url: Globe, text: FileText, image: Image, document: FileText, attachment: Cpu };

  // Generate placeholder trend data since backend doesn't provide historical timeseries yet
  const trendData = [
    { date: "Mon", safe: Math.floor((stats?.total_scans || 10) * 0.1), threats: Math.floor((stats?.threats_detected || 2) * 0.05) },
    { date: "Tue", safe: Math.floor((stats?.total_scans || 10) * 0.15), threats: Math.floor((stats?.threats_detected || 2) * 0.1) },
    { date: "Wed", safe: Math.floor((stats?.total_scans || 10) * 0.2), threats: Math.floor((stats?.threats_detected || 2) * 0.15) },
    { date: "Thu", safe: Math.floor((stats?.total_scans || 10) * 0.12), threats: Math.floor((stats?.threats_detected || 2) * 0.2) },
    { date: "Fri", safe: Math.floor((stats?.total_scans || 10) * 0.18), threats: Math.floor((stats?.threats_detected || 2) * 0.1) },
    { date: "Sat", safe: Math.floor((stats?.total_scans || 10) * 0.05), threats: Math.floor((stats?.threats_detected || 2) * 0.05) },
    { date: "Sun", safe: stats?.scans_today || 0, threats: stats?.threats_today || 0 },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
            {isGlobalAdmin ? "Platform Operations Command" : "Organization Admin Center"}
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {isGlobalAdmin 
              ? "Global multi-tenant system statistics and model health metrics" 
              : `Security policies, threat feeds, and employee directory for ${user.department || "your organization"}`}
          </p>
        </div>
      </motion.div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Employees", value: stats?.total_users || 0, icon: Users, color: "text-blue-600 dark:text-blue-400" },
          { label: "Active Devices", value: stats?.active_devices || 0, icon: Activity, color: "text-emerald-650 dark:text-emerald-400" },
          { label: "Total Scans", value: stats?.total_scans?.toLocaleString() || "0", icon: BarChart3, color: "text-brand-600 dark:text-brand-400" },
          { label: "Threats Blocked", value: stats?.threats_detected || 0, icon: Shield, color: "text-red-650 dark:text-red-400" },
          { label: "Open Incidents", value: stats?.threat_reports_pending || 0, icon: AlertTriangle, color: "text-amber-650 dark:text-amber-400" },
        ].map((s, i) => (
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
            <button onClick={() => window.location.href = "/dashboard/admin/models"} className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors">Details →</button>
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
            ) : (
              Object.entries(stats.top_threat_types).map(([type, count]: [string, any], index) => {
                const total = stats.threats_detected || 1;
                const percentage = Math.round((count / total) * 100);
                return (
                  <div key={type} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-surface-700 dark:text-surface-300 capitalize">{type.replace(/_/g, ' ')}</span>
                      <span className="text-brand-650 dark:text-brand-400 font-semibold">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-200 dark:bg-white/[0.04] overflow-hidden">
                      <div className={`h-full rounded-full ${index === 0 ? "bg-red-500" : index === 1 ? "bg-amber-500" : "bg-brand-500"}`} style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
