"use client";
import { useAuth } from "@/lib/auth-context";
import { modelHealth } from "@/lib/mock-data";
import { ShieldCheck, ShieldAlert, Scan, BarChart3, Clock, TrendingUp, AlertTriangle, CheckCircle, XCircle, Search, Laptop, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState, useEffect } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
};
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

// Parse UTC string correctly to local date
function parseLocalDate(dateStr: string) {
  if (!dateStr) return new Date();
  if (!dateStr.endsWith("Z") && !dateStr.includes("+")) {
    dateStr += "Z"; // Assume UTC if no timezone is provided by sqlite
  }
  return new Date(dateStr);
}

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
  const diff = Date.now() - parseLocalDate(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [dbStats, setDbStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVerdict, setFilterVerdict] = useState("all");
  const [filterDate, setFilterDate] = useState("all"); // 'all', 'today', 'week'
  const [selectedScan, setSelectedScan] = useState<any>(null);

  useEffect(() => {
    if (user?.email) {
      fetch(`http://localhost:9000/user/stats?email=${encodeURIComponent(user.email)}`)
        .then(res => res.json())
        .then(data => setDbStats(data))
        .catch(console.error);
    }
  }, [user]);

  if (!user) return null;

  const stats = useMemo(() => {
    if (dbStats) return dbStats;
    return {
      totalScans: 0,
      threatsBlocked: 0,
      safeRate: 100,
      lastScan: null,
      scans: []
    };
  }, [dbStats]);

  const myScans = stats.scans || [];
  const shieldScore = stats.safeRate || 100;

  const statsCards = useMemo(() => {
    return [
      { label: "Total Scans", value: stats.totalScans.toLocaleString(), icon: Scan, color: "text-brand-600 dark:text-brand-400" },
      { label: "Threats Blocked", value: stats.threatsBlocked.toString(), icon: ShieldAlert, color: "text-red-650 dark:text-red-400" },
      { label: "Safe Rate", value: `${stats.safeRate}%`, icon: TrendingUp, color: "text-emerald-650 dark:text-emerald-400" },
      { label: "Last Scan", value: stats.lastScan ? timeAgo(stats.lastScan) : "N/A", icon: Clock, color: "text-amber-650 dark:text-amber-400" },
    ];
  }, [stats]);

  // Client-side filtering
  const filteredScans = useMemo(() => {
    let result = [...myScans];

    // Verdict filter
    if (filterVerdict !== "all") {
      result = result.filter(s => filterVerdict === "phishing" ? s.riskLevel !== "safe" : s.riskLevel === "safe");
    }

    // Date filter
    if (filterDate !== "all") {
      const now = new Date();
      result = result.filter(s => {
        const d = parseLocalDate(s.timestamp);
        if (filterDate === "today") {
          return d.toDateString() === now.toDateString();
        }
        if (filterDate === "week") {
          const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
          return diffDays <= 7;
        }
        return true;
      });
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => 
        (s.domain || "").toLowerCase().includes(q) || 
        (s.inputPreview || "").toLowerCase().includes(q) ||
        (s.scanType || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [myScans, searchQuery, filterVerdict, filterDate]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Page header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Welcome back, {(user?.fullName || user?.full_name || "User").split(" ")[0]}</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Your personal security overview</p>
      </motion.div>

      {/* Module 1: Dashboard Overview, Health Score, and AI Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Module 21: Security Health Score */}
        <motion.div variants={fadeUp} className="lg:col-span-1 stat-card flex flex-col items-center justify-center py-8">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-white mb-6 self-start px-2">Security Score</h2>
          <div className="relative w-36 h-36 mb-4">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(0,0,0,0.04)" className="dark:stroke-white/[0.04]" strokeWidth="10" />
              <circle cx="60" cy="60" r="52" fill="none" 
                stroke={stats.healthScore >= 90 ? "#22c55e" : stats.healthScore >= 70 ? "#f59e0b" : "#ef4444"} 
                strokeWidth="10" strokeLinecap="round" 
                strokeDasharray={`${(stats.healthScore || 100) * 3.27} 327`} 
                className="transition-all duration-1000 drop-shadow-md" 
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <ShieldCheck className={`w-7 h-7 mb-1 ${stats.healthScore >= 90 ? 'text-emerald-500' : stats.healthScore >= 70 ? 'text-amber-500' : 'text-red-500'}`} />
              <span className="text-3xl font-bold text-surface-900 dark:text-white tracking-tight">{stats.healthScore || 100}</span>
              <span className="text-[10px] text-surface-500 dark:text-surface-400 font-medium">/ 100</span>
            </div>
          </div>
          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
            {stats.healthScore >= 90 ? "Excellent" : stats.healthScore >= 70 ? "Good" : "At Risk"}
          </p>
        </motion.div>

        {/* Module 1: Today's Activity & Module 22: AI Summary */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <motion.div variants={fadeUp} className="stat-card flex-1">
            <h2 className="text-sm font-semibold text-surface-900 dark:text-white mb-4">Today's Activity</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-surface-50 dark:bg-white/[0.02] p-3 rounded-xl border border-surface-200/50 dark:border-white/[0.03]">
                <div className="text-xs text-surface-500 mb-1">Websites Scanned</div>
                <div className="text-xl font-bold text-surface-900 dark:text-white">{stats.todayStats?.scans || 0}</div>
              </div>
              <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Safe Websites</div>
                <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{stats.todayStats?.safe || 0}</div>
              </div>
              <div className="bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">Warnings</div>
                <div className="text-xl font-bold text-amber-700 dark:text-amber-300">{stats.todayStats?.warnings || 0}</div>
              </div>
              <div className="bg-red-500/5 p-3 rounded-xl border border-red-500/10">
                <div className="text-xs text-red-600 dark:text-red-400 mb-1">Blocked Websites</div>
                <div className="text-xl font-bold text-red-700 dark:text-red-300">{stats.todayStats?.blocked || 0}</div>
              </div>
              <div className="bg-surface-50 dark:bg-white/[0.02] p-3 rounded-xl border border-surface-200/50 dark:border-white/[0.03]">
                <div className="text-xs text-surface-500 mb-1">Downloads Scanned</div>
                <div className="text-xl font-bold text-surface-900 dark:text-white">{stats.todayStats?.downloads || 0}</div>
              </div>
              <div className="bg-red-500/5 p-3 rounded-xl border border-red-500/10">
                <div className="text-xs text-red-600 dark:text-red-400 mb-1">Files Blocked</div>
                <div className="text-xl font-bold text-red-700 dark:text-red-300">{stats.todayStats?.downloadsBlocked || 0}</div>
              </div>
              <div className="bg-brand-500/5 p-3 rounded-xl border border-brand-500/10 sm:col-span-2">
                <div className="text-xs text-brand-600 dark:text-brand-400 mb-1">Credential Protection Events</div>
                <div className="text-xl font-bold text-brand-700 dark:text-brand-300">{stats.todayStats?.credentials || 0}</div>
              </div>
            </div>
          </motion.div>

          {/* Module 22: Weekly AI Security Report / Summary */}
          <motion.div variants={fadeUp} className="stat-card bg-gradient-to-br from-brand-600/5 to-purple-600/5 border-brand-500/20">
            <h2 className="text-sm font-semibold text-brand-700 dark:text-brand-300 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
              AI Summary <span className="text-[10px] font-normal text-surface-500 bg-surface-100 dark:bg-black/20 px-2 py-0.5 rounded-full ml-auto">Generated automatically</span>
            </h2>
            <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed font-medium">
              {stats.aiSummary || "Loading AI analysis..."}
            </p>
          </motion.div>
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

      {/* Device & Policy Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <motion.div variants={fadeUp} className="stat-card">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-surface-900 dark:text-white"><Laptop className="w-4 h-4 text-brand-650 dark:text-brand-400" /> Device Status</h3>
          <div className="flex items-center justify-between p-4 rounded-xl bg-surface-100/50 dark:bg-white/[0.02] border border-surface-200/50 dark:border-white/[0.03]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <div className="text-sm font-bold text-surface-900 dark:text-white">AegisOne Extension</div>
                <div className="text-xs text-surface-500">v1.0.4 • Running Securely</div>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">Online</span>
          </div>
        </motion.div>
        
        <motion.div variants={fadeUp} className="stat-card">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-surface-900 dark:text-white"><Shield className="w-4 h-4 text-brand-650 dark:text-brand-400" /> Organization Policies</h3>
          <div className="space-y-2">
             <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-100/50 dark:bg-white/[0.02] text-sm">
                <span className="text-surface-700 dark:text-surface-300">Data Loss Prevention</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium text-xs">Active</span>
             </div>
             <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-100/50 dark:bg-white/[0.02] text-sm">
                <span className="text-surface-700 dark:text-surface-300">Auto-URL Scanning</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium text-xs">Active</span>
             </div>
          </div>
        </motion.div>
      </div>

      {/* Real-Time Threat Timeline */}
      <motion.div variants={fadeUp} className="stat-card flex flex-col h-[500px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white shrink-0">
            <Clock className="w-4 h-4 text-brand-650 dark:text-brand-400" /> Detailed Threat Timeline
          </h3>
          
          <div className="flex flex-wrap items-center gap-2">
             <select 
               value={filterDate} 
               onChange={(e) => setFilterDate(e.target.value)}
               className="text-xs bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1.5 focus:outline-none"
             >
               <option value="all">All Time</option>
               <option value="today">Today</option>
               <option value="week">Past 7 Days</option>
             </select>

             <select 
               value={filterVerdict} 
               onChange={(e) => setFilterVerdict(e.target.value)}
               className="text-xs bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1.5 focus:outline-none"
             >
               <option value="all">All Verdicts</option>
               <option value="safe">Safe Only</option>
               <option value="phishing">Phishing/Suspicious</option>
             </select>

             <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input 
                  type="text" 
                  placeholder="Search logs..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-xs bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 w-32 focus:w-48 transition-all" 
                />
             </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto -mx-4 sm:mx-0">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="sticky top-0 bg-surface-50 dark:bg-surface-800/90 backdrop-blur z-10 shadow-sm">
              <tr className="border-b border-surface-200 dark:border-white/[0.05] text-xs uppercase text-surface-500 font-semibold tracking-wider">
                <th className="pb-3 pt-3 pl-4">Timestamp</th>
                <th className="pb-3 pt-3">Domain / Input</th>
                <th className="pb-3 pt-3">Verdict</th>
                <th className="pb-3 pt-3">Score</th>
                <th className="pb-3 pt-3 text-right pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-surface-200/50 dark:divide-white/[0.02]">
              {filteredScans.map((scan: any) => (
                <tr key={scan.id} className="hover:bg-surface-100 dark:hover:bg-white/[0.02] transition-colors group">
                  <td className="py-3 pl-4 text-surface-500 text-xs whitespace-nowrap">
                    {parseLocalDate(scan.timestamp).toLocaleString(undefined, {
                       month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-col">
                       <span className="font-medium text-surface-900 dark:text-surface-200 max-w-[250px] truncate" title={scan.domain || scan.inputPreview}>{scan.domain || scan.inputPreview}</span>
                       <span className="text-[10px] text-surface-500 mt-0.5 max-w-[250px] truncate">{scan.scanType.toUpperCase()} • {scan.threatType ? scan.threatType.replace(/_/g, " ") : "Unknown"}</span>
                    </div>
                  </td>
                  <td className="py-3"><RiskBadge level={scan.riskLevel} /></td>
                  <td className="py-3">
                    <span className={`font-bold ${scan.riskScore >= 80 ? 'text-red-500' : scan.riskScore >= 50 ? 'text-amber-500' : 'text-emerald-500'}`}>{scan.riskScore || 0}%</span>
                  </td>
                  <td className="py-3 text-right pr-4">
                    <button 
                      onClick={() => setSelectedScan(scan)}
                      className="px-3 py-1.5 text-xs font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-brand-500/20"
                    >
                      View XAI
                    </button>
                  </td>
                </tr>
              ))}
              {filteredScans.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-surface-500 text-sm">
                    No scans match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Quick XAI Modal Overlay */}
      <AnimatePresence>
        {selectedScan && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedScan(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-surface-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-brand-500" />
                  Context-Aware XAI
                </h2>
                <button onClick={() => setSelectedScan(null)} className="text-surface-500 hover:text-surface-700 dark:hover:text-white">✕</button>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-surface-100/50 dark:bg-black/20 border border-surface-200/50 dark:border-white/5">
                  <div className="text-xs text-surface-500 mb-1 uppercase font-bold tracking-wider">Target Analyzed</div>
                  <div className="text-sm text-surface-900 dark:text-surface-200 break-all font-mono">{selectedScan.inputPreview}</div>
                </div>
                
                <div>
                  <div className="text-xs text-surface-500 mb-2 uppercase font-bold tracking-wider">Detected Risk Factors</div>
                  <ul className="space-y-2">
                    {selectedScan.topFactors && typeof selectedScan.topFactors === "string" 
                      ? JSON.parse(selectedScan.topFactors).map((f: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-300">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))
                      : <li className="text-sm text-surface-500">No specific heuristic flags triggered.</li>
                    }
                  </ul>
                </div>

                {selectedScan.riskScore >= 50 && (
                  <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium">
                    Our AI models flagged this as a high confidence threat due to matching known malicious indicators.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
