"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { ShieldAlert, ShieldX, Link, Download, QrCode, MonitorPlay, AlertTriangle, Bug, Activity } from "lucide-react";
import { useState, useEffect } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
};
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

const ICON_MAP: Record<string, any> = {
  "Phishing Websites": ShieldX,
  "Fake Login Pages": ShieldAlert,
  "Suspicious URLs": Link,
  "Malicious Downloads": Download,
  "Dangerous QR Codes": QrCode,
  "Brand Impersonation": MonitorPlay,
  "Suspicious Scripts": Bug
};

function parseLocalDate(dateStr: string) {
  if (!dateStr) return new Date();
  if (!dateStr.endsWith("Z") && !dateStr.includes("+")) {
    dateStr += "Z";
  }
  return new Date(dateStr);
}

export default function ThreatCenterPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      fetch(`http://localhost:9000/user/threats?email=${encodeURIComponent(user.email)}`)
        .then(res => res.json())
        .then(res => {
          setData(res);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [user]);

  if (!user) return null;
  
  if (loading) {
    return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 text-brand-500 animate-spin" /></div>;
  }

  const cards = data?.cards || [];
  const recent = data?.recent || [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <ShieldAlert className="w-6 h-6 text-red-500" /> Threat Center
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Comprehensive breakdown of all categorized threats prevented by AegisOne.</p>
        </div>
      </motion.div>

      {/* Threat Category Cards */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((card: any) => {
          const Icon = ICON_MAP[card.title] || AlertTriangle;
          return (
            <div key={card.title} className="p-4 rounded-xl bg-surface-50 dark:bg-white/[0.02] border border-surface-200/50 dark:border-white/[0.05] hover:border-red-500/30 transition-colors group cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                  <Icon className="w-5 h-5 text-red-500" />
                </div>
                <div className="text-2xl font-bold text-surface-900 dark:text-white">{card.count}</div>
              </div>
              <div className="text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase tracking-wide">{card.title}</div>
            </div>
          );
        })}
      </motion.div>

      {/* Recent Threats Breakdown */}
      <motion.div variants={fadeUp} className="stat-card">
        <h2 className="text-sm font-semibold mb-4 text-surface-900 dark:text-white">Recent Detections</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-surface-200 dark:border-white/[0.05] text-xs uppercase text-surface-500 font-semibold tracking-wider">
                <th className="pb-3 pl-2">Timestamp</th>
                <th className="pb-3">Target</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">Risk</th>
                <th className="pb-3 text-right pr-2">Decision</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-surface-200/50 dark:divide-white/[0.02]">
              {recent.map((threat: any) => (
                <tr key={threat.id} className="hover:bg-surface-50 dark:hover:bg-white/[0.01] transition-colors">
                  <td className="py-3 pl-2 text-surface-500 text-xs">
                    {parseLocalDate(threat.timestamp).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td className="py-3 font-mono text-xs text-surface-900 dark:text-surface-200 max-w-[200px] truncate" title={threat.target}>{threat.target}</td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-100 dark:bg-white/[0.05] text-[11px] font-semibold text-surface-700 dark:text-surface-300">
                      {threat.category}
                    </span>
                  </td>
                  <td className="py-3 font-bold text-red-500">{threat.riskScore}%</td>
                  <td className="py-3 text-right pr-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${threat.decision === 'Blocked' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {threat.decision}
                    </span>
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-surface-500 text-sm">No recent threats found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
