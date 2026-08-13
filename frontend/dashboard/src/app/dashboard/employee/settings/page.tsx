"use client";
import { useAuth } from "@/lib/auth-context";
import { Settings, User, Lock, LogOut, CheckCircle2, XCircle, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function EmployeeSettingsPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "account">("profile");

  // Profile Form State
  const [fullName, setFullName] = useState(user?.fullName || user?.full_name || "");
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

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
        showToast("Profile updated successfully", "success");
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
          <Settings className="w-6 h-6 text-brand-600 dark:text-brand-400" /> Account Settings
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Manage your personal profile and security preferences.
        </p>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Navigation Tabs */}
        <motion.div variants={fadeUp} className="w-full sm:w-56 space-y-1">
          <button
            onClick={() => setActiveTab("profile")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "profile"
                ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                : "text-surface-600 hover:bg-surface-50 dark:text-surface-400 dark:hover:bg-white/[0.02]"
              }`}
          >
            <User className="w-4 h-4" /> Profile & Security
          </button>
          <button
            onClick={() => setActiveTab("account")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "account"
                ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                : "text-surface-600 hover:bg-surface-50 dark:text-surface-400 dark:hover:bg-white/[0.02]"
              }`}
          >
            <Shield className="w-4 h-4" /> Account Session
          </button>
        </motion.div>

        {/* Content Area */}
        <motion.div variants={fadeUp} className="flex-1 stat-card">
          {activeTab === "profile" ? (
            <div className="space-y-6">
              {/* Profile Details */}
              <div>
                <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-3 pb-2 border-b border-surface-100 dark:border-white/[0.06]">
                  Personal Profile
                </h3>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Full Name</label>
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
                    <p className="text-[10px] text-surface-400 mt-1">Email address cannot be changed directly.</p>
                  </div>
                  <button
                    type="submit"
                    disabled={updatingProfile}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
                  >
                    {updatingProfile ? "Saving..." : "Save Changes"}
                  </button>
                </form>
              </div>

              {/* Password Change */}
              <div className="pt-2">
                <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-3 pb-2 border-b border-surface-100 dark:border-white/[0.06] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-brand-500" /> Change Password
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
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-2">Active Session</h3>
                <p className="text-xs text-surface-500 mb-4">You are logged in as {user.email}.</p>
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

