"use client";
import { Settings, Shield, Globe, Bell, Lock, Sliders, Save } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

export default function SettingsPage() {
  const [threshold, setThreshold] = useState(85);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [urlEnabled, setUrlEnabled] = useState(true);
  const [imageEnabled, setImageEnabled] = useState(true);
  const [notifyOnThreat, setNotifyOnThreat] = useState(true);
  const [notifyOnIncident, setNotifyOnIncident] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const Toggle = ({ on, toggle }: { on: boolean; toggle: () => void }) => (
    <button onClick={toggle} className={`w-10 h-6 rounded-full transition-colors relative ${on ? "bg-brand-600" : "bg-surface-200 dark:bg-surface-700"}`}>
      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${on ? "left-5" : "left-1"}`} />
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white"><Settings className="w-6 h-6 text-brand-600 dark:text-brand-400" /> System Settings</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Configure detection policies and notification preferences</p>
      </div>

      {saved && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-650 dark:text-emerald-400 text-sm">
          Settings saved successfully.
        </motion.div>
      )}

      {/* Detection Settings */}
      <div className="glass-card p-6 space-y-6">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white"><Sliders className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Detection Settings</h3>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-surface-700 dark:text-surface-300">Detection Threshold</label>
              <span className="text-sm font-mono text-brand-650 dark:text-brand-400">{threshold}%</span>
            </div>
            <input type="range" min={50} max={99} value={threshold} onChange={e => setThreshold(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none bg-surface-200 dark:bg-surface-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:cursor-pointer" />
            <p className="text-xs text-surface-500 mt-1">URLs/emails scoring above {threshold}% risk will be flagged as threats</p>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-surface-200 dark:border-white/[0.04]">
            <div><div className="text-sm text-surface-800 dark:text-surface-200">Email AI Model</div><div className="text-xs text-surface-500">DistilBERT + Bi-LSTM phishing detection</div></div>
            <Toggle on={emailEnabled} toggle={() => setEmailEnabled(!emailEnabled)} />
          </div>
          <div className="flex items-center justify-between py-2 border-t border-surface-200 dark:border-white/[0.04]">
            <div><div className="text-sm text-surface-800 dark:text-surface-200">URL AI Model</div><div className="text-xs text-surface-500">4-class BERT URL classification</div></div>
            <Toggle on={urlEnabled} toggle={() => setUrlEnabled(!urlEnabled)} />
          </div>
          <div className="flex items-center justify-between py-2 border-t border-surface-200 dark:border-white/[0.04]">
            <div><div className="text-sm text-surface-800 dark:text-surface-200">Image AI Model</div><div className="text-xs text-surface-500">EfficientNet-B3 visual phishing detection</div></div>
            <Toggle on={imageEnabled} toggle={() => setImageEnabled(!imageEnabled)} />
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white"><Bell className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Notifications</h3>
        <div className="flex items-center justify-between py-2">
          <div><div className="text-sm text-surface-800 dark:text-surface-200">Threat Detection Alerts</div><div className="text-xs text-surface-500">Notify admins when high-risk threats are detected</div></div>
          <Toggle on={notifyOnThreat} toggle={() => setNotifyOnThreat(!notifyOnThreat)} />
        </div>
        <div className="flex items-center justify-between py-2 border-t border-surface-200 dark:border-white/[0.04]">
          <div><div className="text-sm text-surface-800 dark:text-surface-200">Incident Reports</div><div className="text-xs text-surface-500">Notify when employees submit new incident reports</div></div>
          <Toggle on={notifyOnIncident} toggle={() => setNotifyOnIncident(!notifyOnIncident)} />
        </div>
      </div>

      {/* Trusted Domains */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white"><Globe className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Trusted Domains Whitelist</h3>
        <div className="flex flex-wrap gap-2">
          {["google.com", "youtube.com", "linkedin.com", "github.com", "microsoft.com", "wikipedia.org", "facebook.com", "twitter.com", "slack.com", "zoom.us", "espncricinfo.com"].map(d => (
            <span key={d} className="text-xs px-3 py-1.5 rounded-lg bg-surface-100 border border-surface-250 dark:bg-white/[0.03] dark:border-white/[0.06] text-surface-700 dark:text-surface-300 font-mono">{d}</span>
          ))}
        </div>
        <p className="text-xs text-surface-500">URLs from these domains will bypass AI scanning and be marked as verified safe.</p>
      </div>

      <button onClick={handleSave} className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
        <Save className="w-4 h-4" /> Save Settings
      </button>
    </div>
  );
}
