"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { Image as ImageIcon, QrCode, ScanEye, Activity, AlertTriangle, ShieldCheck } from "lucide-react";
import { useState, useEffect } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

function parseLocalDate(dateStr: string) {
  if (!dateStr) return new Date();
  if (!dateStr.endsWith("Z") && !dateStr.includes("+")) { dateStr += "Z"; }
  return new Date(dateStr);
}

export default function MediaProtectionPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      fetch(`http://100.104.105.20:8000/user/media?email=${encodeURIComponent(user.email)}`)
        .then(res => res.json())
        .then(res => { setData(res); setLoading(false); })
        .catch(err => { console.error(err); setLoading(false); });
    }
  }, [user]);

  if (!user) return null;
  if (loading) return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 text-brand-500 animate-spin" /></div>;

  const mediaList = data?.media || [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <ImageIcon className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Image & QR Detection
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Computer vision analysis for malicious QR codes, logo spoofing, and OCR threats.</p>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mediaList.map((m: any) => (
          <div key={m.id} className="stat-card flex flex-col group relative overflow-hidden">
            {/* Background Risk Gradient */}
            <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl -mr-10 -mt-10 opacity-20 ${m.risk > 70 ? 'bg-red-500' : m.risk > 30 ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />

            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-white/[0.05] flex items-center justify-center">
                  {m.type.includes('QR') ? <QrCode className="w-4 h-4 text-brand-500" /> : <ScanEye className="w-4 h-4 text-brand-500" />}
                </div>
                <span className="text-xs font-bold uppercase text-surface-500">{m.type}</span>
              </div>
              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${m.decision === 'Blocked' ? 'bg-red-500/10 text-red-500' :
                  m.decision === 'Warned' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                }`}>
                {m.decision}
              </span>
            </div>

            <div className="flex-1 relative z-10">
              <h3 className="font-semibold text-surface-900 dark:text-white line-clamp-2 mb-2" title={m.target}>
                {m.target}
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-surface-200 dark:bg-white/[0.1] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${m.risk > 70 ? 'bg-red-500' : m.risk > 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${m.risk}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-surface-700 dark:text-surface-300 w-8 text-right">{m.risk}%</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-surface-200 dark:border-white/[0.05] text-[10px] text-surface-400 relative z-10">
              {parseLocalDate(m.timestamp).toLocaleString()}
            </div>
          </div>
        ))}

        {mediaList.length === 0 && (
          <div className="col-span-full py-12 text-center text-surface-500 text-sm stat-card">
            No media threats have been scanned yet.
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
