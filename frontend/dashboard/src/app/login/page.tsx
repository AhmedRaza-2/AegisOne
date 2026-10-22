"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { API_BASE } from "@/lib/api";
import { dashboardLoginDestination, firstAdministratorContext, isFirstAdministratorMode, safeDashboardNext } from "@/lib/login-navigation";

export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [otp, setOtp] = useState("");
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [mode, setMode] = useState<'sign_in' | 'create_first_admin'>('sign_in');
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const setupContext = firstAdministratorContext(nextPath);
  const creatingAdministrator = isFirstAdministratorMode(mode, nextPath);

  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    const urlParams = new URLSearchParams(window.location.search);
    const next = safeDashboardNext(urlParams.get("next"));
    setNextPath(next);
    // Replace legacy credential-bearing return URLs with the nonsecret setup context.
    if (urlParams.has('next') && urlParams.get('next') !== next) {
      if (next) urlParams.set('next', next);
      else urlParams.delete('next');
      const query = urlParams.toString();
      window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''));
    }
    const context = firstAdministratorContext(next);
    if (context) {
      setEmail(current => current || context.email);
      setFullName(current => current || context.fullName);
    }
    if (user) {
      router.replace(dashboardLoginDestination(user.role, next));
      return;
    }
    if (urlParams.get("registered") === "true") {
      setSuccessMsg("Registration successful. Please wait for an admin to approve your account.");
    }
    setCheckingSession(false);
  }, [router, user, isLoading]);

  // Auto-detect assigned user role when email changes
  const handleEmailBlur = async () => {
    // Intentionally empty: the page used to ask the server whether an address is registered
    // and what role it has before sign-in, which let anyone enumerate accounts. The role now
    // comes back only from a successful /auth/login.
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      if (mode === 'create_first_admin') {
        if (!creatingAdministrator || !setupContext) throw new Error('Open organization setup from your portal to create the first administrator.');
        if (!fullName.trim()) throw new Error('Enter the administrator name.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        const response = await fetch(`${API_BASE}/auth/send-admin-credentials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), full_name: fullName.trim(), password, org_name: setupContext.organization || 'Enterprise' }),
        });
        if (!response.ok) {
          if (response.status === 403) throw new Error('This server already has an administrator. Sign in with that account or contact the server owner.');
          throw new Error('Could not create the administrator. Use at least eight characters with uppercase, lowercase and a number, then try again.');
        }
      }
      const result = await login(email.trim(), password);
      if (!result.success) throw new Error(result.error || 'Invalid credentials.');
      setPassword('');
      setConfirmPassword('');
      router.replace(dashboardLoginDestination(result.role, nextPath));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not sign in. Please try again.');
    } finally {
      setLoading(false);
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
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
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

  if (checkingSession) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300"
        style={{ background: "var(--bg-canvas)" }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 text-center z-10"
        >
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl animate-pulse"
            style={{
              background: "linear-gradient(135deg, var(--blue-600) 0%, var(--navy-800) 100%)",
              boxShadow: "0 8px 24px rgba(74,127,167,0.35), 0 0 0 1px rgba(74,127,167,0.2)"
            }}
          >
            <ShieldCheck className="w-8 h-8 text-white" strokeWidth={1.75} />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            <span className="text-sm font-medium tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Validating AegisOne Session...
            </span>
          </div>
        </motion.div>
      </div>
    );
  }

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
            {creatingAdministrator ? 'Create first administrator' : 'Welcome back'}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {setupContext ? `Continue setup${setupContext.organization ? ` for ${setupContext.organization}` : ''} on this server` : 'Sign in to your AegisOne workspace'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="auth-card">

          {/* Reset Step 1: Verify OTP */}
          {resetStep === "otp" ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {successMsg && (
                <div className="flex flex-col gap-1 px-3.5 py-3 rounded-xl text-sm"
                  style={{ background: "rgba(47,169,126,0.08)", border: "1px solid rgba(47,169,126,0.2)", color: "var(--success)" }}>
                  <span>{successMsg}</span>
                  <span className="text-xs opacity-80 mt-0.5" style={{ color: "var(--text-muted)" }}>
                    💡 <b>Dev Mode:</b> Check backend terminal logs for <code>[SECURITY OTP CODE]</code> if SMTP email service is unconfigured.
                  </span>
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
                    minLength={8}
                    maxLength={512}
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
                    minLength={8}
                    maxLength={512}
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
              {setupContext && (
                <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <p>{creatingAdministrator ? 'Choose credentials for the first administrator of this server.' : 'Sign in with your account on this server. For a new server, create its first administrator.'}</p>
                  <button type="button" disabled={loading}
                    className="font-medium disabled:opacity-40" style={{ color: 'var(--blue-600)' }}
                    onClick={() => { setMode(creatingAdministrator ? 'sign_in' : 'create_first_admin'); setError(''); setPassword(''); setConfirmPassword(''); }}>
                    {creatingAdministrator ? 'Sign in with an existing account' : 'Create first administrator'}
                  </button>
                </div>
              )}
              {successMsg && (
                <div className="px-3.5 py-3 rounded-xl text-sm" style={{ background: "rgba(47,169,126,0.08)", border: "1px solid rgba(47,169,126,0.2)", color: "var(--success)" }}>
                  {successMsg}
                </div>
              )}

              {creatingAdministrator && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Administrator name</label>
                  <input type="text" autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)}
                    maxLength={255} required className="input-premium" />
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <input
                    type="email"
                    autoComplete="username"
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
                    autoComplete={creatingAdministrator ? 'new-password' : 'current-password'}
                    minLength={creatingAdministrator ? 8 : undefined}
                    maxLength={512}
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

              {creatingAdministrator && (
                <div>
                  <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>Use at least eight characters with uppercase, lowercase and a number.</p>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Confirm password</label>
                  <input type="password" autoComplete="new-password" value={confirmPassword}
                    onChange={event => setConfirmPassword(event.target.value)} minLength={8} maxLength={512} required className="input-premium" />
                </div>
              )}

              {/* Error states */}
              {error && (
                error.includes("awaiting admin approval")
                  ? <div className="px-3.5 py-3 rounded-xl text-sm" style={{ background: "rgba(217,164,65,0.08)", border: "1px solid rgba(217,164,65,0.2)", color: "var(--warning)" }}>{error}</div>
                  : <p className="text-sm text-center" style={{ color: "var(--danger)" }}>{error}</p>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading} className="btn-primary mt-2">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{creatingAdministrator ? 'Creating administrator...' : 'Signing in...'}</>
                ) : creatingAdministrator ? 'Create Administrator & Continue' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Forgot password */}
          {resetStep === "none" && !creatingAdministrator && (
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
