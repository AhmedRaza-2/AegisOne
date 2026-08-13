"use client";
import { useAuth } from "@/lib/auth-context";
import { FileBarChart, Download, Filter, RefreshCw, ShieldAlert, Users, Activity, CheckCircle2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function ReportsPage() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState<"security" | "employee" | "threat">("security");
  const [timeRange, setTimeRange] = useState("24h");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      // Fetch stats
      const statsRes = await fetch(`http://localhost:8000/admin/stats?time_range=${timeRange}`, { headers });
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      // Fetch users
      const usersRes = await fetch(`http://localhost:8000/admin/users?range=${timeRange}`, { headers });
      if (usersRes.ok) {
        const uData = await usersRes.json();
        if (uData.users) setUsersList(uData.users);
      }
    } catch (e) {
      showToast("Error fetching report metrics", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user, timeRange]);

  const downloadCSV = () => {
    let csvContent = "";
    let fileName = "";

    if (reportType === "security") {
      fileName = `Department_Security_Summary_${timeRange}.csv`;
      csvContent = "Metric,Value\n";
      csvContent += `Department,${user?.department || "IT"}\n`;
      csvContent += `Time Range,${timeRange}\n`;
      csvContent += `Total Users,${stats?.total_users || 0}\n`;
      csvContent += `Total Scans,${stats?.total_scans || 0}\n`;
      csvContent += `Scans Today,${stats?.scans_today || 0}\n`;
      csvContent += `Threats Detected,${stats?.threats_detected || 0}\n`;
      csvContent += `Active Devices,${stats?.active_devices || 0}\n`;
      csvContent += `Credential Events,${stats?.credential_events_total || 0}\n`;
      csvContent += `Download Events,${stats?.download_events_total || 0}\n`;
    } else if (reportType === "employee") {
      fileName = `Employee_Risk_Report_${timeRange}.csv`;
      csvContent = "ID,Name,Email,Role,Status,Department\n";
      usersList.forEach(u => {
        csvContent += `"${u.id}","${u.full_name}","${u.email}","${u.role}","${u.account_status || 'active'}","${u.department || 'General'}"\n`;
      });
    } else if (reportType === "threat") {
      fileName = `Threat_Analysis_${timeRange}.csv`;
      csvContent = "Threat Category,Count\n";
      if (stats?.top_threat_types) {
        Object.entries(stats.top_threat_types).forEach(([type, count]) => {
          csvContent += `"${type}",${count}\n`;
        });
      }
      if (stats?.events_by_severity) {
        Object.entries(stats.events_by_severity).forEach(([sev, count]) => {
          csvContent += `"Severity: ${sev}",${count}\n`;
        });
      }
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Downloaded ${fileName}`, "success");
  };

  if (!user) return null;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-6xl mx-auto">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-white font-medium z-[999] text-sm ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
              }`}
          >
            {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <FileBarChart className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Department Reports
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Real-time security analytics and report export for {user.department || "IT"} Department.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.08] rounded-xl text-xs font-medium text-surface-900 dark:text-white focus:outline-none"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button
            onClick={fetchData}
            className="p-2 bg-surface-100 dark:bg-white/[0.04] text-surface-700 dark:text-surface-300 rounded-xl hover:bg-surface-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </motion.div>

      {/* Report Configuration & Controls */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div variants={fadeUp} className="lg:col-span-1 stat-card h-fit space-y-4">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2">
            <Filter className="w-4 h-4 text-brand-500" /> Select Report Type
          </h3>

          <div className="space-y-2">
            <button
              onClick={() => setReportType("security")}
              className={`w-full text-left p-3 rounded-xl border text-sm font-medium transition-all ${reportType === "security"
                  ? "bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-500/50"
                  : "border-surface-200 dark:border-white/[0.06] text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-white/[0.02]"
                }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <Activity className="w-4 h-4" /> Security Summary
              </div>
              <p className="text-xs text-surface-500 mt-1 font-normal">Scans, threats blocked, and device health stats.</p>
            </button>

            <button
              onClick={() => setReportType("employee")}
              className={`w-full text-left p-3 rounded-xl border text-sm font-medium transition-all ${reportType === "employee"
                  ? "bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-500/50"
                  : "border-surface-200 dark:border-white/[0.06] text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-white/[0.02]"
                }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <Users className="w-4 h-4" /> Employee Risk Log
              </div>
              <p className="text-xs text-surface-500 mt-1 font-normal">Department employee list and security status.</p>
            </button>

            <button
              onClick={() => setReportType("threat")}
              className={`w-full text-left p-3 rounded-xl border text-sm font-medium transition-all ${reportType === "threat"
                  ? "bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-500/50"
                  : "border-surface-200 dark:border-white/[0.06] text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-white/[0.02]"
                }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="w-4 h-4" /> Threat Analysis
              </div>
              <p className="text-xs text-surface-500 mt-1 font-normal">Top threat categories and severity distribution.</p>
            </button>
          </div>

          <button
            onClick={downloadCSV}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Export CSV Report
          </button>
        </motion.div>

        {/* Report Live Preview Display */}
        <motion.div variants={fadeUp} className="lg:col-span-2 stat-card space-y-4">
          <div className="flex items-center justify-between border-b border-surface-100 dark:border-white/[0.06] pb-3">
            <h3 className="text-sm font-semibold text-surface-900 dark:text-white">
              Live Data Preview: <span className="text-brand-600 dark:text-brand-400 capitalize">{reportType} Report</span>
            </h3>
            <span className="text-xs text-surface-500 bg-surface-100 dark:bg-white/[0.04] px-2.5 py-1 rounded-full">
              Real Backend Data
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-surface-400 text-sm">Loading report metrics...</div>
          ) : reportType === "security" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-surface-50 dark:bg-white/[0.02] rounded-xl border border-surface-100 dark:border-white/[0.04]">
                  <p className="text-xs text-surface-500">Total Scans</p>
                  <p className="text-lg font-bold text-surface-900 dark:text-white mt-1">{stats?.total_scans || 0}</p>
                </div>
                <div className="p-3 bg-surface-50 dark:bg-white/[0.02] rounded-xl border border-surface-100 dark:border-white/[0.04]">
                  <p className="text-xs text-surface-500">Threats Detected</p>
                  <p className="text-lg font-bold text-red-600 dark:text-red-400 mt-1">{stats?.threats_detected || 0}</p>
                </div>
                <div className="p-3 bg-surface-50 dark:bg-white/[0.02] rounded-xl border border-surface-100 dark:border-white/[0.04]">
                  <p className="text-xs text-surface-500">Active Devices</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats?.active_devices || 0}</p>
                </div>
                <div className="p-3 bg-surface-50 dark:bg-white/[0.02] rounded-xl border border-surface-100 dark:border-white/[0.04]">
                  <p className="text-xs text-surface-500">Scans Today</p>
                  <p className="text-lg font-bold text-surface-900 dark:text-white mt-1">{stats?.scans_today || 0}</p>
                </div>
                <div className="p-3 bg-surface-50 dark:bg-white/[0.02] rounded-xl border border-surface-100 dark:border-white/[0.04]">
                  <p className="text-xs text-surface-500">Download Events</p>
                  <p className="text-lg font-bold text-surface-900 dark:text-white mt-1">{stats?.download_events_total || 0}</p>
                </div>
                <div className="p-3 bg-surface-50 dark:bg-white/[0.02] rounded-xl border border-surface-100 dark:border-white/[0.04]">
                  <p className="text-xs text-surface-500">Credential Events</p>
                  <p className="text-lg font-bold text-surface-900 dark:text-white mt-1">{stats?.credential_events_total || 0}</p>
                </div>
              </div>
            </div>
          ) : reportType === "employee" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-white/[0.06] text-surface-500">
                    <th className="py-2">Name</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-white/[0.04]">
                  {usersList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-surface-400">No employees found</td>
                    </tr>
                  ) : (
                    usersList.map((u) => (
                      <tr key={u.id}>
                        <td className="py-2.5 font-medium text-surface-900 dark:text-white">{u.full_name}</td>
                        <td className="py-2.5 text-surface-500">{u.email}</td>
                        <td className="py-2.5 capitalize text-surface-500">{u.role}</td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            {u.account_status || "Active"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Top Detected Categories</h4>
              {stats?.top_threat_types && Object.keys(stats.top_threat_types).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(stats.top_threat_types).map(([type, count]: [string, any]) => (
                    <div key={type} className="flex items-center justify-between p-2.5 bg-surface-50 dark:bg-white/[0.02] rounded-lg text-xs">
                      <span className="font-medium text-surface-900 dark:text-white">{type}</span>
                      <span className="px-2 py-0.5 bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 rounded font-bold">{count} events</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-surface-400 text-xs">No specific threat categories recorded in this time window.</div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

