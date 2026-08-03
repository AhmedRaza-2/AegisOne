"use client";
import { useAuth } from "@/lib/auth-context";
import { Settings, Shield, User, Lock, LogOut, CheckCircle2, XCircle, Globe, Sliders } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function AdminSettingsPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "detection" | "account">("profile");

  // Profile Form
  const [fullName, setFullName] = useState(user?.fullName || user?.full_name || "");
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Password Form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [threshold, setThreshold] = useState(85);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [urlEnabled, setUrlEnabled] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Load policies from backend on mount
  useEffect(() => {
    const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    if (!token) return;
    fetch("http://localhost:8000/admin/policies", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        const policies = data.policies || [];
        const thresholdPol = policies.find((p: any) => p.policy_type === "risk_threshold");
        const emailPol = policies.find((p: any) => p.policy_type === "email_detection");
        const urlPol = policies.find((p: any) => p.policy_type === "url_detection");
        if (thresholdPol) setThreshold(parseInt(thresholdPol.value) || 85);
        if (emailPol) setEmailEnabled(emailPol.action !== "disabled");
        if (urlPol) setUrlEnabled(urlPol.action !== "disabled");
      })
      .catch(() => { });
  }, []);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getHeaders = () => {
    const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    return { Authorization: `Bearer ${token || ""}`, "Content-Type": "application/json" };
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setUpdatingProfile(true);
    try {
      const res = await fetch("http://localhost:8000/auth/profile", {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ full_name: fullName.trim() }),
      });
      if (res.ok) {
        showToast("Admin profile updated", "success");
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to update profile", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match", "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch("http://localhost:8000/auth/change-password", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      if (res.ok) {
        showToast("Password updated successfully", "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to change password", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setChangingPassword(false);
    }
  };

  const Toggle = ({ on, toggle }: { on: boolean; toggle: () => void }) => (
    <button
      type="button"
      onClick={toggle}
      className={`w-10 h-6 rounded-full transition-colors relative ${on ? "bg-brand-600" : "bg-surface-200 dark:bg-surface-700"}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${on ? "left-5" : "left-1"}`} />
    </button>
  );

  if (!user) return null;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-4xl mx-auto">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-white font-medium z-[999] text-sm ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
              }`}
          >
            {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <Settings className="w-6 h-6 text-brand-600 dark:text-brand-400" /> Admin Settings
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Manage system administration, security controls, and admin profile.
        </p>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Navigation Sidebar */}
        <motion.div variants={fadeUp} className="w-full sm:w-56 space-y-1">
          <button
            onClick={() => setActiveTab("profile")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "profile"
                ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                : "text-surface-600 hover:bg-surface-50 dark:text-surface-400 dark:hover:bg-white/[0.02]"
              }`}
          >
            <User className="w-4 h-4" /> Profile & Password
          </button>
          <button
            onClick={() => setActiveTab("detection")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "detection"
                ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                : "text-surface-600 hover:bg-surface-50 dark:text-surface-400 dark:hover:bg-white/[0.02]"
              }`}
          >
            <Sliders className="w-4 h-4" /> Detection Policy
          </button>
          <button
            onClick={() => setActiveTab("account")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "account"
                ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                : "text-surface-600 hover:bg-surface-50 dark:text-surface-400 dark:hover:bg-white/[0.02]"
              }`}
          >
            <LogOut className="w-4 h-4" /> Account Session
          </button>
        </motion.div>

        {/* Content Area */}
        <motion.div variants={fadeUp} className="flex-1 stat-card">
          {activeTab === "profile" ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-3 pb-2 border-b border-surface-100 dark:border-white/[0.06]">
                  Admin Details
                </h3>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Administrator Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-xl text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={user.email}
                      disabled
                      className="w-full px-3.5 py-2 bg-surface-100 dark:bg-white/[0.04] border border-transparent rounded-xl text-sm text-surface-500 cursor-not-allowed"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={updatingProfile}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
                  >
                    {updatingProfile ? "Saving..." : "Save Profile"}
                  </button>
                </form>
              </div>

              <div className="pt-2">
                <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-3 pb-2 border-b border-surface-100 dark:border-white/[0.06] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-brand-500" /> Admin Password Change
                </h3>
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3.5 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-xl text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3.5 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-xl text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-xl text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="px-4 py-2 bg-surface-900 dark:bg-white text-white dark:text-surface-900 text-xs font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {changingPassword ? "Updating..." : "Update Password"}
                  </button>
                </form>
              </div>
            </div>
          ) : activeTab === "detection" ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-surface-900 dark:text-white pb-2 border-b border-surface-100 dark:border-white/[0.06]">
                Security Policy Controls
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-surface-600 dark:text-surface-400 font-medium">Detection Risk Threshold</label>
                    <span className="text-xs font-mono text-brand-600 dark:text-brand-400 font-bold">{threshold}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={99}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none bg-surface-200 dark:bg-surface-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <p className="text-[11px] text-surface-500 mt-1">Scans scoring above {threshold}% risk level will trigger system alerts.</p>
                </div>

                <div className="flex items-center justify-between py-2 border-t border-surface-100 dark:border-white/[0.04]">
                  <div>
                    <div className="text-xs font-medium text-surface-900 dark:text-white">Email AI Detection Engine</div>
                    <div className="text-[11px] text-surface-500">Phishing analysis on email content</div>
                  </div>
                  <Toggle on={emailEnabled} toggle={() => setEmailEnabled(!emailEnabled)} />
                </div>

                <div className="flex items-center justify-between py-2 border-t border-surface-100 dark:border-white/[0.04]">
                  <div>
                    <div className="text-xs font-medium text-surface-900 dark:text-white">URL Classifier Model</div>
                    <div className="text-[11px] text-surface-500">Malicious URL & domain analysis</div>
                  </div>
                  <Toggle on={urlEnabled} toggle={() => setUrlEnabled(!urlEnabled)} />
                </div>
                <div className="pt-4">
                  <button
                    onClick={async () => {
                      setSavingPolicy(true);
                      try {
                        const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
                        await fetch("http://localhost:8000/admin/policies", {
                          method: "POST",
                          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                          body: JSON.stringify([
                            { policy_type: "risk_threshold", value: String(threshold), action: "alert" },
                            { policy_type: "email_detection", value: "enabled", action: emailEnabled ? "scan" : "disabled" },
                            { policy_type: "url_detection", value: "enabled", action: urlEnabled ? "scan" : "disabled" },
                          ])
                        });
                        showToast("Detection policy saved", "success");
                      } catch {
                        showToast("Failed to save policy", "error");
                      } finally {
                        setSavingPolicy(false);
                      }
                    }}
                    disabled={savingPolicy}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
                  >
                    {savingPolicy ? "Saving..." : "Save Detection Policy"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-2">Admin Session</h3>
                <p className="text-xs text-surface-500 mb-4">You are authenticated as administrator ({user.email}).</p>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-xl flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Secure Logout
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

