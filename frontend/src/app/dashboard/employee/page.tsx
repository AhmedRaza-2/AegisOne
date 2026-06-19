"use client";
import { useAuth } from "@/lib/auth-context";
import { scanHistory, getUserStats, modelHealth } from "@/lib/mock-data";
import { ShieldCheck, ShieldAlert, Scan, BarChart3, Clock, TrendingUp, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
};
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

function RiskBadge({ level }: { level: string }) {
  if (level === "safe") return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><CheckCircle className="w-3 h-3" />Safe</span>;
  if (level === "suspicious") return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400"><AlertTriangle className="w-3 h-3" />Suspicious</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-650 dark:text-red-400"><XCircle className="w-3 h-3" />Danger</span>;
}

function ScanTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = { 
    email: "bg-blue-500/10 text-blue-600 dark:text-blue-400", 
    url: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400", 
    text: "bg-purple-500/10 text-purple-600 dark:text-purple-400", 
    image: "bg-pink-500/10 text-pink-650 dark:text-pink-400", 
    attachment: "bg-amber-500/10 text-amber-600 dark:text-amber-400" 
  };
  return <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${colors[type] || "bg-surface-200 text-surface-700 dark:bg-surface-700 dark:text-surface-300"}`}>{type}</span>;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  if (!user) return null;

  const stats = useMemo(() => getUserStats(user.id), [user.id]);
  const myScans = useMemo(() => scanHistory.filter(s => s.userId === user.id).slice(0, 8), [user.id]);
  const shieldScore = stats.safeRate;

  const statsCards = useMemo(() => {
    return [
      { label: "Total Scans", value: stats.totalScans.toLocaleString(), icon: Scan, color: "text-brand-600 dark:text-brand-400" },
      { label: "Threats Blocked", value: stats.threatsBlocked.toString(), icon: ShieldAlert, color: "text-red-650 dark:text-red-400" },
      { label: "Safe Rate", value: `${stats.safeRate}%`, icon: TrendingUp, color: "text-emerald-650 dark:text-emerald-400" },
      { label: "Last Scan", value: stats.lastScan ? timeAgo(stats.lastScan) : "N/A", icon: Clock, color: "text-amber-650 dark:text-amber-400" },
    ];
  }, [stats]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Page header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Welcome back, {user.fullName.split(" ")[0]}</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Your personal security overview</p>
      </motion.div>

      {/* Shield + Stats row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Shield gauge card */}
        <motion.div variants={fadeUp} className="lg:col-span-1 stat-card flex flex-col items-center justify-center py-8">
          <div className="relative w-32 h-32 mb-4">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(0,0,0,0.04)" className="dark:stroke-white/[0.04]" strokeWidth="8" />
              <circle cx="60" cy="60" r="52" fill="none" stroke={shieldScore >= 80 ? "#22c55e" : shieldScore >= 50 ? "#f59e0b" : "#ef4444"} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${shieldScore * 3.27} 327`} className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mb-1" />
              <span className="text-2xl font-bold text-surface-900 dark:text-white">{shieldScore}%</span>
              <span className="text-[10px] text-surface-500 dark:text-surface-400 uppercase tracking-wider">Protected</span>
            </div>
          </div>
          <p className="text-sm text-surface-600 dark:text-surface-400">Your Shield Status</p>
        </motion.div>

        {/* Stats cards */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {statsCards.map((s, i) => (
            <motion.div key={s.label} variants={fadeUp} className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div className="text-2xl font-bold text-surface-900 dark:text-white">{s.value}</div>
              <div className="text-xs text-surface-500 mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* AI Models Status (compact) */}
      <motion.div variants={fadeUp} className="stat-card">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-surface-900 dark:text-white"><BarChart3 className="w-4 h-4 text-brand-650 dark:text-brand-400" /> AI Engine Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {modelHealth.map(m => (
            <div key={m.key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-100/50 dark:bg-white/[0.02]">
              <span className={`w-2 h-2 rounded-full ${m.status === "online" ? "bg-emerald-500 dark:bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
              <span className="text-xs text-surface-700 dark:text-surface-300">{m.name}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={fadeUp} className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white"><Clock className="w-4 h-4 text-brand-650 dark:text-brand-400" /> Recent Scans</h3>
          <button onClick={() => window.location.href = "/dashboard/employee/history"} className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors">History →</button>
        </div>
        <div className="space-y-3">
          {myScans.map(scan => (
            <div key={scan.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-100/50 dark:bg-white/[0.01] border border-surface-200/50 dark:border-white/[0.03]">
              <div className="flex items-center gap-3">
                <ScanTypeBadge type={scan.scanType} />
                <div>
                  <div className="text-sm font-medium text-surface-800 dark:text-surface-200 max-w-[200px] md:max-w-md truncate">{scan.inputPreview}</div>
                  <div className="text-[10px] text-surface-500">{new Date(scan.timestamp).toLocaleString()}</div>
                </div>
              </div>
              <RiskBadge level={scan.riskLevel} />
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
