"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { Server, Activity, CheckCircle2, Zap, Clock, ShieldCheck } from "lucide-react";
import { useState, useEffect } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function ModelsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      fetch(`http://100.104.105.20:8000/user/models`)
        .then(res => res.json())
        .then(res => { setData(res); setLoading(false); })
        .catch(err => { console.error(err); setLoading(false); });
    }
  }, [user]);

  if (!user) return null;
  if (loading) return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 text-brand-500 animate-spin" /></div>;

  const models = data?.models || [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <Server className="w-6 h-6 text-brand-650 dark:text-brand-400" /> AI Models Status
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Live telemetry for AegisOne's specialized protection microservices.</p>
        </div>
        <div className="flex items-center gap-4 bg-surface-50 dark:bg-white/[0.02] px-4 py-2 rounded-lg border border-surface-200 dark:border-white/[0.05]">
          <div className="flex flex-col">
            <span className="text-[10px] text-surface-500 font-bold uppercase">Global Latency</span>
            <span className="text-sm font-bold text-surface-900 dark:text-white flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-500" /> {data?.globalLatency}</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models.map((m: any, i: number) => (
          <motion.div key={i} variants={fadeUp} className="stat-card flex flex-col justify-between">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div>
                  <h3 className="font-bold text-surface-900 dark:text-white">{m.name}</h3>
                  <span className="text-xs text-surface-500 font-mono">Version {m.version}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{m.status}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-surface-50 dark:bg-white/[0.02] rounded-xl p-3 border border-surface-100 dark:border-white/[0.02]">
              <div className="flex flex-col">
                <span className="text-xs text-surface-500 flex items-center gap-1 mb-0.5"><Clock className="w-3 h-3" /> Latency</span>
                <span className="text-sm font-bold text-surface-900 dark:text-white">{m.latency}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-surface-500 flex items-center gap-1 mb-0.5"><ShieldCheck className="w-3 h-3" /> Uptime</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{m.uptime}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
