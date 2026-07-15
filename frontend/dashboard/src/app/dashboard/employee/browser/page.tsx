"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { Monitor, ShieldCheck, Activity, Globe, Database, Network } from "lucide-react";
import { useState, useEffect } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function BrowserStatusPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      fetch(`http://localhost:9000/user/browser`)
        .then(res => res.json())
        .then(res => { setData(res); setLoading(false); })
        .catch(err => { console.error(err); setLoading(false); });
    }
  }, [user]);

  if (!user) return null;
  if (loading) return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 text-brand-500 animate-spin" /></div>;

  const status = data?.status || {};

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-4xl mx-auto mt-8">
      <motion.div variants={fadeUp} className="text-center mb-10">
        <div className="w-20 h-20 mx-auto bg-brand-500/10 rounded-full flex items-center justify-center mb-4 border-4 border-brand-500/20">
          <Monitor className="w-10 h-10 text-brand-600 dark:text-brand-400" />
        </div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Browser Protection Status</h1>
        <p className="text-surface-500 dark:text-surface-400 mt-2 text-lg">Your workspace is currently secured by AegisOne.</p>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-3 gap-6">
        <div className="stat-card flex flex-col items-center justify-center text-center p-6 bg-surface-50 dark:bg-white/[0.02]">
          <ShieldCheck className="w-8 h-8 text-emerald-500 mb-3" />
          <div className="text-xs text-surface-500 uppercase tracking-wider font-bold mb-1">Extension State</div>
          <div className="text-xl font-bold text-surface-900 dark:text-white">{status.extension || 'Online'}</div>
        </div>

        <div className="stat-card flex flex-col items-center justify-center text-center p-6 bg-surface-50 dark:bg-white/[0.02]">
          <Globe className="w-8 h-8 text-brand-500 mb-3" />
          <div className="text-xs text-surface-500 uppercase tracking-wider font-bold mb-1">Protection Level</div>
          <div className="text-xl font-bold text-surface-900 dark:text-white">{status.protection || 'Enabled'}</div>
        </div>

        <div className="stat-card flex flex-col items-center justify-center text-center p-6 bg-surface-50 dark:bg-white/[0.02]">
          <Network className="w-8 h-8 text-amber-500 mb-3" />
          <div className="text-xs text-surface-500 uppercase tracking-wider font-bold mb-1">AI Pipeline</div>
          <div className="text-xl font-bold text-surface-900 dark:text-white">{status.aiConnected || 'Connected'}</div>
        </div>

        <div className="stat-card flex flex-col items-center justify-center text-center p-6 bg-surface-50 dark:bg-white/[0.02]">
          <Database className="w-8 h-8 text-purple-500 mb-3" />
          <div className="text-xs text-surface-500 uppercase tracking-wider font-bold mb-1">Local Database</div>
          <div className="text-xl font-bold text-surface-900 dark:text-white">{status.database || 'Synced'}</div>
        </div>
        
        <div className="stat-card flex flex-col items-center justify-center text-center p-6 bg-surface-50 dark:bg-white/[0.02] md:col-span-2">
          <Activity className="w-8 h-8 text-blue-500 mb-3" />
          <div className="text-xs text-surface-500 uppercase tracking-wider font-bold mb-1">Last Telemetry Sync</div>
          <div className="text-xl font-bold text-surface-900 dark:text-white">{status.lastSync || 'Just now'}</div>
        </div>
      </motion.div>
    </motion.div>
  );
}
