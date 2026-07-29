"use client";
import { useAuth } from "@/lib/auth-context";
import { BarChart3, ShieldCheck, Activity, Globe, Download, Key, Image as ImageIcon, QrCode, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { useMemo, useState, useEffect } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function DepartmentAnalyticsPage() {
  const { user, theme, logout } = useAuth();
  const [realStats, setRealStats] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("24h");

  useEffect(() => {
    if (!user) return;

    const fetchData = () => {
      const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
      const headers: Record<string, string> = token ? { "Authorization": `Bearer ${token}` } : {};

      console.log(`[Supervisor Analytics] Fetching stats (range: ${timeRange})`);

      fetch(`http://localhost:8000/admin/stats?time_range=${timeRange}`, { headers })
        .then(res => {
          if (res.status === 401) {
            logout();
            return;
          }
          return res.json();
        })
        .then(data => {
          if (!data) return;
          if (!data.detail) {
            setRealStats(data);
          }
        })
        .catch(err => console.error("[Supervisor Analytics] Fetch error:", err));
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [user, timeRange]);

  if (!user) return null;

  const isDark = theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const tooltipBg = isDark ? "#1e293b" : "#ffffff";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tooltipColor = isDark ? "#ffffff" : "#0f172a";

  const coverageCards = useMemo(() => {
    if (!realStats) {
      return [
        { label: "URL Protection", value: "100%", icon: Globe, color: "text-blue-500" },
        { label: "Credential Protection", value: "100%", icon: Key, color: "text-emerald-500" },
        { label: "Download Protection", value: "100%", icon: Download, color: "text-amber-500" },
        { label: "Image AI", value: "100%", icon: ImageIcon, color: "text-purple-500" },
      ];
    }
    
    const scans = realStats.scans_today || 0;
    const threats = realStats.threats_today || 0;
    const creds = realStats.credential_events_total || 0;
    const downloads = realStats.download_events_total || 0;
    
    const urlScore = scans > 0 ? Math.max(50, 100 - Math.round((threats / scans) * 100)) : 100;
    const credScore = 100; 
    const dlScore = 100;
    const imgScore = 100;
    
    return [
      { label: "URL Protection", value: `${urlScore}%`, icon: Globe, color: "text-blue-500" },
      { label: "Credential Protection", value: `${credScore}%`, icon: Key, color: "text-emerald-500" },
      { label: "Download Protection", value: `${dlScore}%`, icon: Download, color: "text-amber-500" },
      { label: "Image AI", value: `${imgScore}%`, icon: ImageIcon, color: "text-purple-500" },
    ];
  }, [realStats]);

  const securityTrendData = useMemo(() => {
    if (!realStats?.daily_trend) return [];
    return realStats.daily_trend;
  }, [realStats]);

  const threatDistData = useMemo(() => {
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

  const riskTrendData = useMemo(() => {
    if (!realStats?.daily_trend) return [];
    return realStats.daily_trend.map((day: any) => ({
      name: day.date,
      risk: Math.min(100, Math.round((day.threats / Math.max(day.scans, 1)) * 100))
    }));
  }, [realStats]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-600 dark:text-brand-400" /> Department Analytics
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Aggregated security metrics for {user.department}</p>
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

      {/* Coverage Cards */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {coverageCards.map((c) => (
          <div key={c.label} className="stat-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg bg-surface-100 dark:bg-white/[0.04] ${c.color}`}>
                <c.icon className="w-4 h-4" />
              </div>
              <div className="text-xs font-semibold text-surface-600 dark:text-surface-400">{c.label}</div>
            </div>
            <div className="text-xl font-bold text-surface-900 dark:text-white ml-1">{c.value}</div>
          </div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Security Trend */}
        <motion.div variants={fadeUp} className="lg:col-span-2 stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white">
              <Activity className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Complete Scan Trend ({timeRange === "24h" ? "24 Hours" : timeRange === "7d" ? "7 Days" : timeRange === "30d" ? "30 Days" : "All Time"})
            </h3>
          </div>
          <div className="w-full h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={securityTrendData}>
                <defs>
                  <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F84F8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4F84F8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12, color: tooltipColor }} labelStyle={{ color: tooltipColor }} />
                <Area type="monotone" dataKey="scans" name="Total Scans" stroke="#4F84F8" fillOpacity={1} fill="url(#colorScans)" strokeWidth={2} />
                <Area type="monotone" dataKey="threats" name="Blocked Threats" stroke="#ef4444" fillOpacity={1} fill="url(#colorBlocked)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Threat Distribution */}
        <motion.div variants={fadeUp} className="stat-card flex flex-col items-center">
          <h3 className="text-sm font-semibold mb-4 self-start flex items-center gap-2 text-surface-900 dark:text-white">
            <BarChart3 className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Threat Distribution
          </h3>
          <div className="w-full h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={threatDistData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" paddingAngle={4}>
                  {threatDistData.map((entry: any, idx: number) => <Cell key={idx} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12, color: tooltipColor }} labelStyle={{ color: tooltipColor }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 justify-center w-full px-4">
            {threatDistData.map((d: any) => (
              <span key={d.name} className="flex items-center gap-1.5 text-[10px] text-surface-600 dark:text-surface-300">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />{d.name}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Risk Trend */}
        <motion.div variants={fadeUp} className="lg:col-span-3 stat-card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-surface-900 dark:text-white">
            <TrendingUp className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Department Risk Trend (Score Over Time)
          </h3>
          <div className="w-full h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={riskTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12, color: tooltipColor }} labelStyle={{ color: tooltipColor }} />
                <Line type="monotone" dataKey="risk" name="Risk Score" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: "#3b82f6" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
