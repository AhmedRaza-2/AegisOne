"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { Settings, Shield, Bell, EyeOff, MonitorSmartphone, Cpu, Download, User, Key, LogOut } from "lucide-react";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function SettingsPage() {
  const { user, theme, toggleTheme, logout } = useAuth();
  const router = useRouter();
  
  // Local state for UI toggles (for FYP presentation)
  const [toggles, setToggles] = useState({
    notifications: true,
    aiExplanations: true,
    autoScanDownloads: true,
    autoScanQR: true,
    autoBlockHighRisk: true,
    privacyMode: false,
    manualScanOnly: false,
    formProtection: true,
    hoverPreviews: true,
    sandboxMode: false,
  });

  const handleToggle = (key: keyof typeof toggles) => {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!user) return null;

  const handleResetPassword = async () => {
    alert("Password reset link has been sent to your registered email.");
  };

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const handleContactManager = () => {
    alert("Your message has been sent to the IT Manager.");
    // Simulate a reply after 2 seconds
    setTimeout(() => {
      alert("New Notification: The IT Manager replied to your message.\n\n'Thanks for letting us know, we are looking into it now.'");
    }, 2000);
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-4xl mx-auto">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <Settings className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Account Settings
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Manage your AegisOne profile and platform preferences.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <motion.div variants={fadeUp} className="stat-card space-y-6">
          <h2 className="text-sm font-bold text-surface-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-surface-200 dark:border-white/[0.05] pb-2">
            <User className="w-4 h-4 text-brand-500" /> Profile & Appearance
          </h2>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-xl border border-brand-200 dark:border-brand-800">
                {user.email?.[0].toUpperCase() || "U"}
              </div>
              <div>
                <div className="font-semibold text-surface-900 dark:text-white">{user.email}</div>
                <div className="text-xs text-surface-500 capitalize">{user.role}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-surface-200 dark:border-white/[0.05]">
            <div>
              <div className="font-semibold text-surface-900 dark:text-white">Appearance (Theme)</div>
              <div className="text-xs text-surface-500">Toggle dark theme for the dashboard.</div>
            </div>
            <button onClick={toggleTheme} className={`w-10 h-5 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-brand-500' : 'bg-surface-300 dark:bg-surface-700'}`}>
              <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${theme === 'dark' ? 'left-[22px]' : 'left-[3px]'}`} />
            </button>
          </div>
        </motion.div>

        {/* Security & Support */}
        <motion.div variants={fadeUp} className="stat-card space-y-6">
          <h2 className="text-sm font-bold text-surface-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-surface-200 dark:border-white/[0.05] pb-2">
            <Shield className="w-4 h-4 text-emerald-500" /> Security & Support
          </h2>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-surface-900 dark:text-white">Account Password</div>
              <div className="text-xs text-surface-500">Update or reset your login credentials.</div>
            </div>
            <button onClick={handleResetPassword} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md bg-surface-100 dark:bg-white/[0.05] text-surface-900 dark:text-white hover:bg-surface-200 dark:hover:bg-white/[0.1] transition-colors border border-surface-200 dark:border-white/[0.05]">
              <Key className="w-3.5 h-3.5" />
              Reset Password
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-surface-200 dark:border-white/[0.05]">
            <div className="w-full">
              <div className="font-semibold text-surface-900 dark:text-white mb-2">Message IT Manager</div>
              <textarea 
                placeholder="Describe your issue or request here..." 
                className="w-full text-sm bg-surface-50 dark:bg-[#0B0F19] border border-surface-200 dark:border-white/[0.1] rounded-lg p-3 text-surface-900 dark:text-white resize-none h-20 outline-none focus:border-brand-500 dark:focus:border-[#4F84F8] transition-colors"
              />
              <div className="flex justify-end mt-2">
                <button onClick={handleContactManager} className="px-4 py-2 text-xs font-semibold rounded-md bg-brand-600 hover:bg-brand-700 dark:bg-[#4F84F8] dark:hover:bg-[#3D6CE5] text-white transition-colors">
                  Send Message
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-surface-200 dark:border-white/[0.05]">
            <div>
              <div className="font-semibold text-surface-900 dark:text-white">Active Session</div>
              <div className="text-xs text-surface-500">Sign out of your current session on this device.</div>
            </div>
            <div className="flex-shrink-0">
              <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors whitespace-nowrap">
                <LogOut className="w-3.5 h-3.5" />
                Log Out
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
