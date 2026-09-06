"use client";
import { useAuth } from "@/lib/auth-context";
import {
  ShieldCheck, AlertTriangle, ShieldAlert, CheckCircle2, Globe, FileText,
  Lock, BrainCircuit, Activity, ChevronRight, Server, Clock, Download, Image as ImageIcon, Scan,
  BarChart3, TrendingUp, CheckCircle, XCircle, RefreshCw, Mail
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

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("24h");
  const [distType, setDistType] = useState<"scans" | "blocked" | "safe">("scans");

  const fetchData = async (isManual = false) => {
    if (!user?.email) return;
    if (isManual) setRefreshing(true);
    const cacheKey = `emp_stats_${user.email}`;
    try {
      const res = await fetch(`http://localhost:8000/user/stats?email=${encodeURIComponent(user.email)}`);
      const json = await res.json();
      setData(json);
      localStorage.setItem(cacheKey, JSON.stringify(json));
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    } finally {
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.email) {
      const cacheKey = `emp_stats_${user.email}`;
      const cached = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
      if (cached) {
        try {
          setData(JSON.parse(cached));
          setLoading(false);
        } catch (e) { }
      }

      fetchData();
      const interval = setInterval(() => fetchData(false), 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const recentScans = data?.scans || [];
  const filteredScans = recentScans.filter((scan: any) => {
    const scanTime = new Date(scan.timestamp).getTime();
    const now = new Date().getTime();
    const diff = now - scanTime;
    if (timeRange === "24h") return diff <= 24 * 60 * 60 * 1000;
    if (timeRange === "7d") return diff <= 7 * 24 * 60 * 60 * 1000;
    if (timeRange === "30d") return diff <= 30 * 24 * 60 * 60 * 1000;
    return true; // all
  });

  const urlScans = filteredScans.filter((s: any) => s.scanType === 'url');
  const webScans = filteredScans.filter((s: any) => s.scanType === 'website' || s.scanType === 'navigation' || (!s.scanType && (s.inputPreview?.startsWith('http://') || s.inputPreview?.startsWith('https://') || s.domain)));
  const fileScans = filteredScans.filter((s: any) => s.scanType === 'attachment' || s.scanType === 'document');
  const imageScans = filteredScans.filter((s: any) => s.scanType === 'image');
  const emailScans = filteredScans.filter((s: any) => 
    s.scanType === 'email' || 
    s.scanType === 'mail' || 
    s.scanType === 'text' || 
    s.domain === 'email_scan' || 
    s.domain === 'text_scan' || 
    s.inputPreview?.startsWith('Email:') || 
    s.inputPreview?.startsWith('Text Snippet:') ||
    (s.inputPreview && (s.inputPreview.includes('mail.google.com') || s.inputPreview.includes('outlook.')))
  );

  const emailCountFromBackend = data?.scanBreakdown?.email || 0;
  const emailScansTotal = Math.max(emailScans.length, emailCountFromBackend);
  // Simple sum of all typed scans - no double counting
  const totalScans = urlScans.length + webScans.length + fileScans.length + imageScans.length + emailScansTotal;
  // Count both warn and block as "threats" (consistent with admin/backend definition)
  const blockedScans = filteredScans.filter((s: any) => s.decision === 'block' || s.decision === 'warn').length;
  // Use backend health score if available, fallback to simple formula
  const securityScore = data?.healthScore ?? Math.max(0, 100 - (blockedScans * 2));

  const stats = {
    urls: {
      total: urlScans.length,
      blocked: urlScans.filter((s: any) => s.decision === 'block' || s.decision === 'warn').length
    },
    websites: {
      total: webScans.length,
      blocked: webScans.filter((s: any) => s.decision === 'block' || s.decision === 'warn').length
    },
    files: {
      total: fileScans.length,
      blocked: fileScans.filter((s: any) => s.decision === 'block' || s.decision === 'warn').length
    },
    images: {
      total: imageScans.length,
      blocked: imageScans.filter((s: any) => s.decision === 'block' || s.decision === 'warn').length
    },
    emails: {
      total: emailScansTotal,
      blocked: emailScans.filter((s: any) => s.decision === 'block' || s.decision === 'warn').length
    }
  };

  const scanBreakdown = useMemo(() => {
    if (distType === "blocked") {
      return {
        url: urlScans.filter((s: any) => s.decision === 'block' || s.decision === 'warn').length,
        image: imageScans.filter((s: any) => s.decision === 'block' || s.decision === 'warn').length,
        attachment: fileScans.filter((s: any) => s.decision === 'block' || s.decision === 'warn').length,
        website: webScans.filter((s: any) => s.decision === 'block' || s.decision === 'warn').length,
        email: emailScans.filter((s: any) => s.decision === 'block' || s.decision === 'warn').length
      };
    } else if (distType === "safe") {
      return {
        url: urlScans.filter((s: any) => s.decision !== 'block' && s.decision !== 'warn').length,
        image: imageScans.filter((s: any) => s.decision !== 'block' && s.decision !== 'warn').length,
        attachment: fileScans.filter((s: any) => s.decision !== 'block' && s.decision !== 'warn').length,
        website: webScans.filter((s: any) => s.decision !== 'block' && s.decision !== 'warn').length,
        email: emailScans.filter((s: any) => s.decision !== 'block' && s.decision !== 'warn').length
      };
    }
    return {
      url: urlScans.length,
      image: imageScans.length,
      attachment: fileScans.length,
      website: webScans.length,
      email: emailScansTotal
    };
  }, [urlScans, imageScans, fileScans, webScans, emailScans, emailScansTotal, distType]);

  const rawDistribution = [
    { name: 'Emails', value: scanBreakdown.email, color: '#6366F1' },
    { name: 'URLs', value: scanBreakdown.url, color: '#4F84F8' },
    { name: 'Images', value: scanBreakdown.image, color: '#F59E0B' },
    { name: 'Downloads', value: scanBreakdown.attachment, color: '#EF4444' },
    { name: 'Websites', value: scanBreakdown.website, color: '#8B5CF6' }
  ].filter(d => d.value > 0);

  const threatDistribution = rawDistribution.length > 0 ? rawDistribution : [{ name: 'No Scans Yet', value: 1, color: '#334155' }];

  const chartData = useMemo(() => {
    const hours = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    return hours.map(dateStr => {
      const dayScans = filteredScans.filter((s: any) => s.timestamp?.startsWith(dateStr));
      const blocked = dayScans.filter((s: any) => s.decision === 'block').length;
      const safe = dayScans.length - blocked;
      const label = new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return { label, total: dayScans.length, safe, blocked };
    });
  }, [filteredScans]);

  if (!user) return null;
  if (loading && !data) return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 text-emerald-500 animate-spin" /></div>;

  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-6 max-w-7xl mx-auto pb-12">

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#141A29] p-6 rounded-xl border border-surface-200 dark:border-white/[0.04]">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white tracking-tight">Personal Security Workspace</h1>
          <p className="text-xs text-surface-500 mt-1">Real-time protection and contextual AI analysis.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-white/[0.05] text-xs font-semibold text-surface-700 dark:text-surface-300 hover:bg-surface-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          <div className="flex items-center gap-1 bg-surface-100 dark:bg-white/[0.03] p-1 rounded-xl border border-surface-200 dark:border-white/[0.05]">
            {(["24h", "7d", "30d", "all"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${timeRange === r ? "bg-white dark:bg-white/10 text-surface-900 dark:text-white shadow-sm" : "text-surface-500 hover:text-surface-900 dark:hover:text-white"
                  }`}
              >
                {r === "24h" ? "24 Hours" : r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "All Time"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top Metric Cards (Status & Security Score) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* System Status */}
        <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${securityScore >= 80 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
            {securityScore >= 80 ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-surface-500 mb-1">System Status</p>
            <h3 className="text-xl font-bold text-surface-900 dark:text-white">{securityScore >= 80 ? "Protected" : "At Risk"}</h3>
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
              <h3 className="text-xl font-bold text-surface-900 dark:text-white">{securityScore}/100</h3>
              <div className="flex-1 h-1.5 bg-surface-200 dark:bg-white/[0.05] rounded-full overflow-hidden">
                <div className="h-full bg-purple-500" style={{ width: `${securityScore}%` }}></div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Detailed Scan Analytics */}
      <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex flex-col mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 border-b border-surface-200 dark:border-white/[0.04] pb-4">
          <div>
            <h3 className="text-lg font-bold text-surface-900 dark:text-white">Detailed Scan Analytics</h3>
            <p className="text-xs text-surface-500 mt-1">Breakdown of all scanned telemetry</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider block">Total Scans</span>
              <span className="text-lg font-black text-surface-900 dark:text-white">{totalScans}</span>
            </div>
            <div className="w-px h-8 bg-surface-250 dark:bg-white/[0.08]" />
            <div className="text-right">
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider block text-emerald-500">Total Safe</span>
              <span className="text-lg font-black text-emerald-500">{totalScans - blockedScans}</span>
            </div>
            <div className="w-px h-8 bg-surface-250 dark:bg-white/[0.08]" />
            <div className="text-right">
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider block text-red-500">Total Blocked</span>
              <span className="text-lg font-black text-red-500">{blockedScans}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Email Card */}
          <div 
            onClick={() => window.location.href = '/dashboard/employee/email'}
            className="bg-indigo-50/50 dark:bg-indigo-500/[0.04] border border-indigo-200 dark:border-indigo-500/20 rounded-xl p-4 flex flex-col justify-between cursor-pointer hover:border-indigo-500/50 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><Mail className="w-3 h-3" /></div>
                <span className="text-sm font-bold text-surface-900 dark:text-white">Email</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-indigo-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <div className="text-3xl font-black text-surface-900 dark:text-white">{stats.emails.total}</div>
              <div className="text-xs text-surface-500 mt-2 flex justify-between font-medium">
                <span className="text-emerald-500">{stats.emails.total - stats.emails.blocked} Safe</span>
                <span className="text-red-500">{stats.emails.blocked} Blocked</span>
              </div>
            </div>
          </div>

          {/* URLs Card */}
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

          {/* Websites Card */}
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

          {/* Downloads Card */}
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

          {/* Images Card */}
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
          </div>
          <div className="w-full flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F84F8" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#4F84F8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} />
                <Tooltip contentStyle={{ backgroundColor: '#141A29', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                <Area type="monotone" name="Total Scans" dataKey="total" stroke="#4F84F8" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                <Area type="monotone" name="Blocked Threats" dataKey="blocked" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorBlocked)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Threat Distribution */}
        <motion.div variants={fadeUp} className="lg:col-span-1 rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex flex-col h-80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-surface-900 dark:text-white">Distribution</h3>
            <div className="flex bg-surface-100 dark:bg-white/[0.02] p-0.5 rounded-md border border-surface-200 dark:border-white/[0.05] shrink-0">
              {[
                { id: "scans", label: "Scans" },
                { id: "safe", label: "Safe" },
                { id: "blocked", label: "Blocked" }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setDistType(opt.id as any)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${distType === opt.id ? 'bg-white dark:bg-surface-800 text-[#4F84F8] shadow-sm' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
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
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                {timeRange === "24h" ? "Showing all scans from the last 24 hours" : timeRange === "7d" ? "Showing all scans from the last 7 days" : timeRange === "30d" ? "Showing all scans from the last 30 days" : "Showing all scans"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs text-surface-500 font-bold tracking-widest uppercase">Live</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-6 relative before:absolute before:inset-0 before:ml-[15px] before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-surface-200 dark:before:via-white/[0.05] before:to-transparent">

            {filteredScans.length === 0 ? (
              <div className="text-center text-sm text-surface-500 py-4">Waiting for incoming activity...</div>
            ) : (
              filteredScans.map((scan: any, i: number) => {
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

