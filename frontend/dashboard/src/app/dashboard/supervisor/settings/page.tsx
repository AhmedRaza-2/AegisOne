"use client";
import { useAuth } from "@/lib/auth-context";
import { Settings, Users, Lock, LogOut, CheckCircle2, XCircle, Building2, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { getApiBaseUrl } from "@/lib/api";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function SupervisorSettingsPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "department" | "account">("profile");

  // Profile Form
  const [fullName, setFullName] = useState(user?.fullName || user?.full_name || "");
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Password Form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Dept info
  const [deptInfo, setDeptInfo] = useState<any>(null);
  const [deptMembers, setDeptMembers] = useState<any[]>([]);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getHeaders = () => {
    const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    return { Authorization: `Bearer ${token || ""}`, "Content-Type": "application/json" };
  };

  // Load department info and members
  useEffect(() => {
    const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    if (!token || !user) return;

    // Load departments to find manager's dept
    fetch(`${getApiBaseUrl()}/admin/departments`, { headers: getHeaders() })
      .then(r => r.json())
      .then(data => {
        if (data && data.departments) {
          const myDept = data.departments.find((d: any) =>
            d.id === user.department_id ||
            d.name === user.department
          );
          if (myDept) setDeptInfo(myDept);
        }
      })
      .catch(() => { });

    // Load users in manager's department
    fetch(`${getApiBaseUrl()}/admin/users`, { headers: getHeaders() })
      .then(r => r.json())
      .then(data => {
        if (data && data.users) {
          setDeptMembers(data.users);
        }
      })
      .catch(() => { });
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setUpdatingProfile(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/profile`, {
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
      const res = await fetch(`${getApiBaseUrl()}/auth/change-password`, {
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

  const inputCls = "w-full px-3.5 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-xl text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500";
  const employees = deptMembers.filter(m => m.role === "employee");
  const managers = deptMembers.filter(m => m.role === "manager");

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-4xl mx-auto">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-white font-medium z-[999] text-sm ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"}`}
          >
            {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <Settings className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Department Settings
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Manage your account profile and view your department details.
        </p>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Navigation Sidebar */}
        <motion.div variants={fadeUp} className="w-full sm:w-56 space-y-1">
          {[
            { id: "profile", label: "Profile & Access", icon: Users },
            { id: "department", label: "Department Overview", icon: Building2 },
            { id: "account", label: "Account Session", icon: LogOut },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === id
                ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                : "text-surface-600 hover:bg-surface-50 dark:text-surface-400 dark:hover:bg-white/[0.02]"
                }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </motion.div>

        {/* Content Area */}
        <motion.div variants={fadeUp} className="flex-1 stat-card">
          {activeTab === "profile" ? (
            <div className="space-y-6">
              {/* Manager profile banner */}
              <div className="p-4 bg-brand-50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-800/20 rounded-xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white text-lg font-bold">
                  {(user.fullName || user.full_name || "M").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <div className="font-semibold text-surface-900 dark:text-white">{user.fullName || user.full_name}</div>
                  <div className="text-xs text-surface-500">{user.email}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-600 text-white px-2 py-0.5 rounded-full">Manager</span>
                    {user.department && (
                      <span className="text-[10px] font-medium text-surface-400">— {user.department}</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-3 pb-2 border-b border-surface-100 dark:border-white/[0.06]">
                  Profile Settings
                </h3>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Manager Full Name</label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Email Address</label>
                    <input type="email" value={user.email} disabled className="w-full px-3.5 py-2 bg-surface-100 dark:bg-white/[0.04] border border-transparent rounded-xl text-sm text-surface-500 cursor-not-allowed" />
                  </div>
                  <button type="submit" disabled={updatingProfile} className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-xl transition-colors disabled:opacity-50">
                    {updatingProfile ? "Saving..." : "Save Changes"}
                  </button>
                </form>
              </div>

              <div className="pt-2">
                <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-3 pb-2 border-b border-surface-100 dark:border-white/[0.06] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-brand-500" /> Security & Password
                </h3>
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Current Password</label>
                    <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">New Password</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Confirm New Password</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} required />
                  </div>
                  <button type="submit" disabled={changingPassword} className="px-4 py-2 bg-surface-900 dark:bg-white text-white dark:text-surface-900 text-xs font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
                    {changingPassword ? "Updating..." : "Update Password"}
                  </button>
                </form>
              </div>
            </div>
          ) : activeTab === "department" ? (
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-surface-900 dark:text-white pb-2 border-b border-surface-100 dark:border-white/[0.06] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-500" /> Department Overview
              </h3>

              {/* Dept Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-surface-50 dark:bg-white/[0.02] rounded-xl border border-surface-100 dark:border-white/[0.04]">
                  <p className="text-[10px] text-surface-400 uppercase tracking-wider mb-1">Department</p>
                  <p className="text-sm font-bold text-surface-900 dark:text-white">{deptInfo?.name || user.department || "—"}</p>
                </div>
                <div className="p-3 bg-surface-50 dark:bg-white/[0.02] rounded-xl border border-surface-100 dark:border-white/[0.04]">
                  <p className="text-[10px] text-surface-400 uppercase tracking-wider mb-1">Your Role</p>
                  <p className="text-sm font-bold text-brand-600 dark:text-brand-400">Manager</p>
                </div>
                <div className="p-3 bg-surface-50 dark:bg-white/[0.02] rounded-xl border border-surface-100 dark:border-white/[0.04]">
                  <p className="text-[10px] text-surface-400 uppercase tracking-wider mb-1">Total Members</p>
                  <p className="text-sm font-bold text-surface-900 dark:text-white">{deptMembers.length}</p>
                </div>
              </div>

              {/* Employee list */}
              {deptMembers.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-3">
                    Department Members ({deptMembers.length})
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {deptMembers.map((member: any) => (
                      <div key={member.id} className="flex items-center gap-3 p-3 bg-surface-50 dark:bg-white/[0.02] rounded-xl border border-surface-100 dark:border-white/[0.04]">
                        <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-[10px] font-bold text-brand-700 dark:text-brand-300">
                          {(member.full_name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                            {member.full_name}
                            {member.id === user.id && <span className="ml-1 text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">You</span>}
                          </p>
                          <p className="text-[10px] text-surface-400 truncate">{member.email}</p>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${member.role === "manager"
                          ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
                          : "bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-300"
                          }`}>
                          {member.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {deptMembers.length === 0 && (
                <p className="text-sm text-surface-400 text-center py-6">No members found in your department.</p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-2">Account Session</h3>
                <p className="text-xs text-surface-500 mb-4">You are logged in as supervisor ({user.email}).</p>
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
