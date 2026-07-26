"use client";
import { useAuth } from "@/lib/auth-context";
import {
  ShieldCheck, AlertTriangle, ShieldAlert, CheckCircle2, Globe, FileText,
  Lock, BrainCircuit, Activity, ChevronRight, Server, Clock, Download, Image as ImageIcon, Scan,
  BarChart3, TrendingUp, CheckCircle, XCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Brush
} from "recharts";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
};
const stagger = { show: { transition: { staggerChildren: 0.05 } } };


const fallbackTrendData = [
  { name: 'Jul 01', scans: 120 }, { name: 'Jul 02', scans: 140 }, { name: 'Jul 03', scans: 110 }, { name: 'Jul 04', scans: 90 },
  { name: 'Jul 05', scans: 180 }, { name: 'Jul 06', scans: 250 }, { name: 'Jul 07', scans: 290 }, { name: 'Jul 08', scans: 310 },
  { name: 'Jul 09', scans: 340 }, { name: 'Jul 10', scans: 280 }, { name: 'Jul 11', scans: 260 }, { name: 'Jul 12', scans: 390 },
  { name: 'Jul 13', scans: 420 }, { name: 'Jul 14', scans: 380 }, { name: 'Jul 15', scans: 450 }, { name: 'Jul 16', scans: 480 },
  { name: 'Jul 17', scans: 500 }, { name: 'Jul 18', scans: 470 }, { name: 'Jul 19', scans: 520 }, { name: 'Jul 20', scans: 550 },
];

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"7d" | "14d" | "30d" | "all">("14d");
  const [analyticsTime, setAnalyticsTime] = useState<"today" | "all">("all");

  useEffect(() => {
    if (user?.email) {
      const fetchData = async () => {
        try {
          const res = await fetch(`http://localhost:8000/user/stats?email=${encodeURIComponent(user.email)}`);
          const json = await res.json();
          setData(json);
          setLoading(false);
        } catch (err) {
          console.error(err);
          setLoading(false);
        }
      };

      fetchData();
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (!user) return null;
  if (loading) return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 text-emerald-500 animate-spin" /></div>;

  const score = data?.healthScore || 98;
  const isProtected = score > 80;

  // Map backend stats to graphs
  const rawDistribution = [
    { name: 'URLs', value: data?.scanBreakdown?.url || 0, color: '#4F84F8' },
    { name: 'Images', value: data?.scanBreakdown?.image || 0, color: '#F59E0B' },
    { name: 'Downloads', value: data?.scanBreakdown?.attachment || 0, color: '#EF4444' },
    { name: 'Websites', value: data?.scanBreakdown?.website || 0, color: '#8B5CF6' }
  ].filter(d => d.value > 0);

  const threatDistribution = rawDistribution.length > 0 ? rawDistribution : [{ name: 'No Scans Yet', value: 1, color: '#334155' }];

  const recentScans = data?.scans || [];
  const last24HoursScans = recentScans.filter((scan: any) => {
    const scanTime = new Date(scan.timestamp).getTime();
    const now = new Date().getTime();
    return (now - scanTime) <= 24 * 60 * 60 * 1000;
  });

  const securityScore = Math.max(0, 100 - (last24HoursScans.filter((s: any) => s.decision === 'block').length * 2));

  const chartData = timeFilter === "7d" ? fallbackTrendData.slice(-7) : timeFilter === "14d" ? fallbackTrendData.slice(-14) : timeFilter === "30d" ? fallbackTrendData : fallbackTrendData;

  const urlScansToday = last24HoursScans.filter((s: any) => s.scanType === 'url' || !s.scanType);
  const webScansToday = last24HoursScans.filter((s: any) => s.scanType === 'website');
  const fileScansToday = last24HoursScans.filter((s: any) => s.scanType === 'attachment');
  const imageScansToday = last24HoursScans.filter((s: any) => s.scanType === 'image');

  const stats = {
    urls: {
      total: analyticsTime === 'today' ? urlScansToday.length : (data?.urlStats?.scanned || 0),
      blocked: analyticsTime === 'today' ? urlScansToday.filter((s: any) => s.decision === 'block').length : (data?.urlStats?.blocked || 0)
    },
    websites: {
      total: analyticsTime === 'today' ? webScansToday.length : (data?.webStats?.scanned || 0),
      blocked: analyticsTime === 'today' ? webScansToday.filter((s: any) => s.decision === 'block').length : (data?.webStats?.blocked || 0)
    },
    files: {
      total: analyticsTime === 'today' ? fileScansToday.length : (data?.fileStats?.downloaded || 0),
      blocked: analyticsTime === 'today' ? fileScansToday.filter((s: any) => s.decision === 'block').length : (data?.fileStats?.phishing || 0)
    },
    images: {
      total: analyticsTime === 'today' ? imageScansToday.length : (data?.scanBreakdown?.image || 0),
      blocked: analyticsTime === 'today' ? imageScansToday.filter((s: any) => s.decision === 'block').length : 0
    }
  };


  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-7xl mx-auto pb-10">

      {/* Header */}
      <motion.div variants={fadeUp} className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white tracking-tight">Personal Security Workspace</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Real-time protection and contextual AI analysis.</p>
        </div>
      </motion.div>

      {/* 1. Security Snapshot - Sleek 4 Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Status */}
        <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${securityScore >= 80 ? 'bg-emerald-500/10 text-emerald-500' : securityScore >= 50 ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
            {securityScore >= 80 ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-surface-500 mb-1">System Status</p>
            <h3 className="text-xl font-bold text-surface-900 dark:text-white">
              {securityScore >= 80 ? 'Protected' : securityScore >= 50 ? 'Active Threats' : 'At Risk'}
            </h3>
          </div>
        </motion.div>

        {/* Total Scans (24h) */}
        <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#4F84F8]/10 text-[#4F84F8] flex items-center justify-center shrink-0">
            <Scan className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-surface-500 mb-1">24h Scans</p>
            <h3 className="text-xl font-bold text-surface-900 dark:text-white">{last24HoursScans.length}</h3>
          </div>
        </motion.div>

        {/* Threats Blocked (24h) */}
        <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-surface-500 mb-1">24h Blocked</p>
            <h3 className="text-xl font-bold text-surface-900 dark:text-white">{last24HoursScans.filter((s: any) => s.decision === 'block').length}</h3>
          </div>
        </motion.div>

        {/* Security Score */}
        <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-surface-500 mb-1">Security Score</p>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-surface-900 dark:text-white">
                {securityScore}/100
              </h3>
              <div className="flex-1 h-1.5 bg-surface-200 dark:bg-white/[0.05] rounded-full overflow-hidden">
                <div className="h-full bg-purple-500" style={{ width: `${securityScore}%` }}></div>
              </div>
            </div>
          </div>
        </motion.div>

      </div>

      {/* Detailed Scan Analytics (Moved Up) */}
      <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex flex-col mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h3 className="text-lg font-bold text-surface-900 dark:text-white">Detailed Scan Analytics</h3>
          <div className="flex items-center gap-1 bg-surface-100 dark:bg-white/[0.02] p-1 rounded-lg border border-surface-200 dark:border-white/[0.05]">
            <button onClick={() => setAnalyticsTime("today")} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${analyticsTime === "today" ? "bg-white dark:bg-surface-800 text-[#4F84F8] shadow-sm border border-surface-200/50 dark:border-white/[0.08]" : "text-surface-500 hover:text-surface-900 dark:hover:text-white"}`}>Today</button>
            <button onClick={() => setAnalyticsTime("all")} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${analyticsTime === "all" ? "bg-white dark:bg-surface-800 text-[#4F84F8] shadow-sm border border-surface-200/50 dark:border-white/[0.08]" : "text-surface-500 hover:text-surface-900 dark:hover:text-white"}`}>All Time</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-50 dark:bg-white/[0.02] border border-surface-200 dark:border-white/[0.05] rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded bg-[#4F84F8]/10 text-[#4F84F8] flex items-center justify-center shrink-0"><Globe className="w-3 h-3" /></div>
              <span className="text-sm font-bold text-surface-900 dark:text-white">URLs</span>
            </div>
            <div>
              <div className="text-3xl font-black text-surface-900 dark:text-white">{stats.urls.total}</div>
              <div className="text-xs text-surface-500 mt-2 flex justify-between font-medium">
                <span className="text-emerald-500">{stats.urls.total - stats.urls.blocked} Safe</span>
                <span className="text-red-500">{stats.urls.blocked} Blocked</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-50 dark:bg-white/[0.02] border border-surface-200 dark:border-white/[0.05] rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center shrink-0"><ShieldCheck className="w-3 h-3" /></div>
              <span className="text-sm font-bold text-surface-900 dark:text-white">Websites</span>
            </div>
            <div>
              <div className="text-3xl font-black text-surface-900 dark:text-white">{stats.websites.total}</div>
              <div className="text-xs text-surface-500 mt-2 flex justify-between font-medium">
                <span className="text-emerald-500">{stats.websites.total - stats.websites.blocked} Safe</span>
                <span className="text-red-500">{stats.websites.blocked} Blocked</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-50 dark:bg-white/[0.02] border border-surface-200 dark:border-white/[0.05] rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded bg-[#EF4444]/10 text-[#EF4444] flex items-center justify-center shrink-0"><FileText className="w-3 h-3" /></div>
              <span className="text-sm font-bold text-surface-900 dark:text-white">Downloads</span>
            </div>
            <div>
              <div className="text-3xl font-black text-surface-900 dark:text-white">{stats.files.total}</div>
              <div className="text-xs text-surface-500 mt-2 flex justify-between font-medium">
                <span className="text-emerald-500">{stats.files.total - stats.files.blocked} Safe</span>
                <span className="text-red-500">{stats.files.blocked} Blocked</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-50 dark:bg-white/[0.02] border border-surface-200 dark:border-white/[0.05] rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center shrink-0"><ImageIcon className="w-3 h-3" /></div>
              <span className="text-sm font-bold text-surface-900 dark:text-white">Images</span>
            </div>
            <div>
              <div className="text-3xl font-black text-surface-900 dark:text-white">{stats.images.total}</div>
              <div className="text-xs text-surface-500 mt-2 flex justify-between font-medium">
                <span className="text-emerald-500">{stats.images.total - stats.images.blocked} Safe</span>
                <span className="text-red-500">{stats.images.blocked} Blocked</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Line Chart */}
        <motion.div variants={fadeUp} className="lg:col-span-2 rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex flex-col h-80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-surface-900 dark:text-white">Complete Scan Trend</h3>
            <div className="flex items-center gap-1 bg-surface-100 dark:bg-white/[0.02] p-1 rounded-lg border border-surface-200 dark:border-white/[0.05]">
              <button onClick={() => setTimeFilter("7d")} className={`px-3 py-1 text-xs font-bold rounded ${timeFilter === "7d" ? "bg-white dark:bg-surface-800 text-[#4F84F8] shadow-sm border border-surface-200/50 dark:border-white/[0.08]" : "text-surface-500"}`}>7D</button>
              <button onClick={() => setTimeFilter("14d")} className={`px-3 py-1 text-xs font-bold rounded ${timeFilter === "14d" ? "bg-white dark:bg-surface-800 text-[#4F84F8] shadow-sm border border-surface-200/50 dark:border-white/[0.08]" : "text-surface-500"}`}>14D</button>
              <button onClick={() => setTimeFilter("30d")} className={`px-3 py-1 text-xs font-bold rounded ${timeFilter === "30d" ? "bg-white dark:bg-surface-800 text-[#4F84F8] shadow-sm border border-surface-200/50 dark:border-white/[0.08]" : "text-surface-500"}`}>30D</button>
              <button onClick={() => setTimeFilter("all")} className={`px-3 py-1 text-xs font-bold rounded ${timeFilter === "all" ? "bg-white dark:bg-surface-800 text-[#4F84F8] shadow-sm border border-surface-200/50 dark:border-white/[0.08]" : "text-surface-500"}`}>ALL</button>
            </div>
          </div>
          <div className="w-full flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F84F8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4F84F8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} />
                <Tooltip contentStyle={{ backgroundColor: '#141A29', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                <Area type="monotone" dataKey="scans" stroke="#4F84F8" strokeWidth={3} fillOpacity={1} fill="url(#colorScans)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Threat Distribution */}
        <motion.div variants={fadeUp} className="lg:col-span-1 rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex flex-col h-80">
          <h3 className="text-sm font-bold text-surface-900 dark:text-white mb-4">Threat Distribution</h3>
          <div className="w-full flex-1 relative min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={threatDistribution} innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                  {threatDistribution.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#141A29', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-6">

        {/* Real-time Threat Feed */}
        <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 h-96 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-surface-900 dark:text-white">Real-Time Threat Feed</h3>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">Showing all scans from the last 24 hours</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs text-surface-500 font-bold tracking-widest uppercase">Live</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-6 relative before:absolute before:inset-0 before:ml-[15px] before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-surface-200 dark:before:via-white/[0.05] before:to-transparent">

            {last24HoursScans.length === 0 ? (
              <div className="text-center text-sm text-surface-500 py-4">Waiting for incoming activity...</div>
            ) : (
              last24HoursScans.map((scan: any, i: number) => {
                const isBlock = scan.decision === 'block';
                const isSafe = scan.decision === 'allow' || scan.decision === 'safe';
                const isDownload = scan.scanType === 'attachment';
                const timeStr = new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={scan.id || i} className="relative flex items-center justify-between group is-active pl-8">
                    <div className={`absolute left-0 flex items-center justify-center w-8 h-8 rounded-full border-4 border-white dark:border-[#141A29] text-white shadow shrink-0 z-10 ${isBlock ? 'bg-red-500' : isSafe ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                      {isBlock ? <ShieldAlert className="w-3 h-3" /> : isDownload ? <FileText className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                    </div>
                    <div className={`w-full p-4 rounded-xl border ${isBlock ? 'border-red-500/20 bg-red-500/5' : 'border-surface-200 dark:border-white/[0.05] bg-surface-50 dark:bg-white/[0.02]'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold ${isBlock ? 'text-red-500' : isSafe ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {isBlock ? 'Threat Blocked' : scan.scanType === 'text' ? 'Text Scanned' : scan.scanType === 'image' ? 'Image Scanned' : scan.scanType === 'document' || scan.scanType === 'attachment' ? 'File Scanned' : 'URL Scanned'}
                        </span>
                        <span className="text-[10px] font-mono text-surface-400">{timeStr}</span>
                      </div>
                      <div className="text-xs text-surface-600 dark:text-surface-400 truncate w-full">
                        {scan.inputPreview ? scan.inputPreview.trim() : scan.domain || 'Local event'}
                      </div>
                      <div className="text-[10px] text-surface-500 mt-1 font-mono">
                        Risk {scan.riskScore}% • {isBlock ? 'Blocked' : 'Allowed'} • AI Conf {100 - (scan.riskScore || 0)}%
                      </div>
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
