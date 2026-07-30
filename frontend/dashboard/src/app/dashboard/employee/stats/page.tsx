"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { TrendingUp, Activity, BarChart2, Shield } from "lucide-react";
import { useState, useEffect } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function StatsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      fetch(`http://100.104.105.20:8000/user/personal-stats?email=${encodeURIComponent(user.email)}`)
        .then(res => res.json())
        .then(res => { setData(res); setLoading(false); })
        .catch(err => { console.error(err); setLoading(false); });
    }
  }, [user]);

  if (!user) return null;
  if (loading) return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 text-brand-500 animate-spin" /></div>;

  const stats = data?.stats || { "24h": {}, "7d": {}, "30d": {} };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-4xl mx-auto">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <TrendingUp className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Personal Statistics
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Granular metrics tracking your web footprint over time.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {["24h", "7d", "30d"].map((period) => (
          <motion.div key={period} variants={fadeUp} className="stat-card">
            <h2 className="text-sm font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-4 border-b border-surface-200 dark:border-white/[0.05] pb-2">
              Past {period}
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-surface-600 dark:text-surface-400 flex items-center gap-2"><Activity className="w-4 h-4" /> Websites Visited</span>
                <span className="font-bold text-surface-900 dark:text-white">{stats[period]?.visited || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-surface-600 dark:text-surface-400 flex items-center gap-2"><BarChart2 className="w-4 h-4" /> Objects Scanned</span>
                <span className="font-bold text-surface-900 dark:text-white">{stats[period]?.scanned || 0}</span>
              </div>
              <div className="flex justify-between items-center bg-red-500/5 -mx-2 px-2 py-1.5 rounded-md">
                <span className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2"><Shield className="w-4 h-4" /> Threats Prevented</span>
                <span className="font-bold text-red-600 dark:text-red-400">{stats[period]?.prevented || 0}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-surface-200 dark:border-white/[0.05]">
                <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Average Risk Score</span>
                <span className="font-bold text-amber-500">{stats[period]?.avgRisk || 0}%</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
