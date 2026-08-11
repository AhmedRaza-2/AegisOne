"use client";
import { useAuth } from "@/lib/auth-context";
import { BarChart3, ShieldCheck, Activity, Globe, Download, Key, Image as ImageIcon, Building2, Users, AlertTriangle, TrendingUp, Search } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { useMemo, useState, useEffect } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function AdminAnalyticsPage() {
  const { user, theme, logout, fetchWithCache } = useAuth();
  const [realStats, setRealStats] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [userList, setUserList] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("24h");
  const [loading, setLoading] = useState(true);

  const getHeaders = () => {
    const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    return { Authorization: `Bearer ${token || ""}` };
  };

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const fetchData = async () => {
      try {
        const headers = getHeaders();
        const [sData, dData, uData] = await Promise.all([
          fetchWithCache(`http://localhost:8000/admin/stats?time_range=${timeRange}`, { headers }),
          fetchWithCache(`http://localhost:8000/admin/departments`, { headers }),
          fetchWithCache(`http://localhost:8000/admin/users?time_range=${timeRange}`, { headers })
        ]);

        if (isMounted) {
          if (sData) setRealStats(sData);
          if (dData) setDepartments(dData.departments || []);
          if (uData) setUserList(uData.users || []);
        }
      } catch (err) {
        console.error("[Admin Analytics] Fetch error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [user, timeRange, logout]);

  if (!user) return null;

  const isDark = theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const tooltipBg = isDark ? "#1e293b" : "#ffffff";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tooltipColor = isDark ? "#ffffff" : "#0f172a";

  // Filtered list of users for department member breakdown
  const filteredUsers = userList.filter((u) => {
    if (selectedDeptId !== "all") {
      const deptObj = departments.find(d => d.id === selectedDeptId);
      const matchesId = u.department_id === selectedDeptId;
      const matchesName = deptObj && u.department === deptObj.name;
      if (!matchesId && !matchesName) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const nameMatch = u.full_name?.toLowerCase().includes(q);
      const emailMatch = u.email?.toLowerCase().includes(q);
      return nameMatch || emailMatch;
    }
    return true;
  });

  const securityTrendData = realStats?.daily_trend || [
    { date: "Mon", safe: 0, threats: 0 },
    { date: "Tue", safe: 0, threats: 0 },
    { date: "Wed", safe: 0, threats: 0 },
    { date: "Thu", safe: 0, threats: 0 },
    { date: "Fri", safe: 0, threats: 0 },
    { date: "Sat", safe: 0, threats: 0 },
    { date: "Sun", safe: 0, threats: 0 },
  ];

  const deptComparisonData = departments.map((d) => ({
    name: d.name,
    scans: d.total_scans ?? 0,
    threats: d.threats_count ?? 0,
    risk: d.avg_risk_score ?? 0
  }));

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <BarChart3 className="w-6 h-6 text-brand-600 dark:text-brand-400" /> Enterprise Analytics & Department Intelligence
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Real-time security telemetry, department risk matrix, and individual employee health metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["24h", "7d", "30d", "all"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${timeRange === range
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-surface-100 dark:bg-white/[0.04] text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-white/[0.08]"
                }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Top Telemetry KPI Cards */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-surface-500">Total Scans Executed</span>
            <Globe className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-surface-900 dark:text-white">{realStats?.total_scans?.toLocaleString() || "0"}</p>
          <p className="text-[11px] text-emerald-500 mt-1 font-medium">Live Telemetry Active</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-surface-500">Threats Neutralized</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-surface-900 dark:text-white">{realStats?.threats_detected || 0}</p>
          <p className="text-[11px] text-surface-400 mt-1 font-medium">AI Decision Engine</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-surface-500">Active Departments</span>
            <Building2 className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-surface-900 dark:text-white">{departments.length}</p>
          <p className="text-[11px] text-surface-400 mt-1 font-medium">Monitored Segments</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-surface-500">Protected Employees</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-surface-900 dark:text-white">{userList.length}</p>
          <p className="text-[11px] text-purple-400 mt-1 font-medium">Active Credentials</p>
        </div>
      </motion.div>

      {/* Department Cards Grid - Clickable for Instant Filter */}
      <motion.div variants={fadeUp} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-surface-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-500" /> Department Breakdown Cards (Click to Filter Employees)
          </h2>
          <span className="text-xs text-surface-400">Select card to view employee health</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => setSelectedDeptId("all")}
            className={`p-4 rounded-2xl border text-left transition-all ${selectedDeptId === "all"
                ? "bg-brand-50/60 border-brand-500 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300 dark:border-brand-500/50 shadow-sm"
                : "bg-white dark:bg-[#141A29] border-surface-200 dark:border-white/[0.06] text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-white/[0.02]"
              }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider opacity-80">Entire Organization</span>
              <Building2 className="w-4 h-4 text-brand-500" />
            </div>
            <p className="text-2xl font-bold text-surface-900 dark:text-white mb-2">{userList.length}</p>
            <p className="text-[11px] text-surface-500">All Employees across Organization</p>
          </button>

          {departments.map((dept) => {
            const isSelected = selectedDeptId === dept.id;
            return (
              <button
                key={dept.id}
                onClick={() => setSelectedDeptId(dept.id)}
                className={`p-4 rounded-2xl border text-left transition-all ${isSelected
                    ? "bg-brand-50/60 border-brand-500 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300 dark:border-brand-500/50 shadow-sm"
                    : "bg-white dark:bg-[#141A29] border-surface-200 dark:border-white/[0.06] text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-white/[0.02]"
                  }`}
              >
                <div className="flex items-start justify-between mb-1 gap-2">
                  <span className="text-sm font-bold text-surface-900 dark:text-white leading-tight">{dept.name}</span>
                  <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-100 dark:bg-white/[0.06] text-surface-500">
                    {dept.employee_count} employees
                  </span>
                </div>
                <p className="text-xs text-surface-500 font-medium leading-snug mb-3">
                  Lead: <span className="text-surface-900 dark:text-white font-semibold">{dept.manager_name || "Unassigned"}</span>
                </p>

                {/* Real-time Department Metrics */}
                <div className="grid grid-cols-3 gap-1 pt-2 border-t border-surface-100 dark:border-white/[0.06] text-[11px]">
                  <div>
                    <p className="text-[10px] text-surface-400 font-medium">Scans</p>
                    <p className="font-bold text-surface-900 dark:text-white">{dept.total_scans ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-surface-400 font-medium">Threats</p>
                    <p className={`font-bold ${(dept.threats_count ?? 0) > 0 ? "text-red-500" : "text-emerald-500"}`}>{dept.threats_count ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-surface-400 font-medium">Avg Risk</p>
                    <p className="font-bold text-amber-500">{dept.avg_risk_score ?? 0}%</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Analytics Charts Row */}
      <div className="grid lg:grid-cols-2 gap-5">
        <motion.div variants={fadeUp} className="stat-card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-surface-900 dark:text-white">
            <TrendingUp className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Organization Scan & Threat Velocity
          </h3>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={securityTrendData}>
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

        <motion.div variants={fadeUp} className="stat-card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-surface-900 dark:text-white">
            <BarChart3 className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Department Scans & Threat Comparison
          </h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={deptComparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12, color: tooltipColor }} />
              <Bar dataKey="scans" fill="#3b82f6" name="Total Scans" radius={[4, 4, 0, 0]} />
              <Bar dataKey="threats" fill="#ef4444" name="Threats Neutralized" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Selected Department Employee Telemetry Table */}
      <motion.div variants={fadeUp} className="stat-card space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-surface-100 dark:border-white/[0.06] pb-4">
          <div>
            <h3 className="text-sm font-bold text-surface-900 dark:text-white">
              Employee Telemetry & Threat Metrics
            </h3>
            <p className="text-xs text-surface-500">
              Showing employees for: <span className="font-semibold text-brand-600 dark:text-brand-400">{selectedDeptId === "all" ? "Entire Organization" : (departments.find(d => d.id === selectedDeptId)?.name || "Selected Department")}</span>
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-surface-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search employee name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-xl pl-9 pr-4 py-1.5 text-xs text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-200 dark:border-white/[0.06] text-surface-500 uppercase tracking-wider">
                <th className="py-3 px-2">Employee</th>
                <th className="py-3 px-2">Role</th>
                <th className="py-3 px-2">Department</th>
                <th className="py-3 px-2 text-center">Total Scans</th>
                <th className="py-3 px-2 text-center">Threats Detected</th>
                <th className="py-3 px-2 text-center">Security Risk Score</th>
                <th className="py-3 px-2 text-right">Account Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-surface-400">Loading department analytics...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-surface-400">No employees found matching filter</td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-50 dark:hover:bg-white/[0.01] transition-colors">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 font-bold flex items-center justify-center shrink-0">
                          {u.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-surface-900 dark:text-white">{u.full_name}</p>
                          <p className="text-[11px] text-surface-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${u.role === "admin" || u.role === "super_admin"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : u.role === "manager" || u.role === "department_admin"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
                        }`}>
                        {u.role === "department_admin" ? "Manager" : u.role}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-medium text-surface-700 dark:text-surface-300">
                      {u.department || "Organization"}
                    </td>
                    <td className="py-3 px-2 text-center font-semibold text-surface-900 dark:text-white">
                      {u.total_scans ?? 0}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`font-bold ${(u.threats ?? 0) > 0 ? "text-red-500" : "text-emerald-500"}`}>
                        {u.threats ?? 0}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${(u.risk_score ?? 0) >= 50 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : (u.risk_score ?? 0) >= 20 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"}`}>
                        {u.risk_score ?? 0}%
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${u.account_status === "disabled" || u.account_status === "suspended"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        }`}>
                        {u.account_status || "Active"}
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
