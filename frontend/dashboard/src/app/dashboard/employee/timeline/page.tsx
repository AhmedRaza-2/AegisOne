"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { Clock, Activity, ShieldCheck, ShieldAlert } from "lucide-react";
import { useState, useEffect } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function TimelinePage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      fetch(`http://localhost:9000/user/timeline?email=${encodeURIComponent(user.email)}`)
        .then(res => res.json())
        .then(res => { setData(res); setLoading(false); })
        .catch(err => { console.error(err); setLoading(false); });
    }
  }, [user]);

  if (!user) return null;
  if (loading) return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 text-brand-500 animate-spin" /></div>;

  const timeline = data?.timeline || [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-4xl mx-auto">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <Clock className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Security Timeline
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">A chronological story-mode view of your digital footprint and security events.</p>
      </motion.div>

      <motion.div variants={fadeUp} className="stat-card">
        <div className="relative pl-8 border-l-2 border-surface-200 dark:border-white/[0.1] space-y-8 py-4">
          {timeline.map((event: any) => (
            <div key={event.id} className="relative">
              <div className={`absolute -left-[41px] w-5 h-5 rounded-full border-4 border-white dark:border-surface-900 ${event.decision === 'block' ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {event.decision === 'block' ? <ShieldAlert className="w-4 h-4 text-red-500" /> : <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                    <h3 className="font-bold text-surface-900 dark:text-white">{event.event}</h3>
                  </div>
                  <p className="text-sm text-surface-600 dark:text-surface-400 font-mono truncate max-w-md">{event.target}</p>
                </div>
                <div className="flex flex-col sm:items-end">
                  <span className="text-xs font-semibold text-surface-500">{new Date(event.time).toLocaleString()}</span>
                  {event.decision === 'block' && (
                    <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded mt-1">Risk: {event.risk}%</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {timeline.length === 0 && <p className="text-sm text-surface-500">No events recorded.</p>}
        </div>
      </motion.div>
    </motion.div>
  );
}
