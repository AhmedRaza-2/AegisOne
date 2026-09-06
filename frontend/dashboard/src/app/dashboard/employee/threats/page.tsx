"use client";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Shield, Download, Zap, AlertTriangle, AlertCircle, RefreshCw, Activity, ExternalLink, MapPin, ShieldCheck, Lock, Monitor, BrainCircuit, X } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function ThreatCenterPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [selectedThreat, setSelectedThreat] = useState<any>(null);

  useEffect(() => {
    if (user?.email) {
      const fetchData = () => {
        fetch(`http://localhost:8000/user/threats?email=${encodeURIComponent(user.email)}`)
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

  // Calculate stats from real-time data matching user isolated counts
  const remediatedCount = data?.remediated !== undefined 
    ? data.remediated 
    : recent.filter((t: any) => {
        const decision = (t.decision || '').toLowerCase();
        return decision === 'blocked' || decision === 'block';
      }).length;
  const avgScore = recent.length
    ? (recent.reduce((acc: number, t: any) => acc + (t.riskScore || 0), 0) / recent.length).toFixed(1)
    : "0.0";

  const filteredRecent = recent.filter((threat: any) => {
    if (filter === "All") return true;
    const isCritical = threat.riskScore >= 80;
    const isHigh = threat.riskScore >= 60 && threat.riskScore < 80;
    const isMedium = threat.riskScore >= 30 && threat.riskScore < 60;
    let severity = "Low";
    if (isCritical) severity = "Critical";
    else if (isHigh) severity = "High";
    else if (isMedium) severity = "Medium";
    return severity === filter;
  });

  const handleExport = () => {
    if (!recent.length) return alert("No data to export");
    const headers = "ID,Category,Target,Risk Score,Decision,Timestamp\n";
    const csv = recent.map((t: any) => `${t.id},${t.category},"${t.target}",${t.riskScore},${t.decision},${t.timestamp}`).join("\n");
    const blob = new Blob([headers + csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aegisone_threats_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white tracking-tight">Threat Center</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Review and manage blocked threats in real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/employee/scan" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#4F84F8] hover:bg-[#3D6CE5] transition-colors text-white">
            <Zap className="w-4 h-4" />
            Quick Scan
          </Link>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.1] hover:bg-surface-50 dark:hover:bg-white/[0.05] transition-colors text-surface-700 dark:text-surface-300">
            <Download className="w-4 h-4" />
            Export Data
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
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === f
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

          {filteredRecent.length === 0 && (
            <div className="p-8 text-center text-surface-500 rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04]">
              No recent threats found matching the current filter.
            </div>
          )}

          {filteredRecent.map((threat: any) => {
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
                          <span className={(threat.decision || '').toLowerCase().includes('block') ? 'text-red-500 font-bold' : 'text-amber-500 font-bold'}>{(threat.decision || '').toLowerCase().includes('block') ? 'Blocked' : threat.decision || 'Proceeded'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-surface-400 mt-3">
                        <div className="flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5" /> LOCAL-WKST</div>
                        <div className="w-1 h-1 rounded-full bg-surface-300 dark:bg-surface-700"></div>
                        <div>{new Date(threat.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                    <button
                      onClick={() => setSelectedThreat(threat)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-surface-100 dark:bg-white/[0.05] hover:bg-surface-200 dark:hover:bg-white/[0.08] text-surface-900 dark:text-white text-xs font-semibold transition-colors border border-transparent dark:border-white/[0.05] hover:border-surface-300 dark:hover:border-white/[0.1]">
                      View Full Details
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}

        </div>

        {/* Right Sidebar */}
        <div className="xl:col-span-1 space-y-6">

          {/* Removed Global Activity */}

          {/* Active Alerts */}
          <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-5 flex flex-col">
            <h3 className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-4">Active Alerts</h3>
            <div className="space-y-4">
              {!(data?.activeAlerts?.length) ? (
                <div className="flex flex-col items-center justify-center py-6 text-center bg-surface-50 dark:bg-white/[0.02] rounded-xl border border-surface-200 dark:border-white/[0.05]">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="text-sm font-bold text-surface-900 dark:text-white">All Clear</div>
                  <div className="text-xs text-surface-500 mt-1 max-w-[200px]">No active critical alerts right now. Your systems are secure.</div>
                </div>
              ) : (
                (data?.activeAlerts || []).map((alert: any, idx: number) => (
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
                ))
              )}
            </div>
          </motion.div>

          {/* Small Stats */}
          <div className="grid grid-cols-2 gap-4">
            <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-4 flex flex-col justify-between h-24">
              <h3 className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">Blocked Threats</h3>
              <div className="text-3xl font-bold text-surface-900 dark:text-white tracking-tight">{remediatedCount}</div>
            </motion.div>
            <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-4 flex flex-col justify-between h-24">
              <h3 className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">Risk Level</h3>
              <div className="text-3xl font-bold text-red-500 tracking-tight">{avgScore}</div>
            </motion.div>
          </div>

          {/* Removed Full Network Report button */}

        </div>
      </div>

      {/* Threat Details Modal */}
      <AnimatePresence>
        {selectedThreat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-white dark:bg-[#0B101E] border border-surface-200 dark:border-white/[0.08] rounded-3xl p-0 max-w-2xl w-full shadow-2xl overflow-hidden relative flex flex-col"
            >
              {/* Top Accent Bar */}
              <div className={`h-2 w-full ${(selectedThreat.decision || '').toLowerCase().includes('block') ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`} />

              <div className="p-6 sm:p-8">
                {/* Header */}
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${(selectedThreat.decision || '').toLowerCase().includes('block') ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 border border-red-100 dark:border-red-500/20' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-100 dark:border-amber-500/20'}`}>
                      {(selectedThreat.decision || '').toLowerCase().includes('block') ? <AlertCircle className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
                    </div>
                    <div>
                      <h3 className="text-2xl font-extrabold text-surface-900 dark:text-white tracking-tight">Threat Details</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-medium text-surface-500 bg-surface-100 dark:bg-white/[0.05] px-2 py-0.5 rounded-md font-mono">#{selectedThreat.id.split('-')[0].toUpperCase()}</span>
                        <span className="text-xs text-surface-400">•</span>
                        <span className="text-xs text-surface-500">{new Date(selectedThreat.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setSelectedThreat(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-100 dark:bg-white/[0.05] text-surface-500 hover:bg-surface-200 dark:hover:bg-white/[0.1] hover:text-surface-900 dark:hover:text-white transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Status & Stats Row */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-surface-50 dark:bg-[#141A29] border border-surface-100 dark:border-white/[0.04] p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-1.5">Action Taken</span>
                      <span className={`text-sm font-black uppercase tracking-wider ${(selectedThreat.decision || '').toLowerCase().includes('block') ? 'text-red-500' : 'text-amber-500'}`}>
                        {selectedThreat.decision}
                      </span>
                    </div>
                    <div className="bg-surface-50 dark:bg-[#141A29] border border-surface-100 dark:border-white/[0.04] p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-1.5">Risk Score</span>
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-surface-400" />
                        <span className="text-lg font-bold text-surface-900 dark:text-white leading-none">{selectedThreat.riskScore}<span className="text-sm text-surface-500">%</span></span>
                      </div>
                    </div>
                    <div className="bg-surface-50 dark:bg-[#141A29] border border-surface-100 dark:border-white/[0.04] p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-1.5">Category</span>
                      <span className="text-sm font-bold text-surface-700 dark:text-surface-200 leading-tight">
                        {selectedThreat.category}
                      </span>
                    </div>
                  </div>

                  {/* Target URL */}
                  <div className="bg-surface-50 dark:bg-[#141A29] border border-surface-100 dark:border-white/[0.04] p-5 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2">
                      <ExternalLink className="w-4 h-4 text-surface-400" />
                      <span className="text-xs font-bold text-surface-500 uppercase tracking-widest">Target URL / Domain</span>
                    </div>
                    <div className="p-3 bg-white dark:bg-black/20 border border-surface-200 dark:border-white/[0.05] rounded-xl text-sm text-surface-800 dark:text-surface-300 font-mono break-all leading-relaxed shadow-inner max-h-32 overflow-y-auto custom-scrollbar">
                      {selectedThreat.target}
                    </div>
                  </div>

                  {/* AI Explanation */}
                  <div className="relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-b from-purple-500/30 to-brand-500/30">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-brand-500/10" />
                    <div className="relative bg-white dark:bg-[#111727] p-6 rounded-[15px] h-full">
                      <div className="absolute top-0 right-0 p-4 opacity-[0.03] dark:opacity-5 pointer-events-none">
                         <BrainCircuit className="w-32 h-32" />
                      </div>
                      
                      <div className="flex items-center gap-2.5 mb-4 relative z-10">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-brand-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                          <BrainCircuit className="w-4 h-4 text-white" />
                        </div>
                        <h4 className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-brand-600 dark:from-purple-400 dark:to-brand-400">
                          Aegis AI Analysis
                        </h4>
                      </div>
                      
                      <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed relative z-10">
                        Based on deep behavioral analysis, <span className="font-semibold text-surface-900 dark:text-white px-1 py-0.5 rounded bg-surface-100 dark:bg-white/[0.05] mx-0.5">{selectedThreat.target.substring(0, 35)}{selectedThreat.target.length > 35 ? '...' : ''}</span> was flagged because it exhibits classic indicators of a <strong className="text-surface-900 dark:text-white">{selectedThreat.category}</strong> attack. The domain reputation is extremely low and the content structure matches known malicious patterns. I automatically <strong className={`px-1.5 py-0.5 rounded ${ (selectedThreat.decision || '').toLowerCase().includes('block') ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' }`}>{(selectedThreat.decision || '').toLowerCase().includes('block') ? 'blocked' : 'warned about'}</strong> this connection to secure your environment.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-surface-100 dark:border-white/[0.04] flex items-center justify-between">
                  <p className="text-xs font-semibold tracking-wide text-surface-400 flex items-center gap-1.5 uppercase">
                    <ShieldCheck className="w-4 h-4" /> Protected by AegisOne
                  </p>
                  <button onClick={() => setSelectedThreat(null)} className="px-8 py-2.5 bg-surface-900 dark:bg-white text-white dark:text-surface-900 hover:bg-surface-800 dark:hover:bg-surface-100 text-sm font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0">
                    Acknowledge
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

