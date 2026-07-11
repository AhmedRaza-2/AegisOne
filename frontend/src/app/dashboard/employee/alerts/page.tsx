"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { Bell, AlertTriangle, ShieldAlert, Activity } from "lucide-react";
import { useState, useEffect } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function AlertsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      fetch(`http://localhost:9000/user/alerts?email=${encodeURIComponent(user.email)}`)
        .then(res => res.json())
        .then(res => { setData(res); setLoading(false); })
        .catch(err => { console.error(err); setLoading(false); });
    }
  }, [user]);

  if (!user) return null;
  if (loading) return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 text-brand-500 animate-spin" /></div>;

  const alerts = data?.alerts || [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-4xl mx-auto">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <Bell className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Alerts Center
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Live feed of high-severity incidents requiring your attention.</p>
      </motion.div>

      <motion.div variants={fadeUp} className="space-y-4">
        {alerts.map((alert: any) => (
          <div key={alert.id} className="flex gap-4 p-4 rounded-xl bg-surface-50 dark:bg-white/[0.02] border border-surface-200/50 dark:border-white/[0.05] hover:border-red-500/30 transition-colors relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full ${alert.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${alert.severity === 'critical' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
              {alert.severity === 'critical' ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-bold text-surface-900 dark:text-white">{alert.title}</h3>
                <span className="text-xs text-surface-500">{new Date(alert.time).toLocaleString()}</span>
              </div>
              <p className="text-sm text-surface-600 dark:text-surface-400">{alert.description}</p>
            </div>
          </div>
        ))}
        {alerts.length === 0 && (
          <div className="py-12 text-center text-surface-500 text-sm stat-card">No active alerts. You are completely secure.</div>
        )}
      </motion.div>
    </motion.div>
  );
}
