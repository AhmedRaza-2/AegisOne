"use client";
import { useAuth } from "@/lib/auth-context";
import { scanHistory, users, incidents, threatTrends, getUserById } from "@/lib/mock-data";
import { ShieldCheck, Users, AlertTriangle, TrendingUp, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useMemo, useState, useEffect } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
};
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

const COLORS = ["#ef4444", "#f59e0b", "#8b5cf6", "#22c55e"];

export default function SupervisorDashboard() {
  const { user, theme } = useAuth();
  if (!user) return null;

  const isDark = theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const tooltipBg = isDark ? "#1e293b" : "#ffffff";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tooltipColor = isDark ? "#ffffff" : "#0f172a";

  const [realStats, setRealStats] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("aegis_token");
    fetch("http://localhost:9000/admin/stats", {
      headers: token ? { "Authorization": `Bearer ${token}` } : {}
    })
      .then(res => res.json())
      .then(data => {
        if (!data.detail) {
          setRealStats(data);
        }
      })
      .catch(console.error);
  }, []);

  // Stabilize metrics calculation using useMemo
  const deptEmployees = useMemo(() => {
    return users.filter(u => u.department === user.department && u.role === "employee");
  }, [user.department]);

  const deptScans = useMemo(() => {
    return scanHistory.filter(s => deptEmployees.some(e => e.id === s.userId));
  }, [deptEmployees]);

  const deptThreats = useMemo(() => {
    return deptScans.filter(s => s.prediction !== "legitimate");
  }, [deptScans]);

  const openIncidents = useMemo(() => {
    return incidents.filter(i => deptEmployees.some(e => e.id === i.reportedBy) && (i.status === "open" || i.status === "investigating"));
  }, [deptEmployees]);

  const deptIncidentsList = useMemo(() => {
    return incidents.filter(i => deptEmployees.some(e => e.id === i.reportedBy));
  }, [deptEmployees]);

  const threatDist = useMemo(() => {
    return [
      { name: "Phishing", value: deptThreats.filter(t => t.category === "phishing" || t.prediction === "phishing").length || 5 },
      { name: "Malware", value: deptThreats.filter(t => t.category === "malware").length || 2 },
      { name: "Suspicious", value: deptThreats.filter(t => t.riskLevel === "suspicious").length || 1 },
      { name: "Safe", value: deptScans.filter(t => t.prediction === "legitimate").length || 8 },
    ];
  }, [deptThreats, deptScans]);

  // Employee risk ranking with stable pseudo-random addition
  const employeeRisk = useMemo(() => {
    return deptEmployees.map(emp => {
      const empScans = scanHistory.filter(s => s.userId === emp.id);
      const empThreats = empScans.filter(s => s.prediction !== "legitimate");
      // Stable statistics based on employee metadata rather than random seed
      const scanOffset = (emp.fullName.charCodeAt(0) % 30);
      const threatsOffset = (emp.fullName.charCodeAt(1) % 4);
      
      const totalScans = empScans.length + scanOffset;
      const threats = empThreats.length + threatsOffset;
      const riskScore = threats > 0 ? Math.round((threats / Math.max(totalScans, 1)) * 100) : (emp.fullName.charCodeAt(2) % 15);
      
      return {
        ...emp,
        totalScans,
        threats,
        riskScore
      };
    }).sort((a, b) => b.riskScore - a.riskScore);
  }, [deptEmployees]);

  const statsCards = useMemo(() => {
    return [
      { label: "Employees", value: realStats ? realStats.total_users : deptEmployees.length, icon: Users, color: "text-brand-600 dark:text-brand-400", trend: "+2 this month", trendUp: true },
      { label: "Total Scans", value: realStats ? realStats.total_scans.toLocaleString() : (deptScans.length * 12 + 342).toLocaleString(), icon: BarChart3, color: "text-cyan-600 dark:text-cyan-400", trend: "+18% vs last week", trendUp: true },
      { label: "Threats Blocked", value: realStats ? realStats.threats_detected : deptThreats.length * 3 + 18, icon: ShieldCheck, color: "text-red-600 dark:text-red-400", trend: "-5% vs last week", trendUp: false },
      { label: "Open Incidents", value: realStats ? realStats.threat_reports_pending : openIncidents.length, icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", trend: `${realStats ? realStats.threat_reports_pending : openIncidents.length} pending`, trendUp: false },
    ];
  }, [realStats, deptEmployees.length, deptScans.length, deptThreats.length, openIncidents.length]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Department Overview</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">{user.department} — {deptEmployees.length} employees</p>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((s, i) => (
          <motion.div key={s.label} variants={fadeUp} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <span className={`flex items-center gap-0.5 text-[10px] font-medium ${s.trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                {s.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {s.trend}
              </span>
            </div>
            <div className="text-2xl font-bold text-surface-900 dark:text-white">{s.value}</div>
            <div className="text-xs text-surface-500 mt-1">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Threat trends chart */}
        <motion.div variants={fadeUp} className="lg:col-span-2 stat-card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-surface-900 dark:text-white"><TrendingUp className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Threat Trends (7 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={threatTrends}>
              <defs>
                <linearGradient id="gradPhish" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                <linearGradient id="gradMalware" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="100%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12, color: tooltipColor }} labelStyle={{ color: tooltipColor }} />
              <Area type="monotone" dataKey="phishing" stroke="#ef4444" fill="url(#gradPhish)" strokeWidth={2} />
              <Area type="monotone" dataKey="malware" stroke="#f59e0b" fill="url(#gradMalware)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Threat distribution pie */}
        <motion.div variants={fadeUp} className="stat-card flex flex-col items-center">
          <h3 className="text-sm font-semibold mb-4 self-start flex items-center gap-2 text-surface-900 dark:text-white"><BarChart3 className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Threat Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={threatDist} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" paddingAngle={4}>
                {threatDist.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12, color: tooltipColor }} labelStyle={{ color: tooltipColor }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2">
            {threatDist.map((d, i) => (
              <span key={d.name} className="flex items-center gap-1.5 text-[10px] text-surface-500 dark:text-surface-400">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{d.name}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Employee Risk Table */}
      <motion.div variants={fadeUp} className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white"><Users className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Employee Risk Overview</h3>
          <button onClick={() => window.location.href = "/dashboard/supervisor/employees"} className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors">View all →</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-white/[0.06]">
                <th className="text-left px-3 py-2 text-xs font-medium text-surface-500">Employee</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-surface-500">Scans</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-surface-500">Threats</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-surface-500">Risk Score</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-surface-500">Extension</th>
              </tr>
            </thead>
            <tbody>
              {employeeRisk.map(emp => (
                <tr key={emp.id} className="border-b border-surface-100 dark:border-white/[0.03] hover:bg-surface-100/50 dark:hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-brand-600/20 flex items-center justify-center text-[10px] font-bold text-brand-600 dark:text-brand-400">{emp.fullName.split(" ").map(n => n[0]).join("")}</div>
                      <div>
                        <div className="text-sm text-surface-800 dark:text-surface-200">{emp.fullName}</div>
                        <div className="text-[10px] text-surface-500">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-surface-700 dark:text-surface-300">{emp.totalScans}</td>
                  <td className="px-3 py-2.5"><span className={emp.threats > 3 ? "text-red-650 dark:text-red-400 font-medium" : "text-surface-600 dark:text-surface-300"}>{emp.threats}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-surface-200 dark:bg-white/[0.06] overflow-hidden">
                        <div className={`h-full rounded-full ${emp.riskScore > 50 ? "bg-red-500" : emp.riskScore > 25 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(emp.riskScore, 100)}%` }} />
                      </div>
                      <span className="text-xs text-surface-500 dark:text-surface-400">{emp.riskScore}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`w-2 h-2 rounded-full inline-block ${emp.extensionInstalled ? "bg-emerald-500 dark:bg-emerald-400" : "bg-surface-300 dark:bg-surface-650"}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Recent Incidents */}
      <motion.div variants={fadeUp} className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white"><AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Recent Incidents</h3>
          <button onClick={() => window.location.href = "/dashboard/supervisor/incidents"} className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors">View all →</button>
        </div>
        <div className="space-y-2">
          {deptIncidentsList.length === 0 ? (
            <p className="text-sm text-surface-500 py-4 text-center">No incidents reported in your department.</p>
          ) : (
            deptIncidentsList.slice(0, 4).map(inc => {
              const reporter = getUserById(inc.reportedBy);
              return (
                <div key={inc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-100/30 dark:bg-white/[0.02] hover:bg-surface-100/50 dark:hover:bg-white/[0.04] transition-colors">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${inc.severity === "critical" ? "bg-red-500" : inc.severity === "high" ? "bg-amber-500" : inc.severity === "medium" ? "bg-blue-500" : "bg-surface-400 dark:bg-surface-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-800 dark:text-surface-200 truncate">{inc.title}</p>
                    <p className="text-[10px] text-surface-500">by {reporter?.fullName || "Unknown"}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${inc.status === "open" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : inc.status === "investigating" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : inc.status === "resolved" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-surface-200 text-surface-700 dark:bg-surface-700 dark:text-surface-400"}`}>{inc.status}</span>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
