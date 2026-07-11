"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { BrainCircuit, CheckCircle2, ShieldAlert, Activity, Target, Zap } from "lucide-react";
import { useState, useEffect } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function XAIPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      fetch(`http://localhost:9000/user/xai?email=${encodeURIComponent(user.email)}`)
        .then(res => res.json())
        .then(res => { setData(res); setLoading(false); })
        .catch(err => { console.error(err); setLoading(false); });
    }
  }, [user]);

  if (!user) return null;
  if (loading) return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 text-brand-500 animate-spin" /></div>;

  const explanations = data?.explanations || [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <BrainCircuit className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Explainable AI Center
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Deep-dive into the reasoning behind AegisOne's threat detection verdicts.</p>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {explanations.map((exp: any, i: number) => (
          <motion.div key={exp.id || i} variants={fadeUp} className="stat-card flex flex-col relative overflow-hidden group">
            {/* Background glow */}
            <div className={`absolute top-0 right-0 w-48 h-48 blur-[80px] -mr-20 -mt-20 opacity-30 pointer-events-none ${exp.risk > 70 ? 'bg-red-500' : 'bg-amber-500'}`} />
            
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${exp.verdict === 'Phishing' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    Verdict: {exp.verdict}
                  </span>
                  <span className="text-xs text-surface-500 font-mono">{new Date(exp.timestamp).toLocaleDateString()}</span>
                </div>
                <h3 className="text-base font-semibold text-surface-900 dark:text-white truncate" title={exp.target}>{exp.target}</h3>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <div className={`text-2xl font-black ${exp.risk > 70 ? 'text-red-500' : 'text-amber-500'}`}>{exp.risk}%</div>
                <div className="text-[10px] text-surface-500 font-semibold uppercase tracking-wider">Risk Score</div>
              </div>
            </div>

            <div className="bg-surface-50 dark:bg-white/[0.02] border border-surface-200 dark:border-white/[0.05] rounded-xl p-4 mb-4 relative z-10">
              <h4 className="text-xs font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Threat Factors Identified
              </h4>
              <ul className="space-y-2">
                {exp.reasons.map((reason: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-300">
                    <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${exp.risk > 70 ? 'text-red-500' : 'text-amber-500'}`} />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-auto relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-brand-500/5 rounded-xl border border-brand-500/10">
              <div className="flex-1">
                <div className="text-xs font-semibold text-brand-700 dark:text-brand-400 uppercase mb-1">AI Recommendation</div>
                <p className="text-sm text-surface-800 dark:text-surface-200">{exp.recommendation}</p>
              </div>
              <div className="shrink-0 flex items-center gap-2 bg-white dark:bg-surface-900 px-3 py-1.5 rounded-lg border border-surface-200 dark:border-white/[0.05]">
                <Zap className="w-4 h-4 text-amber-500" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-surface-500 font-bold uppercase leading-tight">Confidence</span>
                  <span className="text-sm font-bold text-surface-900 dark:text-white leading-tight">{exp.confidence}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        {explanations.length === 0 && (
          <div className="col-span-full py-12 text-center text-surface-500 text-sm stat-card">
            No threats detected recently. XAI explanations will appear here when threats are blocked.
          </div>
        )}
      </div>
    </motion.div>
  );
}
