"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { Key, Shield, ShieldAlert, Activity, EyeOff, Lock, Unlock } from "lucide-react";
import { useState, useEffect } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

function parseLocalDate(dateStr: string) {
  if (!dateStr) return new Date();
  if (!dateStr.endsWith("Z") && !dateStr.includes("+")) { dateStr += "Z"; }
  return new Date(dateStr);
}

export default function CredentialsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      fetch(`http://localhost:9000/user/credentials?email=${encodeURIComponent(user.email)}`)
        .then(res => res.json())
        .then(res => { setData(res); setLoading(false); })
        .catch(err => { console.error(err); setLoading(false); });
    }
  }, [user]);

  if (!user) return null;
  if (loading) return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 text-brand-500 animate-spin" /></div>;

  const stats = data?.stats || { protected: 0, attempted: 0, blocked: 0, allowed: 0 };
  const timeline = data?.timeline || [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <Key className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Credential Protection
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Form Guard interception metrics and credential exposure logs.</p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={fadeUp} className="stat-card bg-emerald-500/5 border-emerald-500/10">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Protected</span>
          </div>
          <div className="text-3xl font-bold text-emerald-800 dark:text-emerald-300">{stats.protected}</div>
        </motion.div>
        
        <motion.div variants={fadeUp} className="stat-card bg-surface-50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3 mb-2">
            <EyeOff className="w-5 h-5 text-surface-500" />
            <span className="text-sm font-semibold text-surface-700 dark:text-surface-400">Attempted</span>
          </div>
          <div className="text-3xl font-bold text-surface-900 dark:text-white">{stats.attempted}</div>
        </motion.div>

        <motion.div variants={fadeUp} className="stat-card bg-red-500/5 border-red-500/10">
          <div className="flex items-center gap-3 mb-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <span className="text-sm font-semibold text-red-700 dark:text-red-400">Blocked</span>
          </div>
          <div className="text-3xl font-bold text-red-800 dark:text-red-300">{stats.blocked}</div>
        </motion.div>

        <motion.div variants={fadeUp} className="stat-card bg-brand-500/5 border-brand-500/10">
          <div className="flex items-center gap-3 mb-2">
            <Unlock className="w-5 h-5 text-brand-500" />
            <span className="text-sm font-semibold text-brand-700 dark:text-brand-400">Allowed</span>
          </div>
          <div className="text-3xl font-bold text-brand-800 dark:text-brand-300">{stats.allowed}</div>
        </motion.div>
      </div>

      {/* Timeline */}
      <motion.div variants={fadeUp} className="stat-card">
        <h2 className="text-sm font-semibold mb-4 text-surface-900 dark:text-white">Interception Timeline</h2>
        <div className="relative pl-6 border-l-2 border-surface-200 dark:border-white/[0.1] space-y-8 py-2">
          {timeline.map((event: any, i: number) => (
            <div key={event.id} className="relative">
              <div className={`absolute -left-[35px] w-4 h-4 rounded-full border-4 border-white dark:border-surface-900 ${event.action === 'Blocked' ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-50 dark:bg-white/[0.02] p-4 rounded-xl border border-surface-200/50 dark:border-white/[0.05]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className={`w-4 h-4 ${event.action === 'Blocked' ? 'text-red-500' : 'text-emerald-500'}`} />
                    <span className="font-bold text-surface-900 dark:text-white">{event.domain}</span>
                  </div>
                  <div className="text-xs text-surface-500 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-surface-200/50 dark:bg-white/[0.05]">{event.type}</span>
                    &bull; {parseLocalDate(event.timestamp).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-md ${
                    event.action === 'Blocked' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}>
                    {event.action}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {timeline.length === 0 && (
            <p className="text-sm text-surface-500">No credential events recorded.</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
