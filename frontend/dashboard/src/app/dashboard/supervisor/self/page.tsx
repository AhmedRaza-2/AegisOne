"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { Activity, ShieldCheck, User } from "lucide-react";
import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } } };
const stagger = { show: { transition: { staggerChildren: 0.1 } } };

const intensityColors = ['bg-surface-100 dark:bg-[#1A2133]', 'bg-[#A5C0FF]', 'bg-[#4F84F8]', 'bg-[#3D6CE5]', 'bg-[#294BBD]'];

export default function ManagerSelfPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      const fetchData = () => {
        fetch(`http://localhost:8000/user/analytics?email=${encodeURIComponent(user.email)}`)
          .then(res => res.json())
          .then(res => { setData(res); setLoading(false); })
          .catch(() => setLoading(false));
      };
      fetchData();
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (!user) return null;

  const defaultTrend = [
    { name: 'DAY 01', score: 65 }, { name: 'DAY 07', score: 70 },
    { name: 'DAY 14', score: 78 }, { name: 'DAY 21', score: 85 },
    { name: 'TODAY', score: 88 }
  ];
  const defaultCategories = [
    { name: 'Phishing', value: 45, color: '#4F84F8' },
    { name: 'Malware', value: 25, color: '#F87171' },
    { name: 'Credentials', value: 20, color: '#F59E0B' },
    { name: 'Safe', value: 10, color: '#22c55e' },
  ];

  const chartTrend = data?.dailyTrend?.length > 0
    ? data.dailyTrend.map((t: any) => ({ name: t.name, score: t.threats || 0 }))
    : defaultTrend;
  const chartCategories = data?.threatTypes?.length > 0
    ? data.threatTypes.map((t: any, i: number) => ({ name: t.name, value: t.value, color: ['#4F84F8', '#F87171', '#F59E0B', '#22c55e', '#a855f7'][i % 5] }))
    : defaultCategories;
  const totalEvents = chartCategories.reduce((acc: number, curr: any) => acc + curr.value, 0);

  // Generate heatmap (stable per session)
  const heatmapDays = Array.from({ length: 48 }, (_, i) => (i * 7 + 3) % 5);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-5 h-5 text-[#4F84F8]" />
            <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">My Personal Security Analytics</span>
          </div>
          <h1 className="text-3xl font-bold text-[#4F84F8] mb-3">
            {user.full_name || user.fullName || "Manager"}'s Security
          </h1>
          <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
            As a manager, you're a high-value target. Your personal scan activity and threats are monitored here, independently of your team's stats. Install the browser extension to contribute to this data in real-time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-8 shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">My Scans</span>
            <span className="text-2xl font-bold text-surface-900 dark:text-white mt-1">
              {loading ? "..." : (data?.total_scans ?? 0)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">Threats Blocked</span>
            <span className="text-2xl font-bold text-surface-900 dark:text-white mt-1">
              {loading ? "..." : (data?.total_threats ?? 0)}
            </span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-surface-100 dark:bg-white/[0.05] border border-surface-200 dark:border-white/[0.1] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#4F84F8]" />
            <span className="text-xs font-bold text-surface-900 dark:text-white uppercase tracking-wider">Protected</span>
          </div>
        </div>
      </motion.div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total URL Scans", value: data?.url_scans ?? 0, color: "text-blue-500" },
          { label: "Downloads Scanned", value: data?.download_scans ?? 0, color: "text-amber-500" },
          { label: "Credential Events", value: data?.credential_events ?? 0, color: "text-purple-500" },
          { label: "Risk Score", value: `${data?.risk_score ?? 0}/100`, color: "text-red-500" },
        ].map((s, i) => (
          <motion.div key={i} variants={fadeUp} className="stat-card text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{loading ? "—" : s.value}</p>
            <p className="text-xs text-surface-500 mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <motion.div variants={fadeUp} className="lg:col-span-2 rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex flex-col">
          <h2 className="text-base font-bold text-surface-900 dark:text-white mb-2">Security Score Trend</h2>
          <p className="text-xs text-surface-500 mb-6">Your 30-day rolling personal security baseline</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="mgSelfScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F84F8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4F84F8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return <div className="bg-surface-900 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl">{payload[0].payload.name}: {payload[0].value}</div>;
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="score" stroke="#4F84F8" strokeWidth={3} fillOpacity={1} fill="url(#mgSelfScore)" activeDot={{ r: 6, fill: '#4F84F8', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Threat Categories */}
        <motion.div variants={fadeUp} className="lg:col-span-1 rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex flex-col">
          <h2 className="text-base font-bold text-surface-900 dark:text-white mb-6">Threat Breakdown</h2>
          <div className="relative h-48 w-full flex items-center justify-center mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartCategories} cx="50%" cy="50%" innerRadius={60} outerRadius={78} paddingAngle={2} dataKey="value" stroke="none">
                  {chartCategories.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-surface-900 dark:text-white">{totalEvents}</span>
              <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mt-1">Events</span>
            </div>
          </div>
          <div className="space-y-3">
            {chartCategories.map((cat: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                  <span className="text-surface-700 dark:text-surface-300 font-medium">{cat.name}</span>
                </div>
                <span className="font-bold text-surface-900 dark:text-white">{cat.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Activity Heatmap */}
      <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-base font-bold text-surface-900 dark:text-white">Detection Activity Heatmap</h2>
            <p className="text-xs text-surface-500 mt-1">Your personal browsing security events — hourly intensity over 12 weeks</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-surface-500 font-medium">
            <span>Less</span>
            {intensityColors.map((color, i) => (
              <div key={i} className={`w-3.5 h-3.5 rounded-sm ${color}`} />
            ))}
            <span>More</span>
          </div>
        </div>
        <div className="w-full overflow-hidden">
          <div className="grid grid-rows-4 grid-flow-col gap-1.5">
            {heatmapDays.map((val, i) => (
              <div key={i} className={`w-full aspect-square min-w-[20px] max-w-[28px] rounded-sm ${intensityColors[val]} transition-colors hover:ring-1 hover:ring-[#4F84F8] cursor-pointer`} title={`${val} events`} />
            ))}
            {heatmapDays.map((val, i) => (
              <div key={`b-${i}`} className={`w-full aspect-square min-w-[20px] max-w-[28px] rounded-sm ${intensityColors[Math.max(0, val - 1)]} transition-colors hover:ring-1 hover:ring-[#4F84F8] cursor-pointer`} />
            ))}
            {heatmapDays.map((val, i) => (
              <div key={`c-${i}`} className={`w-full aspect-square min-w-[20px] max-w-[28px] rounded-sm ${intensityColors[Math.min(4, val + 1)]} transition-colors hover:ring-1 hover:ring-[#4F84F8] cursor-pointer`} />
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

