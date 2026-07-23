"use client";
import { useAuth } from "@/lib/auth-context";
import { Settings, ShieldCheck, Monitor, Bell, BrainCircuit, Activity, Lock, Users, LogOut, CheckCircle, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

// Mock Compliance Data
const complianceData = [
  { id: 1, name: "Ahmed Raza", device: "DESKTOP-AR-IT", extension: true, os: "Windows 11", lastCheck: "10 mins ago" },
  { id: 2, name: "Ali Khan", device: "MAC-AK-DEV", extension: true, os: "macOS 14", lastCheck: "1 hour ago" },
  { id: 3, name: "Sara Ahmed", device: "DESKTOP-SA-FIN", extension: false, os: "Windows 10", lastCheck: "3 days ago" },
  { id: 4, name: "Fatima Noor", device: "MAC-FN-HR", extension: true, os: "macOS 14", lastCheck: "20 mins ago" },
];

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [notifications, setNotifications] = useState(true);
  const [aiStrictness, setAiStrictness] = useState("Balanced");
  
  if (!user) return null;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-6xl mx-auto">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <Settings className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Department Settings
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Manage {user.department} configuration, devices, and AI compliance policies.
        </p>
      </motion.div>

      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Settings Sidebar */}
        <motion.div variants={fadeUp} className="w-full md:w-64 space-y-2">
          <button onClick={() => setActiveTab("profile")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "profile" ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400" : "text-surface-600 hover:bg-surface-50 dark:text-surface-400 dark:hover:bg-white/[0.02]"}`}>
            <Users className="w-4 h-4" /> Profile & Access
          </button>
          <button onClick={() => setActiveTab("compliance")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "compliance" ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400" : "text-surface-600 hover:bg-surface-50 dark:text-surface-400 dark:hover:bg-white/[0.02]"}`}>
            <Monitor className="w-4 h-4" /> Device Compliance
          </button>
          <button onClick={() => setActiveTab("ai")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "ai" ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400" : "text-surface-600 hover:bg-surface-50 dark:text-surface-400 dark:hover:bg-white/[0.02]"}`}>
            <BrainCircuit className="w-4 h-4" /> AI Configurations
          </button>
          <button onClick={() => setActiveTab("notifications")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "notifications" ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400" : "text-surface-600 hover:bg-surface-50 dark:text-surface-400 dark:hover:bg-white/[0.02]"}`}>
            <Bell className="w-4 h-4" /> Alerts & Notifications
          </button>
        </motion.div>

        {/* Settings Content */}
        <motion.div variants={fadeUp} className="flex-1 space-y-6">
          
          {/* Phase 10: Profile & Access */}
          {activeTab === "profile" && (
            <div className="stat-card">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-6 flex items-center gap-2"><Lock className="w-5 h-5 text-brand-500" /> Account Security</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Full Name</label>
                  <input type="text" disabled value={user.fullName} className="w-full max-w-md px-3 py-2 bg-surface-100 dark:bg-surface-900/50 border border-surface-200 dark:border-white/[0.05] rounded-lg text-sm text-surface-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Email Address</label>
                  <input type="email" disabled value={user.email} className="w-full max-w-md px-3 py-2 bg-surface-100 dark:bg-surface-900/50 border border-surface-200 dark:border-white/[0.05] rounded-lg text-sm text-surface-500 cursor-not-allowed" />
                </div>
                <div className="pt-4 border-t border-surface-200 dark:border-white/[0.05]">
                  <button onClick={logout} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                    <LogOut className="w-4 h-4" /> Secure Logout
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Phase 11 & 12: Device & Compliance Module */}
          {activeTab === "compliance" && (
            <div className="stat-card">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-500" /> Department Compliance Monitor</h3>
              <p className="text-sm text-surface-500 mb-6">Track AegisOne extension installation and OS compliance across all {user.department} devices.</p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-surface-200 dark:border-white/[0.06]">
                      <th className="px-4 py-3 font-medium text-surface-500">Employee</th>
                      <th className="px-4 py-3 font-medium text-surface-500">Device ID</th>
                      <th className="px-4 py-3 font-medium text-surface-500">OS</th>
                      <th className="px-4 py-3 font-medium text-surface-500">AegisOne Extension</th>
                      <th className="px-4 py-3 font-medium text-surface-500">Last Sync</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complianceData.map(device => (
                      <tr key={device.id} className="border-b border-surface-100 dark:border-white/[0.03]">
                        <td className="px-4 py-3 font-medium text-surface-900 dark:text-white">{device.name}</td>
                        <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{device.device}</td>
                        <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{device.os}</td>
                        <td className="px-4 py-3">
                          {device.extension ? (
                            <span className="flex items-center gap-1.5 text-emerald-500"><CheckCircle className="w-4 h-4" /> Active</span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-red-500"><XCircle className="w-4 h-4" /> Missing</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-surface-500 text-xs">{device.lastCheck}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Phase 13: AI Insight Generation Preferences */}
          {activeTab === "ai" && (
            <div className="stat-card">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2 flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-brand-500" /> AI Threat Analysis Settings</h3>
              <p className="text-sm text-surface-500 mb-6">Configure how AegisOne's local AI handles edge cases for the {user.department} department.</p>
              
              <div className="space-y-6 max-w-xl">
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-3">Threat Detection Strictness</label>
                  <div className="grid grid-cols-3 gap-3">
                    {["Lenient", "Balanced", "Aggressive"].map((level) => (
                      <button 
                        key={level}
                        onClick={() => setAiStrictness(level)}
                        className={`p-3 text-sm font-medium rounded-xl border transition-all ${aiStrictness === level ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400 ring-1 ring-brand-500" : "border-surface-200 dark:border-white/[0.08] text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-white/[0.02]"}`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-surface-500 mt-2">
                    {aiStrictness === "Lenient" && "AI will only block known malicious signatures. High false-negative risk."}
                    {aiStrictness === "Balanced" && "AI balances zero-day heuristics with signature scanning. Recommended."}
                    {aiStrictness === "Aggressive" && "AI will quarantine any anomalous behavior. High false-positive risk."}
                  </p>
                </div>

                <div className="pt-6 border-t border-surface-200 dark:border-white/[0.06]">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-surface-900 dark:text-white">Auto-Escalate Zero-Day Threats</div>
                      <div className="text-xs text-surface-500">Automatically push critical AI predictions to the Global Admin queue.</div>
                    </div>
                    <div className="relative">
                      <input type="checkbox" className="sr-only" defaultChecked />
                      <div className="w-10 h-6 bg-brand-500 rounded-full"></div>
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform translate-x-4"></div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="stat-card">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-6 flex items-center gap-2"><Bell className="w-5 h-5 text-brand-500" /> Alert Preferences</h3>
              
              <div className="space-y-6 max-w-xl">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="text-sm font-medium text-surface-900 dark:text-white">Critical Incident Alerts</div>
                    <div className="text-xs text-surface-500">Receive email notifications when an employee risk score hits 80+.</div>
                  </div>
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={notifications} onChange={() => setNotifications(!notifications)} />
                    <div className={`w-10 h-6 rounded-full transition-colors ${notifications ? "bg-brand-500" : "bg-surface-300 dark:bg-surface-700"}`}></div>
                    <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${notifications ? "translate-x-4" : "translate-x-0"}`}></div>
                  </div>
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="text-sm font-medium text-surface-900 dark:text-white">Weekly Report Digest</div>
                    <div className="text-xs text-surface-500">Receive an automated PDF summary of department security every Monday.</div>
                  </div>
                  <div className="relative">
                    <input type="checkbox" className="sr-only" defaultChecked />
                    <div className="w-10 h-6 bg-brand-500 rounded-full"></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform translate-x-4"></div>
                  </div>
                </label>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
