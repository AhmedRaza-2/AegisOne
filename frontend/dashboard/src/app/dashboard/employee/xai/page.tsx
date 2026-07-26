"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { BrainCircuit, Activity, ShieldAlert, Download, Share2, Globe, Monitor, Shield, Network, EyeOff, Lock, Clock, Zap, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.1 } } };

export default function XAIPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      const fetchData = () => {
        fetch(`http://localhost:8000/user/xai?email=${encodeURIComponent(user.email)}`)
          .then(res => res.json())
          .then(res => { setData(res); setLoading(false); })
          .catch(err => { console.error(err); setLoading(false); });
      };
      
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (!user) return null;
  if (loading) return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 text-[#4F84F8] animate-spin" /></div>;

  const explanations = data?.explanations || [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-12 max-w-7xl mx-auto">
      {explanations.length === 0 && (
        <div className="py-20 text-center flex flex-col items-center justify-center rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04]">
          <BrainCircuit className="w-12 h-12 text-surface-300 dark:text-surface-600 mb-4" />
          <h2 className="text-lg font-bold text-surface-900 dark:text-white">No active threats detected</h2>
          <p className="text-sm text-surface-500 mt-1">When threats are blocked, AI explanations will appear here.</p>
        </div>
      )}

      {explanations.map((exp: any, idx: number) => (
        <motion.div key={exp.id || idx} variants={fadeUp} className="flex flex-col gap-6">
          {/* Header section */}
          <div className="text-center max-w-3xl mx-auto mb-4">
            <div className="text-[10px] font-bold text-[#4F84F8] uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Heuristic Threat Analysis
            </div>
            <h1 className="text-3xl font-bold text-surface-900 dark:text-white tracking-tight mb-3">Why was this flagged?</h1>
            <p className="text-sm text-surface-600 dark:text-surface-300">
              AI model "Sentinel-X" identified anomalous patterns within egress traffic originating from the guest subnet targeting <span className="font-mono text-[#4F84F8]">{exp.target}</span>.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Confidence Score */}
            <div className="lg:col-span-1 rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex flex-col relative overflow-hidden">
              <div className="flex justify-between items-start mb-6 z-10">
                <h3 className="text-sm font-bold text-surface-900 dark:text-white">Confidence Score</h3>
                <Shield className="w-4 h-4 text-[#4F84F8]" />
              </div>
              <div className="z-10 mb-4">
                <div className="flex items-baseline">
                  <span className="text-5xl font-black text-surface-900 dark:text-white">{exp.confidence || exp.risk || 98}</span>
                  <span className="text-xl font-bold text-surface-500 ml-1">%</span>
                </div>
              </div>
              <div className="w-full h-2 bg-surface-100 dark:bg-white/[0.05] rounded-full mb-4 overflow-hidden z-10">
                <div className="h-full bg-[#4F84F8] rounded-full" style={{ width: `${exp.confidence || exp.risk || 98}%` }}></div>
              </div>
              <p className="text-xs text-surface-600 dark:text-surface-400 z-10 leading-relaxed">
                Extremely high correlation with known exfiltration vectors and malicious profiles based on heuristic matching.
              </p>
              
              {/* Background watermark icon */}
              <div className="absolute -bottom-8 -right-8 opacity-5">
                <BrainCircuit className="w-40 h-40" />
              </div>
            </div>

            {/* AI Executive Summary */}
            <div className="lg:col-span-2 rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <h3 className="text-sm font-bold text-surface-900 dark:text-white">AI Executive Summary</h3>
              </div>
              <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed mb-6">
                The system detected an <span className="font-bold text-red-500 dark:text-red-400">atypical threat pattern</span> on the host. The targeted domain, <span className="font-mono text-[#4F84F8] text-xs bg-surface-100 dark:bg-white/[0.05] px-1.5 py-0.5 rounded">{exp.target}</span>, 
                {exp.recommendation.toLowerCase().includes("block") ? " attempted to establish a persistent connection to a server in a high-risk jurisdiction." : " shows indicators of phishing or malicious content."} 
                {exp.reasons.length > 0 ? ` Specifically: ${exp.reasons.join(", ")}.` : ""} This behavior mimics typical malicious pre-stages.
              </p>
              <div className="flex flex-wrap gap-2 mt-auto">
                <span className="px-2 py-1 rounded bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider">Priority: Critical</span>
                <span className="px-2 py-1 rounded bg-surface-100 dark:bg-white/[0.05] text-surface-600 dark:text-surface-400 text-[10px] font-bold uppercase tracking-wider">Vector: {exp.verdict === 'Phishing' ? 'Web Traffic' : 'Network'}</span>
                <span className="px-2 py-1 rounded bg-surface-100 dark:bg-white/[0.05] text-surface-600 dark:text-surface-400 text-[10px] font-bold uppercase tracking-wider">Type: {exp.verdict}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Evidence Registry */}
            <div className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-bold text-surface-500 uppercase tracking-widest">Evidence Registry</h3>
                <span className="text-[10px] text-surface-400">{exp.reasons.length || 3} Flags Detected</span>
              </div>
              
              <div className="space-y-4 mb-6 flex-1">
                {exp.reasons.length > 0 ? exp.reasons.map((reason: string, i: number) => (
                  <div key={i} className="flex items-start gap-4 p-3 rounded-lg border border-surface-100 dark:border-white/[0.02] bg-surface-50 dark:bg-white/[0.01]">
                    <div className="w-8 h-8 rounded-lg bg-surface-200 dark:bg-white/[0.05] flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-surface-900 dark:text-white">{reason}</div>
                      <div className="text-xs text-surface-500 mt-1">Identified by heuristic scanning engine.</div>
                    </div>
                  </div>
                )) : (
                  <>
                    <div className="flex items-start gap-4 p-3 rounded-lg border border-surface-100 dark:border-white/[0.02] bg-surface-50 dark:bg-white/[0.01]">
                      <div className="w-8 h-8 rounded-lg bg-surface-200 dark:bg-white/[0.05] flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-surface-900 dark:text-white">Domain Age (Critical)</div>
                        <div className="text-xs text-surface-500 mt-1">Registered &lt; 24h ago in high-risk jurisdiction.</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-3 rounded-lg border border-surface-100 dark:border-white/[0.02] bg-surface-50 dark:bg-white/[0.01]">
                      <div className="w-8 h-8 rounded-lg bg-surface-200 dark:bg-white/[0.05] flex items-center justify-center shrink-0">
                        <Lock className="w-4 h-4 text-surface-500" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-surface-900 dark:text-white">SSL Mismatch</div>
                        <div className="text-xs text-surface-500 mt-1">Certificate CN does not match requested host.</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-3 rounded-lg border border-surface-100 dark:border-white/[0.02] bg-surface-50 dark:bg-white/[0.01]">
                      <div className="w-8 h-8 rounded-lg bg-surface-200 dark:bg-white/[0.05] flex items-center justify-center shrink-0">
                        <EyeOff className="w-4 h-4 text-red-500" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-surface-900 dark:text-white">Hidden Iframe Injection</div>
                        <div className="text-xs text-surface-500 mt-1">Obfuscated DOM element attempting silent call-out.</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <button className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-surface-100 dark:bg-white/[0.03] hover:bg-surface-200 dark:hover:bg-white/[0.06] transition-colors text-sm font-bold text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-white/[0.05]">
                Download Evidence Payload (.pcap)
              </button>
            </div>

            {/* Network Cluster Visualization */}
            <div className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex flex-col relative overflow-hidden">
              <div className="flex justify-between items-center mb-6 relative z-10">
                <h3 className="text-xs font-bold text-surface-500 uppercase tracking-widest">Network Cluster Visualization</h3>
                <span className="flex items-center gap-1.5 text-[10px] text-surface-400 font-bold uppercase"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Live Topology</span>
              </div>
              
              {/* Mock visualization graph */}
              <div className="flex-1 min-h-[250px] relative rounded-lg border border-surface-100 dark:border-white/[0.02] bg-[#FAFAFA] dark:bg-[#0B0F19] overflow-hidden">
                {/* Connecting lines */}
                <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                  <line x1="30%" y1="30%" x2="50%" y2="50%" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="50%" y1="50%" x2="70%" y2="35%" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="50%" y1="50%" x2="80%" y2="70%" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="50%" y1="50%" x2="35%" y2="80%" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                  
                  {/* Danger line */}
                  <line x1="35%" y1="80%" x2="50%" y2="50%" stroke="rgba(239,68,68,0.3)" strokeWidth="2" />
                </svg>

                {/* Nodes */}
                <div className="absolute top-[25%] left-[28%] w-8 h-8 rounded-full bg-surface-200 dark:bg-surface-800 border border-surface-300 dark:border-surface-600 flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
                  <Monitor className="w-3.5 h-3.5 text-surface-500" />
                </div>
                <div className="absolute top-[30%] left-[72%] w-8 h-8 rounded-full bg-surface-200 dark:bg-surface-800 border border-surface-300 dark:border-surface-600 flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
                  <Monitor className="w-3.5 h-3.5 text-surface-500" />
                </div>
                <div className="absolute top-[75%] left-[82%] w-8 h-8 rounded-full bg-surface-200 dark:bg-surface-800 border border-surface-300 dark:border-surface-600 flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
                  <Monitor className="w-3.5 h-3.5 text-surface-500" />
                </div>
                
                {/* Central malicious node */}
                <div className="absolute top-[50%] left-[50%] w-12 h-12 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center -translate-x-1/2 -translate-y-1/2 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div className="absolute top-[58%] left-[50%] -translate-x-1/2 text-[10px] text-surface-500 bg-[#0B0F19]/80 px-2 rounded font-mono border border-surface-800 whitespace-nowrap">
                  {exp.target} (Malicious Src)
                </div>

                {/* Origin node */}
                <div className="absolute top-[80%] left-[35%] w-10 h-10 rounded-full bg-[#4F84F8]/20 border border-[#4F84F8]/50 flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
                  <Network className="w-4 h-4 text-[#4F84F8]" />
                </div>
                
                {/* Info Overlay Box */}
                <div className="absolute bottom-4 left-4 p-3 rounded bg-white/90 dark:bg-[#141A29]/90 border border-surface-200 dark:border-white/[0.05] backdrop-blur text-xs">
                  <div className="font-bold text-surface-900 dark:text-white mb-0.5">Source Geo-Location</div>
                  <div className="text-surface-600 dark:text-surface-400 mb-1">Moscow Oblast, RU</div>
                  <div className="text-[9px] font-mono text-surface-500">LAT: 55.75 | LONG: 37.61</div>
                </div>
              </div>
            </div>
          </div>

          {/* Recommended Remediations */}
          <div className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-surface-900 dark:text-white">Recommended Remediations</h3>
              <p className="text-sm text-surface-500 mt-1">
                {exp.recommendation || "Automated analysis suggests blocking all traffic to the associated TLD immediately."}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button className="px-5 py-2.5 rounded-lg border border-surface-200 dark:border-white/[0.1] text-sm font-semibold text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-white/[0.05] transition-colors">
                Ignore False Positive
              </button>
              <button className="px-5 py-2.5 rounded-lg bg-[#4F84F8] hover:bg-[#3D6CE5] transition-colors text-sm font-semibold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> Block Domain Everywhere
              </button>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
