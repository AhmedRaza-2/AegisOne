"use client";
<<<<<<< Updated upstream
import { useAuth } from "@/lib/auth-context";
import { FileBarChart, Download, Calendar, Filter, FileText, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

const mockReports = [
  { id: 1, name: "Department Security Summary - Week 24", type: "Weekly", date: "Oct 12, 2026", status: "Ready", format: "PDF" },
  { id: 2, name: "Threat Distribution Analysis", type: "Monthly", date: "Oct 01, 2026", status: "Ready", format: "PDF" },
  { id: 3, name: "High Risk Employee Log", type: "Daily", date: "Today", status: "Ready", format: "CSV" },
  { id: 4, name: "Department Device Compliance", type: "Weekly", date: "Oct 12, 2026", status: "Ready", format: "CSV" },
];

export default function ReportsPage() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState("Weekly");
  const [reportFormat, setReportFormat] = useState("PDF");
  const [isGenerating, setIsGenerating] = useState(false);
  
  if (!user) return null;

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      alert(`Report generated successfully!\n\nType: ${reportType}\nFormat: ${reportFormat}`);
    }, 1500);
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-6xl mx-auto">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <FileBarChart className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Department Reports
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Generate and export security metrics for the {user.department} department.
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Generate Report Form */}
        <motion.div variants={fadeUp} className="lg:col-span-1 stat-card h-fit">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white mb-4">
            <Filter className="w-4 h-4 text-brand-500" /> Report Configuration
          </h3>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Reporting Period</label>
              <select value={reportType} onChange={e => setReportType(e.target.value)} className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500">
                <option value="Daily">Daily Report</option>
                <option value="Weekly">Weekly Summary</option>
                <option value="Monthly">Monthly Analytics</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Include Metrics</label>
              <div className="space-y-2 text-sm text-surface-700 dark:text-surface-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                  Threat Distribution
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                  Employee Security Scores
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                  Device Compliance (Extension)
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                  Incident Escalations
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Export Format</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setReportFormat("PDF")} className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${reportFormat === "PDF" ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400" : "border-surface-200 dark:border-white/[0.08] text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-white/[0.02]"}`}>PDF</button>
                <button type="button" onClick={() => setReportFormat("CSV")} className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${reportFormat === "CSV" ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400" : "border-surface-200 dark:border-white/[0.08] text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-white/[0.02]"}`}>CSV</button>
              </div>
            </div>

            <div className="pt-2 border-t border-surface-100 dark:border-white/[0.05]">
              <button disabled={isGenerating} type="submit" className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {isGenerating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FileText className="w-4 h-4" />}
                {isGenerating ? "Generating..." : "Generate Report"}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Report History */}
        <motion.div variants={fadeUp} className="lg:col-span-2 stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white">
              <Calendar className="w-4 h-4 text-emerald-500" /> Recent Reports
            </h3>
          </div>
          
          <div className="space-y-3">
            {mockReports.map(report => (
              <div key={report.id} className="p-4 rounded-xl border border-surface-200 dark:border-white/[0.05] bg-surface-50/50 dark:bg-surface-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-surface-100/50 dark:hover:bg-white/[0.02]">
                <div>
                  <h4 className="font-semibold text-surface-900 dark:text-white">{report.name}</h4>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {report.date}</span>
                    <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> {report.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-[10px] font-medium rounded-md border ${report.format === 'PDF' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                    {report.format}
                  </span>
                  <button className="p-2 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-white/[0.08] hover:bg-surface-50 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 transition-colors shadow-sm">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
=======
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
>>>>>>> Stashed changes
  );
}
