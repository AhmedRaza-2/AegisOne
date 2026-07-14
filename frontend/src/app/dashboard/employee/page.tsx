"use client";
import { useAuth } from "@/lib/auth-context";
import { Download, Scan, ShieldCheck, Globe, ShieldAlert, AlertTriangle, FileText, ChevronRight, Lock, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
};
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      const fetchData = () => {
        fetch(`http://localhost:9000/user/stats?email=${encodeURIComponent(user.email)}`)
          .then(res => res.json())
          .then(res => {
            setData(res);
            setLoading(false);
          })
          .catch(err => {
            console.error(err);
            setLoading(false);
          });
      };
      
      fetchData(); // Initial fetch
      const interval = setInterval(fetchData, 5000); // Poll every 5s
      return () => clearInterval(interval);
    }
  }, [user]);

  if (!user) return null;
  if (loading) return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 text-[#4F84F8] animate-spin" /></div>;

  const score = data?.healthScore || 0;
  const websitesScanned = (data?.scanBreakdown?.website || 0) + (data?.scanBreakdown?.url || 0);
  const threatsBlocked = data?.threatsBlocked || 0;
  const pendingAlerts = data?.todayStats?.warnings || 0;
  const filesScanned = data?.scanBreakdown?.attachment || 0;
  const recentScans = data?.scans || [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white tracking-tight">Security Overview</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Real-time enterprise monitoring and threat mitigation</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.1] hover:bg-surface-50 dark:hover:bg-white/[0.05] transition-colors text-surface-700 dark:text-surface-300">
            <Download className="w-4 h-4" />
            Export Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#4F84F8] hover:bg-[#3D6CE5] transition-colors text-white">
            <Scan className="w-4 h-4" />
            Quick Scan
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Security Score Card */}
        <motion.div variants={fadeUp} className="lg:col-span-1 rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex flex-col">
          <h2 className="text-base font-semibold text-surface-900 dark:text-white mb-8">Security Score</h2>
          
          <div className="relative w-48 h-48 mx-auto mb-10 flex-1 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 absolute inset-0" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
              <circle cx="60" cy="60" r="52" fill="none" 
                stroke={score >= 80 ? "#A5C0FF" : score >= 50 ? "#F59E0B" : "#EF4444"} 
                strokeWidth="8" strokeLinecap="round" 
                strokeDasharray={`${(score / 100) * 326.7} 326.7`} 
                className="transition-all duration-1000" 
              />
            </svg>
            <div className="flex flex-col items-center justify-center z-10">
              <span className="text-5xl font-bold text-surface-900 dark:text-white tracking-tight">{score}</span>
              {score >= 80 ? (
                <span className="text-xs font-medium text-emerald-500 flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" /> +2.1%
                </span>
              ) : (
                <span className="text-xs font-medium text-red-500 flex items-center mt-1">
                  <TrendingDown className="w-3 h-3 mr-1" /> -1.5%
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-surface-200 dark:divide-white/[0.05] border-t border-surface-200 dark:border-white/[0.05] pt-6 mt-auto">
            <div className="flex flex-col items-center justify-center">
               <span className="text-[10px] uppercase font-bold tracking-widest text-surface-500 mb-1">Network</span>
               <span className="text-lg font-bold text-surface-900 dark:text-white">{data?.networkScore ?? 100}%</span>
            </div>
            <div className="flex flex-col items-center justify-center">
               <span className="text-[10px] uppercase font-bold tracking-widest text-surface-500 mb-1">Endpoints</span>
               <span className="text-lg font-bold text-surface-900 dark:text-white">{data?.endpointScore ?? 100}%</span>
            </div>
            <div className="flex flex-col items-center justify-center">
               <span className="text-[10px] uppercase font-bold tracking-widest text-surface-500 mb-1">Identity</span>
               <span className="text-lg font-bold text-surface-900 dark:text-white">{data?.identityScore ?? 100}%</span>
            </div>
          </div>
        </motion.div>

        {/* 2x2 Stats Grid */}
        <motion.div variants={fadeUp} className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
           {/* Card 1 */}
           <div className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-6">
                 <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-white/[0.03] flex items-center justify-center">
                    <Globe className="w-4 h-4 text-brand-500 dark:text-[#A5C0FF]" />
                 </div>
                 <span className="px-2 py-1 rounded bg-surface-100 dark:bg-white/[0.03] text-[10px] font-bold text-surface-600 dark:text-surface-300 tracking-wider">Websites</span>
              </div>
              <div>
                 <div className="flex items-end gap-3 mb-1">
                    <div className="text-4xl font-bold text-surface-900 dark:text-white tracking-tight">{data?.webStats?.scanned || 0}</div>
                    <div className="flex flex-col text-[10px] font-semibold mb-1.5 leading-tight">
                        <span className="text-red-500">{data?.webStats?.blocked || 0} Blocked</span>
                    </div>
                 </div>
                 <div className="text-xs font-medium text-surface-500 dark:text-surface-400">Total Websites Visited</div>
              </div>
           </div>

           {/* Card 2 */}
           <div className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-6">
                 <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-white/[0.03] flex items-center justify-center">
                    <Lock className="w-4 h-4 text-amber-500" />
                 </div>
                 <span className="px-2 py-1 rounded bg-surface-100 dark:bg-white/[0.03] text-[10px] font-bold text-amber-600 dark:text-amber-500 tracking-wider">Links</span>
              </div>
              <div>
                 <div className="flex items-end gap-3 mb-1">
                    <div className="text-4xl font-bold text-surface-900 dark:text-white tracking-tight">{data?.urlStats?.scanned || 0}</div>
                    <div className="flex flex-col text-[10px] font-semibold mb-1.5 leading-tight">
                        <span className="text-red-500">{data?.urlStats?.blocked || 0} Blocked</span>
                    </div>
                 </div>
                 <div className="text-xs font-medium text-surface-500 dark:text-surface-400">Total URLs Scanned</div>
              </div>
           </div>

           {/* Card 3 */}
           <div className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-6">
                 <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                 </div>
                 <span className="px-2 py-1 rounded bg-surface-100 dark:bg-white/[0.03] text-[10px] font-bold text-surface-600 dark:text-surface-400 tracking-wider">Urgent</span>
              </div>
              <div>
                 <div className="text-4xl font-bold text-surface-900 dark:text-white tracking-tight mb-1">{pendingAlerts < 10 ? `0${pendingAlerts}` : pendingAlerts}</div>
                 <div className="text-xs font-medium text-surface-500 dark:text-surface-400">Pending Alerts</div>
              </div>
           </div>

           {/* Card 4 - File Security */}
           <div className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-6">
                 <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-purple-500" />
                 </div>
                 <span className="px-2 py-1 rounded bg-surface-100 dark:bg-white/[0.03] text-[10px] font-bold text-surface-600 dark:text-surface-400 tracking-wider">Downloads</span>
              </div>
              <div>
                 <div className="flex items-end gap-3 mb-1">
                    <div className="text-4xl font-bold text-surface-900 dark:text-white tracking-tight">{data?.fileStats?.downloaded || 0}</div>
                    <div className="flex flex-col text-[10px] font-semibold mb-1.5 leading-tight">
                        <span className="text-red-600">{data?.fileStats?.phishing || 0} Phishing</span>
                        <span className="text-red-400">{data?.fileStats?.blocked || 0} Blocked</span>
                        <span className="text-amber-500">{data?.fileStats?.proceededAtRisk || 0} Proceeded</span>
                    </div>
                 </div>
                 <div className="text-xs font-medium text-surface-500 dark:text-surface-400">Total Files Scanned</div>
              </div>
           </div>
        </motion.div>
      </div>

      {/* Recent Activity Table */}
      <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] overflow-hidden">
        <div className="p-5 border-b border-surface-200 dark:border-white/[0.04] flex items-center justify-between">
           <h2 className="text-base font-semibold text-surface-900 dark:text-white">Recent Activity</h2>
           <button className="text-xs font-semibold text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white transition-colors">
             View All Logs
           </button>
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
           <table className="w-full text-left relative">
              <thead className="sticky top-0 bg-white dark:bg-[#141A29] z-10">
                 <tr className="border-b border-surface-200 dark:border-white/[0.04]">
                    <th className="py-4 px-6 text-[10px] font-bold tracking-widest uppercase text-surface-500">Event</th>
                    <th className="py-4 px-6 text-[10px] font-bold tracking-widest uppercase text-surface-500">Severity</th>
                    <th className="py-4 px-6 text-[10px] font-bold tracking-widest uppercase text-surface-500">Timestamp</th>
                    <th className="py-4 px-6 text-[10px] font-bold tracking-widest uppercase text-surface-500">Action</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 dark:divide-white/[0.04]">
                 {recentScans.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-surface-500">
                        No recent activity found.
                      </td>
                    </tr>
                 ) : (
                    recentScans.map((scan: any, i: number) => {
                      const isBlock = scan.decision === "block";
                      const isWarn = scan.decision === "warn";
                      const isPhish = scan.threatType && (scan.threatType.toLowerCase().includes("phish") || scan.threatType.toLowerCase().includes("malware") || scan.threatType.toLowerCase().includes("malicious"));
                      const colorClass = (isBlock || isPhish) ? "text-red-500 bg-red-500/10" : isWarn ? "text-amber-500 bg-amber-500/10" : "text-brand-600 dark:text-[#A5C0FF] bg-brand-500/10 dark:bg-[#A5C0FF]/10";
                      const Icon = (isBlock || isPhish) ? ShieldAlert : isWarn ? AlertTriangle : Lock;
                      
                      return (
                         <tr key={scan.id || i} className="hover:bg-surface-50 dark:hover:bg-white/[0.02] transition-colors group">
                            <td className="py-4 px-6">
                               <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClass.split(' ')[1]} ${colorClass.split(' ')[2] || ''}`}>
                                     <Icon className={`w-4 h-4 ${colorClass.split(' ')[0]}`} />
                                  </div>
                                  <div>
                                     <div className="text-sm font-semibold text-surface-900 dark:text-white truncate max-w-[250px]">
                                       {scan.threatType && scan.threatType.toLowerCase().includes("phish") ? "Phishing detected" : 
                                        scan.threatType && scan.threatType.toLowerCase().includes("malware") ? "Malware detected" :
                                        scan.threatType && scan.threatType.toLowerCase().includes("malicious") ? "Malicious file" :
                                        isBlock ? "Threat blocked" : isWarn ? "Suspicious activity" : "Secure access"}
                                     </div>
                                     <div className="text-xs text-surface-500 mt-0.5 truncate max-w-[250px]">Target: {scan.inputPreview || scan.domain || "Local device"}</div>
                                  </div>
                               </div>
                            </td>
                            <td className="py-4 px-6">
                               <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
                                  {(scan.threatType && (scan.threatType.toLowerCase().includes("phish") || scan.threatType.toLowerCase().includes("malware") || scan.threatType.toLowerCase().includes("malicious"))) ? "High Risk" : isBlock ? "High Risk" : isWarn ? "Warning" : "Verified"}
                               </span>
                            </td>
                            <td className="py-4 px-6 text-sm text-surface-500 dark:text-surface-400 font-mono">
                               {new Date(scan.timestamp).toLocaleString()}
                            </td>
                            <td className="py-4 px-6">
                               <button className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-white/[0.03] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-surface-200 dark:hover:bg-white/[0.06] text-surface-500 dark:text-surface-400">
                                 <ChevronRight className="w-4 h-4" />
                               </button>
                            </td>
                         </tr>
                      );
                    })
                 )}
              </tbody>
           </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
