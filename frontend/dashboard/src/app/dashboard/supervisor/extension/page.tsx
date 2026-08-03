"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { Monitor, ShieldCheck, Activity, Globe, Database, Network, Download, Puzzle, ExternalLink, User } from "lucide-react";
import { useState, useEffect } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function ManagerBrowserExtensionPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      fetch(`http://localhost:8000/user/browser`)
        .then(res => res.json())
        .then(res => { setData(res); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [user]);

  if (!user) return null;

  const status = data?.status || {};

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-4xl mx-auto mt-8">
      <motion.div variants={fadeUp} className="text-center mb-10">
        <div className="w-20 h-20 mx-auto bg-brand-500/10 rounded-full flex items-center justify-center mb-4 border-4 border-brand-500/20">
          <Puzzle className="w-10 h-10 text-brand-600 dark:text-brand-400" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <User className="w-4 h-4 text-brand-500" />
          <span className="text-xs font-bold text-surface-500 uppercase tracking-widest">Manager Personal Device</span>
        </div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Browser Protection Status</h1>
        <p className="text-surface-500 dark:text-surface-400 mt-2 text-base">
          Your workspace is secured by AegisOne. Manager-level threats are tracked separately and also reflected in organizational analytics.
        </p>
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

        <div className="stat-card flex flex-col items-center justify-center text-center p-6 bg-surface-50 dark:bg-white/[0.02] col-span-2 md:col-span-2">
          <Activity className="w-8 h-8 text-blue-500 mb-3" />
          <div className="text-xs text-surface-500 uppercase tracking-wider font-bold mb-1">Last Telemetry Sync</div>
          <div className="text-xl font-bold text-surface-900 dark:text-white">{status.lastSync || 'Just now'}</div>
        </div>
      </motion.div>

      {/* Extension Setup Instructions */}
      <motion.div variants={fadeUp} className="bg-surface-50 dark:bg-white/[0.02] border border-surface-200 dark:border-surface-800 rounded-2xl p-6 md:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 border-b border-surface-200 dark:border-surface-800 pb-4">
            <div className="p-2.5 bg-brand-500/10 rounded-lg text-brand-600 dark:text-brand-400">
              <Puzzle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-surface-900 dark:text-white">AegisOne Extension Setup</h3>
              <p className="text-sm text-surface-500 dark:text-surface-400">Install the extension to protect your browser and contribute to organizational threat intelligence.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: 1, title: "Download Package", desc: "Click the download button below to save the AegisOne extension bundle (.zip) to your computer." },
              { step: 2, title: "Extract ZIP File", desc: "Find the downloaded ZIP in your downloads folder. Right-click and select \"Extract All...\" to a dedicated folder." },
              { step: 3, title: "Open Extension Settings", desc: <>Open a new tab and paste <strong className="text-brand-600 dark:text-brand-400 font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">chrome://extensions</strong> into your browser address bar.</> },
              { step: 4, title: "Load Unpacked", desc: <>Enable <strong>\"Developer Mode\"</strong> in the top-right. Click <strong>\"Load unpacked\"</strong> and select the extracted folder.</> },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col bg-white dark:bg-surface-900/50 border border-surface-150 dark:border-surface-850 p-5 rounded-xl space-y-3">
                <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-500 text-white font-bold text-xs shrink-0">{step}</div>
                <h4 className="font-bold text-sm text-surface-900 dark:text-white">{title}</h4>
                <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="pt-4 flex flex-wrap gap-4 border-t border-surface-200 dark:border-surface-800 mt-2">
            <a
              href="http://localhost:8000/public/download/extension"
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors shadow-md hover:shadow-lg"
            >
              <Download className="w-4 h-4" /> Download Extension ZIP
            </a>
            <button
              className="inline-flex items-center gap-1.5 border border-surface-200 dark:border-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-white/5 font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
              onClick={() => {
                alert("Copy 'chrome://extensions' (or 'edge://extensions') and paste it into your browser address bar directly.");
              }}
            >
              Open Extension Settings <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

