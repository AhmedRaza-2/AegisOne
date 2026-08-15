"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, Mail, Lock, Eye, EyeOff } from "lucide-react";
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
    <div
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-300"
      style={{ background: "var(--bg-canvas)" }}
    >
      {/* Layered background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full opacity-40"
          style={{ background: "radial-gradient(ellipse, rgba(74,127,167,0.18) 0%, transparent 65%)" }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full opacity-20"
          style={{ background: "radial-gradient(ellipse, rgba(26,61,99,0.5) 0%, transparent 70%)" }} />
        {/* Subtle dot grid */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle, var(--navy-800) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-[400px] relative z-10"
      >
        {/* Brand mark above card */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
            style={{
              background: "linear-gradient(135deg, var(--blue-600) 0%, var(--navy-800) 100%)",
              boxShadow: "0 8px 24px rgba(74,127,167,0.35), 0 0 0 1px rgba(74,127,167,0.2)"
            }}
          >
            <ShieldCheck className="w-7 h-7 text-white" strokeWidth={1.75} />
          </motion.div>
          <h1 className="font-semibold tracking-tight" style={{ fontFamily: "'Inter', sans-serif", fontSize: "1.375rem", color: "var(--text-primary)" }}>
            Welcome back
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Sign in to your AegisOne workspace
          </p>
        </div>

        {/* Auth Card */}
        <div className="auth-card">

          {/* Reset Step 1: Verify OTP */}
          {resetStep === "otp" ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {successMsg && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl text-sm"
                  style={{ background: "rgba(47,169,126,0.08)", border: "1px solid rgba(47,169,126,0.2)", color: "var(--success)" }}>
                  {successMsg}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  required
                  className="input-premium text-center tracking-[0.3em] text-lg font-mono font-bold"
                />
              </div>
              {error && <p className="text-sm text-center" style={{ color: "var(--danger)" }}>{error}</p>}
              <button type="submit" disabled={loading || otp.length < 6} className="btn-primary mt-2">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Verifying...</>
                ) : "Verify Code"}
              </button>
              <button type="button" onClick={() => setResetStep("none")}
                className="w-full py-2 mt-1 text-sm font-medium transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-secondary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                Cancel
              </button>
            </form>

          ) : resetStep === "new_password" ? (
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              {successMsg && (
                <div className="px-3.5 py-3 rounded-xl text-sm" style={{ background: "rgba(47,169,126,0.08)", border: "1px solid rgba(47,169,126,0.2)", color: "var(--success)" }}>
                  {successMsg}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter your new password"
                    required
                    className="input-premium pr-11"
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "var(--text-muted)" }}>
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    className="input-premium pr-11"
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "var(--text-muted)" }}>
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-center" style={{ color: "var(--danger)" }}>{error}</p>}
              <button type="submit" disabled={loading || !newPassword || !confirmNewPassword} className="btn-primary mt-2">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Updating Password...</>
                ) : "Set New Password & Log In"}
              </button>
              <button type="button" onClick={() => setResetStep("none")}
                className="w-full py-2 mt-1 text-sm font-medium transition-colors"
                style={{ color: "var(--text-muted)" }}>
                Cancel
              </button>
            </form>

          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {successMsg && (
                <div className="px-3.5 py-3 rounded-xl text-sm" style={{ background: "rgba(47,169,126,0.08)", border: "1px solid rgba(47,169,126,0.2)", color: "var(--success)" }}>
                  {successMsg}
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={handleEmailBlur}
                    placeholder="you@company.com"
                    required
                    className="input-premium pl-10"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="input-premium pl-10 pr-11"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "var(--text-muted)" }}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error states */}
              {error && (
                error.includes("awaiting admin approval")
                  ? <div className="px-3.5 py-3 rounded-xl text-sm" style={{ background: "rgba(217,164,65,0.08)", border: "1px solid rgba(217,164,65,0.2)", color: "var(--warning)" }}>{error}</div>
                  : <p className="text-sm text-center" style={{ color: "var(--danger)" }}>{error}</p>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading} className="btn-primary mt-2">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Signing in...</>
                ) : "Sign In"}
              </button>
            </form>
          )}

          {/* Forgot password */}
          {resetStep === "none" && (
            <p className="text-center text-sm mt-5">
              <button
                onClick={handleForgotPassword}
                type="button"
                disabled={loading || !email}
                className="font-medium transition-colors disabled:opacity-40"
                style={{ color: "var(--blue-600)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--blue-700)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--blue-600)")}
              >
                Forgot your password?
              </button>
            </p>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs mt-6" style={{ color: "var(--text-muted)" }}>
          AegisOne Platform · Enterprise Access Management
        </p>
      </motion.div>
    </div>
  );
}
