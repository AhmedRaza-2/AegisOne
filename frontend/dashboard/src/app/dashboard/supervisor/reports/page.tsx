"use client";
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
  );
}
