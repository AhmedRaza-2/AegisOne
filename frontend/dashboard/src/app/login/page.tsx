"use client";
<<<<<<< Updated upstream
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Shield, Mail, Lock, ArrowLeft, Building, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const { login } = useAuth();
=======
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Shield, Mail, Lock, ArrowLeft, Users, UserCog, User, Globe } from "lucide-react";
import { motion } from "framer-motion";
import type { Role } from "@/lib/mock-data";

export default function LoginPage() {
  const { login, loginAs } = useAuth();
>>>>>>> Stashed changes
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
<<<<<<< Updated upstream
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
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
=======
  const [loading, setLoading] = useState(false);
>>>>>>> Stashed changes

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
<<<<<<< Updated upstream
    setSuccessMsg("");
    setLoading(true);
    
    const result = await login(email, password);
    setLoading(false);
    
    if (result.success) {
      const dbRole = result.role?.toLowerCase() || "employee";
      
      // Strict matching for security: The DB role must map correctly to the portal they are trying to access
      if (
        (requestedRole === "employee" && dbRole !== "employee") ||
        (requestedRole === "manager" && dbRole !== "manager" && dbRole !== "department_admin") ||
        (requestedRole === "admin" && dbRole !== "admin" && dbRole !== "super_admin")
      ) {
        setError("Access Denied: The selected role portal does not match your assigned account permissions.");
        return;
      }

      const dest = requestedRole === "admin" 
        ? "/dashboard/admin" 
        : requestedRole === "manager"
        ? "/dashboard/supervisor" 
        : "/dashboard/employee";
      router.push(dest);
    } else {
      setError(result.error || "Invalid credentials.");
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://127.0.0.1:8000/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (!res.ok) {
        throw new Error("Failed to send reset code.");
      }
      setSuccessMsg("A 6-digit verification code has been sent to your email.");
      setResetMode(true);
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
      const res = await fetch("http://127.0.0.1:8000/auth/verify-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Invalid code.");
      }
      setSuccessMsg("Success! Your new temporary password has been emailed to you.");
      setResetMode(false);
      setOtp("");
    } catch (err: any) {
      setError(err.message || "Failed to verify code.");
    } finally {
      setLoading(false);
    }
  };
=======
    setLoading(true);
    const ok = await login(email, password);
    setLoading(false);
    if (ok) {
      // Redirect based on role (fetched from mock)
      const { users } = await import("@/lib/mock-data");
      const u = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (u) {
        const dest = (u.role === "super_admin" || u.role === "global_admin") ? "/dashboard/admin" : u.role === "office_admin" ? "/dashboard/supervisor" : "/dashboard/employee";
        router.push(dest);
      }
    } else {
      setError("Invalid credentials. Try one of the sandbox credentials below.");
    }
  };

  const handleQuickLogin = (role: Role) => {
    loginAs(role);
    const dest = (role === "super_admin" || role === "global_admin") ? "/dashboard/admin" : role === "office_admin" ? "/dashboard/supervisor" : "/dashboard/employee";
    router.push(dest);
  };

  const quickLogins: { role: Role; label: string; email: string; icon: typeof Users; color: string }[] = [
    { role: "global_admin", label: "Platform Head (Global)", email: "head@aegisone.com", icon: Globe as any, color: "border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/5" },
    { role: "super_admin", label: "Super Admin (Organization)", email: "admin@ubank.com.pk", icon: Users, color: "border-red-500/30 hover:border-red-500/60 hover:bg-red-500/5" },
    { role: "office_admin", label: "Supervisor (Manager)", email: "ahmed.raza@ubank.com.pk", icon: UserCog as any, color: "border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5" },
    { role: "employee", label: "Employee (End User)", email: "ali.mazhar@ubank.com.pk", icon: User as any, color: "border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5" },
  ];
>>>>>>> Stashed changes

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-white flex items-center justify-center p-6 transition-colors duration-300">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
<<<<<<< Updated upstream
=======
        {/* Back to landing */}
        <button onClick={() => router.push("/")} className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </button>
>>>>>>> Stashed changes

        {/* Card */}
        <div className="glass-card p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600/10 mb-4">
              <Shield className="w-6 h-6 text-brand-600 dark:text-brand-500" />
            </div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Welcome back</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Sign in to your AegisOne dashboard</p>
          </div>

          {/* Login form */}
<<<<<<< Updated upstream
          {resetMode ? (
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
                  className="w-full px-4 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all text-center tracking-widest text-lg"
                />
              </div>
              {error && <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>}
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-2.5 mt-2 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Reset Password"}
              </button>
              <button
                type="button"
                onClick={() => setResetMode(false)}
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
              
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Role</label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                  <select
                    value={requestedRole}
                    onChange={e => setRequestedRole(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all appearance-none"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400 text-xs">▼</div>
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
                className="w-full py-2.5 mt-2 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}

          {!resetMode && (
            <p className="text-center text-sm text-surface-500 dark:text-surface-400 mt-6">
              <button onClick={handleForgotPassword} type="button" disabled={loading || !email} className="text-brand-600 hover:text-brand-500 dark:text-brand-400 font-medium disabled:opacity-50">Forgot your password?</button>
            </p>
          )}

=======
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-surface-200 dark:bg-white/[0.06]" />
            <span className="text-xs text-surface-500">Corporate Directory Profiles</span>
            <div className="flex-1 h-px bg-surface-200 dark:bg-white/[0.06]" />
          </div>

          {/* Quick login buttons */}
          <div className="space-y-2.5">
            {quickLogins.map(q => (
              <button
                key={q.role}
                onClick={() => handleQuickLogin(q.role)}
                className={`w-full flex items-center gap-3 px-4 py-3 border rounded-lg transition-all text-left bg-white/[0.02] border-surface-200 dark:border-white/[0.06] hover:border-brand-500/30 hover:bg-brand-500/[0.01]`}
              >
                <q.icon className="w-5 h-5 text-surface-500 dark:text-surface-400" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-surface-900 dark:text-white">{q.label}</div>
                  <div className="text-xs text-surface-500">{q.email}</div>
                </div>
                <span className="text-xs text-surface-400 dark:text-surface-600">→</span>
              </button>
            ))}
          </div>
>>>>>>> Stashed changes
        </div>

        <p className="text-center text-xs text-surface-500 dark:text-surface-600 mt-6">
          AegisOne Platform Enterprise Access Management
        </p>
      </motion.div>
    </div>
  );
}
