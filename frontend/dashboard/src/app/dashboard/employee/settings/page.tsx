"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { Settings, Shield, Bell, EyeOff, MonitorSmartphone, Cpu, Download } from "lucide-react";
import { useState } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function SettingsPage() {
  const { user, theme, toggleTheme } = useAuth();
  
  // Local state for UI toggles (for FYP presentation)
  const [toggles, setToggles] = useState({
    notifications: true,
    aiExplanations: true,
    autoScanDownloads: true,
    autoScanQR: true,
    autoBlockHighRisk: true,
    privacyMode: false,
    manualScanOnly: false,
  });

  const handleToggle = (key: keyof typeof toggles) => {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!user) return null;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-4xl mx-auto">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <Settings className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Preferences & Settings
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Configure your AegisOne protection environment.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Protection Settings */}
        <motion.div variants={fadeUp} className="stat-card space-y-6">
          <h2 className="text-sm font-bold text-surface-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-surface-200 dark:border-white/[0.05] pb-2">
            <Shield className="w-4 h-4 text-emerald-500" /> Protection Levels
          </h2>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-surface-900 dark:text-white">Auto-Block High Risk</div>
              <div className="text-xs text-surface-500">Automatically block websites scoring >70% risk.</div>
            </div>
            <button onClick={() => handleToggle('autoBlockHighRisk')} className={`w-10 h-5 rounded-full relative transition-colors ${toggles.autoBlockHighRisk ? 'bg-brand-500' : 'bg-surface-300 dark:bg-surface-700'}`}>
              <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${toggles.autoBlockHighRisk ? 'left-[22px]' : 'left-[3px]'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-surface-900 dark:text-white">Auto-Scan Downloads</div>
              <div className="text-xs text-surface-500">Scan incoming files via AI before saving to disk.</div>
            </div>
            <button onClick={() => handleToggle('autoScanDownloads')} className={`w-10 h-5 rounded-full relative transition-colors ${toggles.autoScanDownloads ? 'bg-brand-500' : 'bg-surface-300 dark:bg-surface-700'}`}>
              <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${toggles.autoScanDownloads ? 'left-[22px]' : 'left-[3px]'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-surface-900 dark:text-white">Strict Privacy Mode</div>
              <div className="text-xs text-surface-500">Do not send full URL telemetry to the SOC dashboard.</div>
            </div>
            <button onClick={() => handleToggle('privacyMode')} className={`w-10 h-5 rounded-full relative transition-colors ${toggles.privacyMode ? 'bg-brand-500' : 'bg-surface-300 dark:bg-surface-700'}`}>
              <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${toggles.privacyMode ? 'left-[22px]' : 'left-[3px]'}`} />
            </button>
          </div>
        </motion.div>

        {/* Interface Settings */}
        <motion.div variants={fadeUp} className="stat-card space-y-6">
          <h2 className="text-sm font-bold text-surface-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-surface-200 dark:border-white/[0.05] pb-2">
            <MonitorSmartphone className="w-4 h-4 text-brand-500" /> Interface & Notifications
          </h2>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-surface-900 dark:text-white">Desktop Notifications</div>
              <div className="text-xs text-surface-500">Receive alerts when threats are blocked.</div>
            </div>
            <button onClick={() => handleToggle('notifications')} className={`w-10 h-5 rounded-full relative transition-colors ${toggles.notifications ? 'bg-brand-500' : 'bg-surface-300 dark:bg-surface-700'}`}>
              <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${toggles.notifications ? 'left-[22px]' : 'left-[3px]'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-surface-900 dark:text-white">Enable AI Explanations</div>
              <div className="text-xs text-surface-500">Show XAI reasoning in browser popups.</div>
            </div>
            <button onClick={() => handleToggle('aiExplanations')} className={`w-10 h-5 rounded-full relative transition-colors ${toggles.aiExplanations ? 'bg-brand-500' : 'bg-surface-300 dark:bg-surface-700'}`}>
              <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${toggles.aiExplanations ? 'left-[22px]' : 'left-[3px]'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-surface-900 dark:text-white">Dark Mode</div>
              <div className="text-xs text-surface-500">Toggle dark theme for the dashboard.</div>
            </div>
            <button onClick={toggleTheme} className={`w-10 h-5 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-brand-500' : 'bg-surface-300'}`}>
              <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${theme === 'dark' ? 'left-[22px]' : 'left-[3px]'}`} />
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
