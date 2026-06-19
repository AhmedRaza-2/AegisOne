"use client";
import { departmentStats, threatTrends, scanHistory } from "@/lib/mock-data";
import { FileBarChart, TrendingUp, BarChart3, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { useMemo } from "react";

export default function ReportsPage() {
  const { theme } = useAuth();

  const isDark = theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const tooltipBg = isDark ? "#1e293b" : "#ffffff";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tooltipColor = isDark ? "#ffffff" : "#0f172a";

  const scanTypes = useMemo(() => {
    return [
      { name: "URL", count: scanHistory.filter(s => s.scanType === "url").length * 15, color: "#06b6d4" },
      { name: "Email", count: scanHistory.filter(s => s.scanType === "email").length * 12, color: "#3b82f6" },
      { name: "Text", count: scanHistory.filter(s => s.scanType === "text").length * 8, color: "#8b5cf6" },
      { name: "Image", count: scanHistory.filter(s => s.scanType === "image").length * 5, color: "#ec4899" },
      { name: "File", count: scanHistory.filter(s => s.scanType === "attachment").length * 3, color: "#f59e0b" },
    ];
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <FileBarChart className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Reports & Analytics
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Department performance and threat analytics</p>
        </div>
        <button className="px-4 py-2 text-sm text-surface-750 dark:text-surface-300 border border-surface-200 dark:border-white/[0.08] rounded-lg hover:bg-surface-100 dark:hover:bg-white/[0.04] transition-all flex items-center gap-2 shadow-sm bg-white dark:bg-transparent">
          <Download className="w-4 h-4" /> Export CSV Report
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-surface-900 dark:text-white">
            <TrendingUp className="w-4 h-4 text-brand-650 dark:text-brand-400" /> Weekly Threat Volume
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={threatTrends}>
              <defs>
                <linearGradient id="gradSafe" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} />
              <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12, color: tooltipColor }} labelStyle={{ color: tooltipColor }} />
              <Area type="monotone" dataKey="safe" stroke="#22c55e" fill="url(#gradSafe)" strokeWidth={2} name="Safe" />
              <Area type="monotone" dataKey="phishing" stroke="#ef4444" fill="transparent" strokeWidth={2} name="Threats" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-surface-900 dark:text-white">
            <BarChart3 className="w-4 h-4 text-brand-650 dark:text-brand-400" /> Scans by Type
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={scanTypes}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} />
              <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12, color: tooltipColor }} labelStyle={{ color: tooltipColor }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Volume">
                {scanTypes.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department breakdown */}
      <div className="stat-card">
        <h3 className="text-sm font-semibold mb-4 text-surface-900 dark:text-white">Department Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-white/[0.06] bg-surface-50/50 dark:bg-white/[0.01]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Employees</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Scans Today</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Threats</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Risk Index</th>
              </tr>
            </thead>
            <tbody>
              {departmentStats.map(d => (
                <tr key={d.name} className="border-b border-surface-100 dark:border-white/[0.03] hover:bg-surface-100/50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3.5 font-semibold text-surface-850 dark:text-surface-200">{d.name}</td>
                  <td className="px-4 py-3.5 text-surface-650 dark:text-surface-300">{d.employeeCount}</td>
                  <td className="px-4 py-3.5 text-surface-650 dark:text-surface-300">{d.scansToday}</td>
                  <td className="px-4 py-3.5">
                    <span className={d.threatsBlocked > 15 ? "text-red-500 font-bold" : "text-surface-650 dark:text-surface-300"}>
                      {d.threatsBlocked}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-surface-200 dark:bg-white/[0.06] overflow-hidden">
                        <div className={`h-full rounded-full ${d.riskScore > 40 ? "bg-red-500" : d.riskScore > 20 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${d.riskScore}%` }} />
                      </div>
                      <span className="text-xs text-surface-500 dark:text-surface-450">{d.riskScore}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
