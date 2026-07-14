"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { ShieldAlert, Shield, Download, Zap, AlertTriangle, AlertCircle, RefreshCw, Activity, ExternalLink, MapPin, ShieldCheck, Lock, Monitor } from "lucide-react";
import { useState, useEffect } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function ThreatCenterPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    if (user?.email) {
      const fetchData = () => {
        fetch(`http://localhost:9000/user/threats?email=${encodeURIComponent(user.email)}`)
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
      
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (!user) return null;
  if (loading) return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 text-[#4F84F8] animate-spin" /></div>;

  const recent = data?.recent || [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white tracking-tight">Threat Center</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Monitor and remediate active security incidents in real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#4F84F8] hover:bg-[#3D6CE5] transition-colors text-white">
            <Zap className="w-4 h-4" />
            Quick Action
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.1] hover:bg-surface-50 dark:hover:bg-white/[0.05] transition-colors text-surface-700 dark:text-surface-300">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </motion.div>

      {/* Filter Row */}
      <motion.div variants={fadeUp} className="flex items-center gap-3 border-b border-surface-200 dark:border-white/[0.04] pb-4">
         <span className="text-xs font-bold text-surface-500 uppercase tracking-widest mr-2">Filter:</span>
         {["All", "Critical", "High", "Medium", "Low"].map((f) => (
           <button 
             key={f}
             onClick={() => setFilter(f)}
             className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
               filter === f 
                 ? "bg-[#4F84F8] text-white" 
                 : "bg-surface-100 dark:bg-white/[0.03] text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-white/[0.06] border border-transparent dark:border-white/[0.05]"
             }`}
           >
             {f}
           </button>
         ))}
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Main Incident List */}
        <div className="xl:col-span-2 space-y-4">
          
          {recent.length === 0 && (
            <div className="p-8 text-center text-surface-500 rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04]">
              No recent threats found matching the current filter.
            </div>
          )}

          {recent.map((threat: any) => {
             const isCritical = threat.riskScore >= 80;
             const isHigh = threat.riskScore >= 60 && threat.riskScore < 80;
             const isMedium = threat.riskScore >= 30 && threat.riskScore < 60;
             
             let severity = "Low";
             let colorClass = "bg-surface-400 dark:bg-surface-600";
             let textClass = "text-surface-600 dark:text-surface-400";
             let borderClass = "border-surface-300 dark:border-surface-600";
             let bgLightClass = "bg-surface-100 dark:bg-white/[0.05]";
             let icon = <RefreshCw className={`w-6 h-6 text-surface-500`} />;

             if (isCritical) {
               severity = "Critical"; colorClass = "bg-red-500"; textClass = "text-red-500";
               borderClass = "border-red-500"; bgLightClass = "bg-red-500/10";
               icon = <AlertCircle className="w-6 h-6 text-red-500" />;
             } else if (isHigh) {
               severity = "High"; colorClass = "bg-amber-500"; textClass = "text-amber-500";
               borderClass = "border-amber-500/50"; bgLightClass = "bg-amber-500/10";
               icon = <ShieldAlert className="w-6 h-6 text-amber-500" />;
             } else if (isMedium) {
               severity = "Medium"; colorClass = "bg-[#4F84F8]"; textClass = "text-[#4F84F8]";
               borderClass = "border-[#4F84F8]/50"; bgLightClass = "bg-[#4F84F8]/10";
               icon = <Shield className="w-6 h-6 text-[#4F84F8]" />;
             }

             return (
              <motion.div key={threat.id} variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-5 flex flex-col gap-4 relative overflow-hidden group hover:border-surface-300 dark:hover:border-white/[0.08] transition-colors">
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${colorClass}`}></div>
                
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 justify-between items-start">
                  <div className="flex gap-4 overflow-hidden">
                    <div className={`w-10 h-10 rounded-full ${bgLightClass} flex items-center justify-center shrink-0`}>
                      {icon}
                    </div>
                    <div className="overflow-hidden">
                       <div className="flex items-center gap-2 mb-1">
                         <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isCritical ? 'bg-red-500 text-white' : bgLightClass + ' ' + textClass}`}>{severity}</span>
                         <span className="text-xs text-surface-500 font-mono">#{threat.id.split('-')[0].toUpperCase()}</span>
                       </div>
                       <h3 className="text-base font-bold text-surface-900 dark:text-white">{threat.category}</h3>
                       
                       <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-surface-500 mt-2">
                         <div className="flex items-center gap-1.5" title={threat.target}>
                           <span className="font-semibold text-surface-600 dark:text-surface-400">Target:</span> 
                           <span className="truncate max-w-[200px] sm:max-w-xs block">{threat.target}</span>
                         </div>
                         <div className="w-1 h-1 rounded-full bg-surface-300 dark:bg-surface-700 hidden sm:block"></div>
                         <div className="flex items-center gap-1.5">
                           <span className="font-semibold text-surface-600 dark:text-surface-400">Status:</span> 
                           <span className={threat.decision === 'Blocked' ? 'text-red-500 font-bold' : 'text-amber-500 font-bold'}>{threat.decision === 'Blocked' ? 'Blocked' : 'Proceeded'}</span>
                         </div>
                       </div>
                       
                       <div className="flex items-center gap-4 text-xs text-surface-400 mt-3">
                         <div className="flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5" /> LOCAL-WKST</div>
                         <div className="w-1 h-1 rounded-full bg-surface-300 dark:bg-surface-700"></div>
                         <div>{new Date(threat.timestamp).toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'})}</div>
                       </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                    <button className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-surface-100 dark:bg-white/[0.05] hover:bg-surface-200 dark:hover:bg-white/[0.08] text-surface-900 dark:text-white text-xs font-semibold transition-colors">
                      View Details
                    </button>
                  </div>
                </div>
              </motion.div>
             );
          })}

        </div>

        {/* Right Sidebar */}
        <div className="xl:col-span-1 space-y-6">
           
           {/* Global Activity */}
           <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-5 flex flex-col">
              <h3 className="text-sm font-bold text-surface-900 dark:text-white mb-4">Global Activity</h3>
              <div className="relative h-40 w-full rounded-lg border border-surface-100 dark:border-white/[0.05] bg-[#0B0F19] overflow-hidden mb-4 flex items-center justify-center">
                 {/* Fake Map visualization */}
                 <svg className="absolute w-[150%] h-[150%] opacity-20" viewBox="0 0 800 400" fill="none">
                    <path d="M100 200 Q200 100 400 200 T700 200" stroke="#4F84F8" strokeWidth="2" strokeDasharray="4 4" />
                    <circle cx="100" cy="200" r="4" fill="#ef4444" />
                    <circle cx="400" cy="200" r="4" fill="#ef4444" />
                    <circle cx="700" cy="200" r="4" fill="#4F84F8" />
                 </svg>
                 <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/50 backdrop-blur border border-white/[0.1] text-[9px] font-bold text-[#4F84F8] tracking-widest uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4F84F8] animate-pulse"></span> Live Feed
                 </div>
                 <div className="absolute bottom-2 left-2 right-2 text-[10px] font-mono text-surface-400 bg-black/80 p-2 rounded">
                    BLOCK: {data?.globalActivity?.source || "192.168.1.1"} -&gt; {data?.globalActivity?.dest || "AWS-US-EAST"}<br/>
                    INFO: {data?.globalActivity?.info || "New edge point established in Frankfurt"}
                 </div>
              </div>
           </motion.div>

           {/* Active Alerts */}
           <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-5 flex flex-col">
              <h3 className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-4">Active Alerts</h3>
              <div className="space-y-4">
                 {(data?.activeAlerts || []).map((alert: any, idx: number) => (
                   <div key={idx} className="flex items-start gap-3 border-b border-surface-100 dark:border-white/[0.05] pb-3 last:border-0 last:pb-0">
                      {alert.icon === 'shield' ? <ShieldAlert className="w-4 h-4 text-[#4F84F8] shrink-0 mt-0.5" /> :
                       alert.icon === 'check' ? <ShieldCheck className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> :
                       <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                      <div>
                         <div className="text-sm font-bold text-surface-900 dark:text-white mb-0.5">{alert.title}</div>
                         <div className="text-xs text-surface-500 leading-relaxed mb-1">{alert.desc}</div>
                         <div className="text-[10px] text-surface-400 font-bold uppercase">{alert.time}</div>
                      </div>
                   </div>
                 ))}
              </div>
           </motion.div>

           {/* Small Stats */}
           <div className="grid grid-cols-2 gap-4">
              <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-4 flex flex-col justify-between h-24">
                 <h3 className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">Remediated</h3>
                 <div className="text-3xl font-bold text-surface-900 dark:text-white tracking-tight">{data?.remediatedCount || 0}</div>
              </motion.div>
              <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-4 flex flex-col justify-between h-24">
                 <h3 className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">Threat Score</h3>
                 <div className="text-3xl font-bold text-red-500 tracking-tight">{data?.threatScore || "0.0"}</div>
              </motion.div>
           </div>
           
           <motion.div variants={fadeUp}>
             <button className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-surface-100 dark:bg-white/[0.03] hover:bg-surface-200 dark:hover:bg-white/[0.06] transition-colors text-sm font-bold text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-white/[0.05]">
               <ExternalLink className="w-4 h-4" /> View Full Network Report
             </button>
           </motion.div>

        </div>
      </div>
    </motion.div>
  );
}
