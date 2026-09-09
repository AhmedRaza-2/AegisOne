"use client";
import { useAuth } from "@/lib/auth-context";
import { Settings, Shield, User, Lock, LogOut, CheckCircle2, XCircle, Globe, Sliders, Mail, Building2, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { getApiBaseUrl } from "@/lib/api";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function AdminSettingsPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "smtp" | "org" | "detection" | "account">("profile");

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

  // SMTP Settings
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [smtpLoaded, setSmtpLoaded] = useState(false);

  // Org Info
  const [departments, setDepartments] = useState<any[]>([]);
  const [orgLoaded, setOrgLoaded] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getHeaders = () => {
    const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    return { Authorization: `Bearer ${token || ""}`, "Content-Type": "application/json" };
  };

  // Load policies
  useEffect(() => {
    const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    if (!token) return;
    fetch(`${getApiBaseUrl()}/admin/policies`, {
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

  // Load SMTP settings
  useEffect(() => {
    if (smtpLoaded) return;
    const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    if (!token) return;
    fetch(`${getApiBaseUrl()}/admin/smtp-settings`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data && !data.detail) {
          setSmtpHost(data.smtp_host || "smtp.gmail.com");
          setSmtpPort(String(data.smtp_port || 587));
          setSmtpUser(data.smtp_user || "");
          setSmtpPass(data.smtp_pass || "");
          setSmtpLoaded(true);
        }
      })
      .catch(() => { });
  }, [smtpLoaded]);

  // Load departments & org info
  useEffect(() => {
    if (orgLoaded) return;
    const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    if (!token) return;
    fetch(`${getApiBaseUrl()}/admin/departments`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data && data.departments) {
          setDepartments(data.departments);
          setOrgLoaded(true);
        }
      })
      .catch(() => { });
  }, [orgLoaded]);

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

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSmtp(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/smtp-settings`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({
          smtp_host: smtpHost.trim(),
          smtp_port: parseInt(smtpPort) || 587,
          smtp_user: smtpUser.trim(),
          smtp_pass: smtpPass.trim()
        }),
      });
      if (res.ok) {
        showToast("SMTP settings saved successfully", "success");
        setSmtpLoaded(false); // reload to confirm
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to save SMTP settings", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setSavingSmtp(false);
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

  const inputCls = "w-full px-3.5 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-xl text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500";

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
          <Settings className="w-6 h-6 text-brand-600 dark:text-brand-400" /> Admin Settings
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Manage system administration, SMTP configuration, security controls, and admin profile.
        </p>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Navigation Sidebar */}
        <motion.div variants={fadeUp} className="w-full sm:w-56 space-y-1">
          {[
            { id: "profile", label: "Profile & Password", icon: User },
            { id: "smtp", label: "Email / SMTP", icon: Mail },
            { id: "org", label: "Organization Info", icon: Building2 },
            { id: "detection", label: "Detection Policy", icon: Sliders },
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
              {/* Admin Info Banner */}
              <div className="p-4 bg-brand-50 dark:bg-brand-900/10 rounded-xl border border-brand-100 dark:border-brand-800/20 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white text-lg font-bold">
                  {(user.fullName || user.full_name || "A").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <div className="font-semibold text-surface-900 dark:text-white">{user.fullName || user.full_name}</div>
                  <div className="text-xs text-surface-500">{user.email}</div>
                  <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider bg-brand-600 text-white px-2 py-0.5 rounded-full">Administrator</span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-3 pb-2 border-b border-surface-100 dark:border-white/[0.06]">
                  Admin Details
                </h3>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Administrator Full Name</label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Email Address</label>
                    <input type="email" value={user.email} disabled className="w-full px-3.5 py-2 bg-surface-100 dark:bg-white/[0.04] border border-transparent rounded-xl text-sm text-surface-500 cursor-not-allowed" />
                  </div>
                  <button type="submit" disabled={updatingProfile} className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-xl transition-colors disabled:opacity-50">
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
          ) : activeTab === "smtp" ? (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-surface-900 dark:text-white pb-2 border-b border-surface-100 dark:border-white/[0.06] flex items-center gap-2">
                  <Mail className="w-4 h-4 text-brand-500" /> SMTP Email Configuration
                </h3>
                <p className="text-xs text-surface-500 mt-2 mb-4">
                  Used for sending welcome emails to new employees, password reset emails, and security notifications.
                  These credentials were configured during the Setup Wizard and can be updated here.
                </p>
              </div>
              <form onSubmit={handleSaveSmtp} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">SMTP Host</label>
                    <input
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      className={inputCls}
                      placeholder="smtp.gmail.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">SMTP Port</label>
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      className={inputCls}
                      placeholder="587"
                      required
                    />
                    <p className="text-[10px] text-surface-400 mt-1">Use 587 (TLS) or 465 (SSL)</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">SMTP Username / Email</label>
                  <input
                    type="email"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    className={inputCls}
                    placeholder="your-smtp-email@gmail.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">SMTP App Password</label>
                  <input
                    type="password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    className={inputCls}
                    placeholder="Enter new password or leave as-is"
                  />
                  <p className="text-[10px] text-surface-400 mt-1">For Gmail, use an App Password (not your main password). Leave blank to keep existing.</p>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-400">Gmail App Password Required</p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-500 mt-0.5">
                        Go to Google Account → Security → 2-Step Verification → App passwords. Select "Mail" and generate a password.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingSmtp}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {savingSmtp ? "Saving..." : "Save SMTP Settings"}
                </button>
              </form>
            </div>
          ) : activeTab === "org" ? (
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-surface-900 dark:text-white pb-2 border-b border-surface-100 dark:border-white/[0.06] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-500" /> Organization Overview
              </h3>

              {/* Admin's own info */}
              <div className="p-4 bg-surface-50 dark:bg-white/[0.02] rounded-xl border border-surface-100 dark:border-white/[0.05] space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-surface-500">Your Account</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] text-surface-400">Full Name</p>
                    <p className="font-semibold text-surface-900 dark:text-white">{user.fullName || user.full_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-surface-400">Role</p>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400 capitalize">Administrator</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-surface-400">Email</p>
                    <p className="font-semibold text-surface-900 dark:text-white text-xs">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-surface-400">Department</p>
                    <p className="font-semibold text-surface-900 dark:text-white">{user.department || "Administration"}</p>
                  </div>
                </div>
              </div>

              {/* Departments */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-3">Departments</h4>
                <div className="space-y-2">
                  {departments.length === 0 ? (
                    <p className="text-sm text-surface-400 text-center py-4">No departments found.</p>
                  ) : departments.map((dept: any) => (
                    <div key={dept.id} className="p-3 bg-surface-50 dark:bg-white/[0.02] rounded-xl border border-surface-100 dark:border-white/[0.04]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-surface-900 dark:text-white">{dept.name}</p>
                            <p className="text-[10px] text-surface-400">Manager: {dept.manager_name || "Unassigned"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-surface-400" />
                          <span className="text-sm font-bold text-surface-700 dark:text-surface-300">{dept.employee_count}</span>
                          <span className="text-xs text-surface-400">employees</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
                        await fetch(`${getApiBaseUrl()}/admin/policies`, {
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
