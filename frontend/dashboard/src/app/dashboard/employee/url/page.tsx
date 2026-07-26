"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { Link as LinkIcon, Activity, Globe, Shield, ExternalLink, Lock } from "lucide-react";
import { useState, useEffect } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
};
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

function parseLocalDate(dateStr: string) {
  if (!dateStr) return new Date();
  if (!dateStr.endsWith("Z") && !dateStr.includes("+")) {
    dateStr += "Z";
  }
  return new Date(dateStr);
}

export default function UrlIntelligencePage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      fetch(`http://localhost:8000/user/url-intelligence?email=${encodeURIComponent(user.email)}`)
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

  const urls = data?.urls || [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <LinkIcon className="w-6 h-6 text-brand-650 dark:text-brand-400" /> URL Intelligence
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Deep analysis of all web links traversed by your browser.</p>
      </motion.div>

      <motion.div variants={fadeUp} className="stat-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-surface-200 dark:border-white/[0.05] text-[10px] uppercase text-surface-500 font-semibold tracking-wider bg-surface-50/50 dark:bg-white/[0.01]">
                <th className="pb-3 pt-3 pl-4">Scanned URL</th>
                <th className="pb-3 pt-3">Reputation</th>
                <th className="pb-3 pt-3">Domain Age</th>
                <th className="pb-3 pt-3">SSL Security</th>
                <th className="pb-3 pt-3">Redirects</th>
                <th className="pb-3 pt-3 text-right pr-4">Result</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-surface-200/50 dark:divide-white/[0.02]">
              {urls.map((scan: any) => (
                <tr key={scan.id} className="hover:bg-surface-50 dark:hover:bg-white/[0.01] transition-colors group">
                  <td className="py-4 pl-4 max-w-[250px]">
                    <div className="flex flex-col">
                       <span className="font-mono text-xs font-medium text-surface-900 dark:text-surface-200 truncate" title={scan.url}>{scan.url}</span>
                       <span className="text-[10px] text-surface-500 mt-1">
                         {parseLocalDate(scan.timestamp).toLocaleString()}
                       </span>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold ${
                      scan.reputation === 'Malicious' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                      scan.reputation === 'Suspicious' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                      scan.reputation === 'Excellent' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      'bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-400'
                    }`}>
                      <Globe className="w-3 h-3" /> {scan.reputation}
                    </span>
                  </td>
                  <td className="py-4 text-xs font-medium text-surface-700 dark:text-surface-300">{scan.domainAge}</td>
                  <td className="py-4">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${scan.ssl.includes("Valid") ? "text-emerald-500" : "text-amber-500"}`}>
                      <Lock className="w-3 h-3" /> {scan.ssl}
                    </span>
                  </td>
                  <td className="py-4">
                    <span className={`text-xs font-medium ${scan.redirects === 'Detected' ? 'text-amber-500' : 'text-surface-500'}`}>
                      {scan.redirects}
                    </span>
                  </td>
                  <td className="py-4 text-right pr-4">
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                      scan.result === 'Blocked' ? 'bg-red-500/10 text-red-500' : 
                      scan.result === 'Warned' ? 'bg-amber-500/10 text-amber-500' : 
                      'bg-emerald-500/10 text-emerald-500'
                    }`}>
                      {scan.result}
                    </span>
                  </td>
                </tr>
              ))}
              {urls.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-surface-500 text-sm">No URLs have been scanned yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
