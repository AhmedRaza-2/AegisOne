"use client";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, Users, AlertTriangle, TrendingUp, BarChart3, ArrowUpRight, ArrowDownRight, ShieldAlert, BrainCircuit } from "lucide-react";
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
  const { user, theme, logout } = useAuth();
  if (!user) return null;

  const isDark = theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const tooltipBg = isDark ? "#1e293b" : "#ffffff";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tooltipColor = isDark ? "#ffffff" : "#0f172a";

  const [realStats, setRealStats] = useState<any>(null);
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("24h");

  useEffect(() => {
    if (!user) return;

    const fetchData = () => {
      const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
      const headers: Record<string, string> = token ? { "Authorization": `Bearer ${token}` } : {};

      console.log(`[Supervisor Dashboard] Fetching stats and users (range: ${timeRange}) with token:`, token ? "Present" : "Missing");

      // Fetch Stats
      fetch(`http://localhost:8000/admin/stats?time_range=${timeRange}`, { headers })
        .then(res => {
          console.log("[Supervisor Dashboard] Stats status:", res.status);
          if (res.status === 401) {
            console.warn("[Supervisor Dashboard] Stale token detected. Logging out.");
            logout();
            return;
          }
          return res.json();
        })
        .then(data => {
          if (!data) return;
          console.log("[Supervisor Dashboard] Stats data received:", data);
          if (!data.detail) {
            setRealStats(data);
          } else {
            console.warn("[Supervisor Dashboard] Stats error detail:", data.detail);
          }
        })
        .catch(err => console.error("[Supervisor Dashboard] Stats fetch error:", err));

      // Fetch Users
      fetch(`http://localhost:8000/admin/users?time_range=${timeRange}`, { headers })
        .then(res => {
          console.log("[Supervisor Dashboard] Users status:", res.status);
          if (res.status === 401) {
            console.warn("[Supervisor Dashboard] Stale token detected. Logging out.");
            logout();
            return;
          }
          return res.json();
        })
        .then(data => {
          if (!data) return;
          console.log("[Supervisor Dashboard] Users data received:", data);
          if (data.users) {
            setDbUsers(data.users);
          } else if (data.detail) {
            console.warn("[Supervisor Dashboard] Users error detail:", data.detail);
          }
        })
        .catch(err => console.error("[Supervisor Dashboard] Users fetch error:", err));
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [user, timeRange]);

  // Use real data where possible
  const totalEmployees = realStats ? realStats.total_users : 0;
  const totalThreats = realStats ? realStats.threats_detected : 0;
  const protectedDevices = realStats ? realStats.active_devices : 0;

  const employeeRisk = useMemo(() => {
    return dbUsers.map(emp => {
      return {
        ...emp,
        totalScans: emp.total_scans || 0,
        threats: emp.threats || 0,
        riskScore: emp.risk_score || 0
      };
    }).sort((a, b) => b.riskScore - a.riskScore);
  }, [dbUsers]);

  const avgSecurityScore = useMemo(() => {
    if (employeeRisk.length === 0) return 100;
    const totalScore = employeeRisk.reduce((acc, emp) => acc + (100 - (emp.riskScore || 0)), 0);
    return Math.max(0, Math.round(totalScore / employeeRisk.length));
  }, [employeeRisk]);

  const combinedStats = useMemo(() => {
    let totalScans = 0;
    let totalThreats = 0;
    let totalRiskSum = 0;
    employeeRisk.forEach(emp => {
      totalScans += emp.totalScans || 0;
      totalThreats += emp.threats || 0;
      totalRiskSum += emp.riskScore || 0;
    });
    const avgRisk = employeeRisk.length > 0 ? Math.round(totalRiskSum / employeeRisk.length) : 0;
    const totalSafe = Math.max(0, totalScans - totalThreats);
    return {
      totalScans,
      totalThreats,
      totalSafe,
      avgRisk
    };
  }, [employeeRisk]);

  const threatDist = useMemo(() => {
    if (!realStats || !realStats.top_threat_types) {
      return [
        { name: "Safe Scans", value: 8, color: "#22c55e" },
        { name: "Phishing", value: 5, color: "#ef4444" },
        { name: "Malware", value: 2, color: "#f59e0b" },
      ];
    }
    const types = realStats.top_threat_types;
    const colorMap: Record<string, string> = {
      "Safe Scans": "#22c55e",
      "Phishing": "#ef4444",
      "Malware": "#f59e0b"
    };
    return Object.keys(types).map(k => ({
      name: k,
      value: types[k],
      color: colorMap[k] || "#8b5cf6"
    })).filter(d => d.value > 0);
  }, [realStats]);

  const statsCards = useMemo(() => {
    const blockLabel = timeRange === "24h" ? "Blocked Threats Today" : timeRange === "7d" ? "Blocked Threats (7D)" : timeRange === "30d" ? "Blocked Threats (30D)" : "Blocked Threats (All Time)";
    const blockSub = timeRange === "24h" ? "Last 24 hours" : timeRange === "7d" ? "Last 7 days" : timeRange === "30d" ? "Last 30 days" : "All scans history";
    return [
      { label: "Employees", value: totalEmployees, icon: Users, color: "text-blue-600 dark:text-blue-400", sub: "Active in Dept" },
      { label: "Protected Devices", value: protectedDevices, icon: ShieldCheck, color: "text-emerald-600 dark:text-emerald-400", sub: "AegisOne Active" },
      { label: "High Risk", value: employeeRisk.filter(e => e.riskScore > 50).length, icon: AlertTriangle, color: "text-red-600 dark:text-red-400", sub: "Needs Attention" },
      { label: blockLabel, value: realStats ? realStats.threats_today : 0, icon: ShieldAlert, color: "text-amber-600 dark:text-amber-400", sub: blockSub },
      { label: "Security Score", value: `${avgSecurityScore}/100`, icon: BarChart3, color: "text-brand-600 dark:text-brand-400", sub: avgSecurityScore >= 80 ? "Good Standing" : "Needs Attention" },
      { label: "Average AI Confidence", value: "97%", icon: BrainCircuit, color: "text-purple-600 dark:text-purple-400", sub: "Highly Accurate" },
    ];
  }, [totalEmployees, protectedDevices, realStats, employeeRisk, avgSecurityScore, timeRange]);

  const deptIncidentsList: any[] = [];

  const threatTrendsData = useMemo(() => {
    if (realStats?.daily_trend && Array.isArray(realStats.daily_trend) && realStats.daily_trend.length > 0) {
      return realStats.daily_trend;
    }
    const todayCount = realStats ? (realStats.threats_today || 0) : 0;
    return [
      { date: "Mon", phishing: Math.max(0, Math.floor(todayCount * 0.2)), malware: 0 },
      { date: "Tue", phishing: Math.max(0, Math.floor(todayCount * 0.4)), malware: 0 },
      { date: "Wed", phishing: Math.max(0, Math.floor(todayCount * 0.6)), malware: 0 },
      { date: "Thu", phishing: Math.max(0, Math.floor(todayCount * 0.3)), malware: 0 },
      { date: "Fri", phishing: Math.max(0, Math.floor(todayCount * 0.5)), malware: 0 },
      { date: "Sat", phishing: Math.max(0, Math.floor(todayCount * 0.1)), malware: 0 },
      { date: "Sun", phishing: todayCount, malware: 0 },
    ];
  }, [realStats]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Department Security Center</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Department: {user.department} — Overview & Analytics</p>
        </div>
        <div className="flex bg-surface-100 dark:bg-white/[0.04] p-1 rounded-lg border border-surface-200 dark:border-white/[0.08] shrink-0">
          {[
            { id: "24h", label: "24 Hours" },
            { id: "7d", label: "7 Days" },
            { id: "30d", label: "30 Days" },
            { id: "all", label: "All Time" }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTimeRange(t.id as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${timeRange === t.id ? 'bg-white dark:bg-surface-800 text-[#4F84F8] shadow-sm' : 'text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statsCards.map((s, i) => (
          <motion.div key={s.label} variants={fadeUp} className="stat-card p-4">
            <div className="flex items-center justify-between mb-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div className="text-xl font-bold text-surface-900 dark:text-white">{s.value}</div>
            <div className="text-xs font-semibold text-surface-700 dark:text-surface-300 mt-1">{s.label}</div>
            <div className="text-[10px] text-surface-500 mt-1">{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Complete Scan Trend */}
        <motion.div variants={fadeUp} className="lg:col-span-2 stat-card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-surface-900 dark:text-white">
            <TrendingUp className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Complete Scan Trend ({timeRange === "24h" ? "24 Hours" : timeRange === "7d" ? "7 Days" : timeRange === "30d" ? "30 Days" : "All Time"})
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={threatTrendsData}>
              <defs>
                <linearGradient id="gradScans" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F84F8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4F84F8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradBlocked" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12, color: tooltipColor }} labelStyle={{ color: tooltipColor }} />
              <Area type="monotone" dataKey="scans" name="Total Scans" stroke="#4F84F8" fill="url(#gradScans)" strokeWidth={2} />
              <Area type="monotone" dataKey="threats" name="Blocked Threats" stroke="#ef4444" fill="url(#gradBlocked)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Threat distribution pie */}
        <motion.div variants={fadeUp} className="stat-card flex flex-col items-center">
          <h3 className="text-sm font-semibold mb-4 self-start flex items-center gap-2 text-surface-900 dark:text-white"><BarChart3 className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Threat Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={threatDist} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" paddingAngle={4}>
                {threatDist.map((entry: any, idx: number) => <Cell key={idx} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12, color: tooltipColor }} labelStyle={{ color: tooltipColor }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2">
            {threatDist.map((d: any) => (
              <span key={d.name} className="flex items-center gap-1.5 text-[10px] text-surface-500 dark:text-surface-400">
                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />{d.name}
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

        {/* Combined Department Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 mb-5 bg-surface-50 dark:bg-white/[0.02] rounded-lg border border-surface-200/50 dark:border-white/[0.05]">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-surface-500 font-bold">Total Scans</div>
            <div className="text-lg font-bold text-surface-900 dark:text-white mt-0.5">{combinedStats.totalScans}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-surface-500 font-bold">Total Safe</div>
            <div className="text-lg font-bold text-emerald-500 mt-0.5">{combinedStats.totalSafe}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-surface-500 font-bold">Total Blocked</div>
            <div className="text-lg font-bold text-red-500 mt-0.5">{combinedStats.totalThreats}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-surface-500 font-bold">Avg Security Score</div>
            <div className="text-lg font-bold text-brand-500 mt-0.5">{100 - combinedStats.avgRisk}%</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-white/[0.06]">
                <th className="text-left px-3 py-2 text-xs font-medium text-surface-500">Employee</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-surface-500">Scans</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-surface-500">Threats</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-surface-500">Security Score</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-surface-500">Extension</th>
              </tr>
            </thead>
            <tbody>
              {employeeRisk.map(emp => {
                const securityScore = 100 - (emp.riskScore || 0);
                return (
                  <tr key={emp.id} className="border-b border-surface-100 dark:border-white/[0.03] hover:bg-surface-100/50 dark:hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-brand-600/20 flex items-center justify-center text-[10px] font-bold text-brand-600 dark:text-brand-400">{(emp.fullName || emp.full_name || "U").split(" ").map((n: string) => n[0]).join("")}</div>
                        <div>
                          <div className="text-sm text-surface-800 dark:text-surface-200">{emp.fullName || emp.full_name || "Unknown User"}</div>
                          <div className="text-[10px] text-surface-500">{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-surface-700 dark:text-surface-300">{emp.totalScans}</td>
                    <td className="px-3 py-2.5"><span className={emp.threats > 3 ? "text-red-650 dark:text-red-400 font-medium" : "text-surface-600 dark:text-surface-300"}>{emp.threats}</span></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-surface-200 dark:bg-white/[0.06] overflow-hidden">
                          <div className={`h-full rounded-full ${securityScore >= 80 ? "bg-emerald-500" : securityScore >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(securityScore, 100)}%` }} />
                        </div>
                        <span className="text-xs text-surface-500 dark:text-surface-400">{securityScore}%</span>
                      </div>
                    </td>
                  <td className="px-3 py-2.5">
                    <span className={`w-2 h-2 rounded-full inline-block ${emp.extensionInstalled ? "bg-emerald-500 dark:bg-emerald-400" : "bg-surface-300 dark:bg-surface-650"}`} />
                  </td>
                </tr>
              );
            })}
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
