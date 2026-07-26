import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import { Shield, Mail, Lock, Loader2, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react';
import { loginOrganization, sendPasswordResetEmail } from '../lib/org-service';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isForgotPassword) {
      if (!email) { setError('Please enter your admin email.'); return; }
      setLoading(true);
      setError('');
      try {
        await sendPasswordResetEmail(email);
        setResetSent(true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to send reset email.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email || !password) { setError('Please enter both email and password.'); return; }
    setLoading(true);
    setError('');
    try {
      await loginOrganization(email, password);
      navigate('/portal');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0F172A] placeholder-slate-400 focus:outline-none focus:border-[#0A5ED6] focus:bg-white transition-all";

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        {/* Decorative background positioned behind the form area */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center items-center">
          <div className="w-[600px] h-[600px] bg-[#0A5ED6]/5 rounded-full blur-[120px]" />
        </div>
        
        <div className="w-full max-w-md relative z-10">

          <div className="text-center mb-8 space-y-2">
            <h1 className="text-2xl font-bold text-[#0F172A]">{isForgotPassword ? 'Reset Password' : 'Organization Portal'}</h1>
            <p className="text-sm text-[#45464D]">{isForgotPassword ? 'Enter your email to receive a reset link.' : 'Sign in to access your deployment dashboard.'}</p>
          </div>

          {/* Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <Mail className="w-3 h-3" /> Admin Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  className={inputCls}
                  placeholder="admin@company.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  autoFocus
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              {!isForgotPassword && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-password" className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      <Lock className="w-3 h-3" /> Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs text-[#0A5ED6] hover:text-[#0B63E0] font-semibold transition-colors"
                      tabIndex={-1}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      className={inputCls + ' pr-11'}
                      placeholder="Your portal password"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(''); }}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0A5ED6] transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Error & Success */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600 font-medium flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                  {error}
                </div>
              )}
              {resetSent && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-700 font-medium flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                  If an account exists, a reset link has been sent. Check your inbox.
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] disabled:bg-[#0A5ED6]/50 text-white font-bold py-3 rounded-xl text-sm transition-all mt-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {isForgotPassword ? 'Sending...' : 'Signing In...'}</>
                ) : isForgotPassword ? (
                  <>Send Reset Link <ArrowRight className="w-4 h-4" /></>
                ) : (
                  <>Sign In <ArrowRight className="w-4 h-4" /></>
                )}
              </button>

              {isForgotPassword && (
                <button
                  type="button"
                  onClick={() => { setIsForgotPassword(false); setResetSent(false); setError(''); }}
                  className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 font-semibold py-2 text-sm transition-all"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Login
                </button>
              )}

            </form>
          </div>

          <div className="mt-8 text-center space-y-3">
            <p className="text-sm text-[#45464D]">
              New organization?{' '}
              <Link to="/register" className="text-[#0A5ED6] font-semibold hover:text-blue-800 transition-colors">
                Register Now
              </Link>
            </p>
            <p className="text-xs text-[#45464D]">
              Your organization data is stored on your own server. We only verify your account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
