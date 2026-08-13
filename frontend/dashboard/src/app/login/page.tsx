"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Shield, Mail, Lock, ArrowLeft, Building, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { API_BASE } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [resetMode, setResetMode] = useState(false);
  const [otp, setOtp] = useState("");
  const [requestedRole, setRequestedRole] = useState("employee");

  useEffect(() => {
    // Check if the user just registered
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("registered") === "true") {
        setSuccessMsg("Registration successful. Please wait for an admin to approve your account.");
      }
    }
  }, []);

  const [detectedRole, setDetectedRole] = useState<string>("employee");

  // Auto-detect assigned user role when email changes
  const handleEmailBlur = async () => {
    if (!email || !email.includes("@")) return;
    try {
      const res = await fetch(`${API_BASE}/auth/check-role?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.exists && data.role) {
          setDetectedRole(data.role.toLowerCase());
        }
      }
    } catch (e) {
      console.warn("[Login] Could not auto-detect role:", e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      const dbRole = result.role?.toLowerCase() || detectedRole || "employee";
      const dest = (dbRole === "admin" || dbRole === "super_admin")
        ? "/dashboard/admin"
        : (dbRole === "manager" || dbRole === "department_admin")
          ? "/dashboard/supervisor"
          : "/dashboard/employee";
      router.push(dest);
    } else {
      setLoading(false);
      setError(result.error || "Invalid credentials.");
    }
  };

  const [resetStep, setResetStep] = useState<"none" | "otp" | "new_password">("none");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (!res.ok) {
        throw new Error("Failed to send reset code.");
      }
      setSuccessMsg("A 6-digit verification code has been sent to your email.");
      setResetStep("otp");
    } catch (err: any) {
      setError(err.message || "Failed to reset password. Please contact your admin.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/verify-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Invalid verification code.");
      }
      setSuccessMsg("Code verified! Please enter your new password below.");
      setResetStep("new_password");
    } catch (err: any) {
      setError(err.message || "Failed to verify code.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, new_password: newPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to reset password.");
      }
      setSuccessMsg(data.message || "Password updated successfully! Please log in.");
      setPassword(newPassword);
      setResetStep("none");
      setOtp("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-white flex items-center justify-center p-6 transition-colors duration-300">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">

        {/* Card */}
        <div className="glass-card p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-3">
              <img src="/logo.png" alt="AegisOne Logo" className="w-16 h-16 object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Welcome back</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Sign in to your AegisOne dashboard</p>
          </div>

          {/* Reset Step 1: Verify OTP */}
          {resetStep === "otp" ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {successMsg && <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-600 dark:text-green-400 text-center">{successMsg}</div>}
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">6-Digit Verification Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  required
                  className="w-full px-4 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all text-center tracking-widest text-lg font-mono font-bold"
                />
              </div>
              {error && <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>}
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-2.5 mt-2 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Verifying...
                  </>
                ) : "Verify Code"}
              </button>
              <button
                type="button"
                onClick={() => setResetStep("none")}
                className="w-full py-2 mt-2 text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </form>
          ) : resetStep === "new_password" ? (
            /* Reset Step 2: Set New Password */
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              {successMsg && <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-600 dark:text-green-400 text-center">{successMsg}</div>}
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter your new password"
                    required
                    className="w-full pl-4 pr-10 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    className="w-full pl-4 pr-10 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>}
              <button
                type="submit"
                disabled={loading || !newPassword || !confirmNewPassword}
                className="w-full py-2.5 mt-2 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Updating Password...
                  </>
                ) : "Set New Password & Log In"}
              </button>
              <button
                type="button"
                onClick={() => setResetStep("none")}
                className="w-full py-2 mt-2 text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {successMsg && <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-600 dark:text-green-400 text-center">{successMsg}</div>}

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={handleEmailBlur}
                    placeholder="you@company.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                error.includes("awaiting admin approval")
                  ? <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-600 dark:text-yellow-400 text-center">{error}</div>
                  : <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Signing in...
                  </>
                ) : "Sign In"}
              </button>
            </form>
          )}

          {resetStep === "none" && (
            <p className="text-center text-sm text-surface-500 dark:text-surface-400 mt-6">
              <button onClick={handleForgotPassword} type="button" disabled={loading || !email} className="text-brand-600 hover:text-brand-500 dark:text-brand-400 font-medium disabled:opacity-50">Forgot your password?</button>
            </p>
          )}

        </div>

        <p className="text-center text-xs text-surface-500 dark:text-surface-600 mt-6">
          AegisOne Platform Enterprise Access Management
        </p>
      </motion.div>
    </div>
  );
}

