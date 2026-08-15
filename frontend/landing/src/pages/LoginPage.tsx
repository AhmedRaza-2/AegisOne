import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import AuthLoadingOverlay from '../components/AuthLoadingOverlay';
import { ShieldCheck, Mail, Lock, Loader2, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react';
import { loginOrganization, sendPasswordResetEmail } from '../lib/org-service';

/* ── Shared style tokens (mirroring design.md §1) ── */
const TOKEN = {
  bgCanvas:     '#F6FAFD',
  bgCard:       '#FFFFFF',
  borderSubtle: '#E1EBF2',
  borderStrong: '#C7DAE8',
  blue600:      '#4A7FA7',
  blue700:      '#3D6C90',
  navy800:      '#1A3D63',
  textPrimary:  '#0A1931',
  textSecondary:'#4A6D8C',
  textMuted:    '#8CA3B8',
  success:      '#2FA97E',
  danger:       '#D65C5C',
  warning:      '#D9A441',
};

const inputCls = [
  'w-full bg-[#F6FAFD] border border-[#E1EBF2] rounded-xl px-4 py-[11px]',
  'text-sm text-[#0A1931] placeholder-[#8CA3B8]',
  'focus:outline-none focus:border-[#4A7FA7] focus:ring-[3px] focus:ring-[#4A7FA7]/15 focus:bg-white',
  'transition-all duration-150',
].join(' ');

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
      sessionStorage.setItem('tempAdminPassword', password);
      navigate('/portal');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: TOKEN.bgCanvas, color: TOKEN.textPrimary }}>
      <Header />

      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        {/* Layered background glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full opacity-50"
            style={{ background: 'radial-gradient(ellipse, rgba(74,127,167,0.14) 0%, transparent 65%)' }} />
          <div className="absolute bottom-0 right-0 w-[350px] h-[350px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(ellipse, rgba(26,61,99,0.5) 0%, transparent 70%)' }} />
          {/* Dot grid */}
          <div className="absolute inset-0 opacity-[0.035]"
            style={{ backgroundImage: 'radial-gradient(circle, #1A3D63 1px, transparent 1px)', backgroundSize: '26px 26px' }} />
        </div>

        <div className="w-full max-w-[400px] relative z-10">

          {/* Brand mark */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
              style={{
                background: 'linear-gradient(135deg, #4A7FA7 0%, #1A3D63 100%)',
                boxShadow: '0 8px 24px rgba(74,127,167,0.35), 0 0 0 1px rgba(74,127,167,0.2)',
              }}
            >
              <ShieldCheck className="w-7 h-7 text-white" strokeWidth={1.75} />
            </div>
            <h1 className="font-semibold tracking-tight" style={{ fontSize: '1.375rem', color: TOKEN.textPrimary }}>
              {isForgotPassword ? 'Reset Password' : 'Organization Portal'}
            </h1>
            <p className="mt-1 text-sm" style={{ color: TOKEN.textMuted }}>
              {isForgotPassword
                ? 'Enter your email to receive a reset link.'
                : 'Sign in to access your deployment dashboard.'}
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded-[20px] p-10"
            style={{
              background: TOKEN.bgCard,
              border: `1px solid ${TOKEN.borderSubtle}`,
              boxShadow: '0 2px 4px rgba(10,25,49,0.04), 0 8px 24px rgba(10,25,49,0.08), 0 24px 56px rgba(10,25,49,0.06)',
            }}
          >
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>

              {/* Email */}
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium mb-2" style={{ color: TOKEN.textSecondary }}>
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: TOKEN.textMuted }} />
                  <input
                    id="login-email"
                    type="email"
                    className={inputCls + ' pl-10'}
                    placeholder="admin@company.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    autoFocus
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              {!isForgotPassword && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="login-password" className="block text-sm font-medium" style={{ color: TOKEN.textSecondary }}>
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs font-semibold transition-colors"
                      style={{ color: TOKEN.blue600 }}
                      tabIndex={-1}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: TOKEN.textMuted }} />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      className={inputCls + ' pl-10 pr-11'}
                      placeholder="Your portal password"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(''); }}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: TOKEN.textMuted }}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Error & Success */}
              {error && (
                <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-xs font-medium"
                  style={{ background: 'rgba(214,92,92,0.08)', border: '1px solid rgba(214,92,92,0.2)', color: TOKEN.danger }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: TOKEN.danger }} />
                  {error}
                </div>
              )}
              {resetSent && (
                <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-xs font-medium"
                  style={{ background: 'rgba(47,169,126,0.08)', border: '1px solid rgba(47,169,126,0.2)', color: TOKEN.success }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: TOKEN.success }} />
                  If an account exists, a reset link has been sent. Check your inbox.
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 text-white font-semibold py-[11px] rounded-xl text-sm transition-all mt-1 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #4A7FA7 0%, #3D6C90 100%)',
                  boxShadow: '0 1px 2px rgba(10,25,49,0.10), 0 4px 12px rgba(74,127,167,0.30)',
                }}
                onMouseEnter={e => {
                  if (!loading) {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(74,127,167,0.45)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 2px rgba(10,25,49,0.10), 0 4px 12px rgba(74,127,167,0.30)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                }}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{isForgotPassword ? 'Sending...' : 'Signing In...'}</>
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
                  className="w-full flex items-center justify-center gap-2 font-medium py-2 text-sm transition-all"
                  style={{ color: TOKEN.textMuted }}
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Login
                </button>
              )}
            </form>
          </div>

          <div className="mt-7 text-center space-y-3">
            <p className="text-sm" style={{ color: TOKEN.textSecondary }}>
              New organization?{' '}
              <Link to="/register" className="font-semibold transition-colors" style={{ color: TOKEN.blue600 }}>
                Register Now
              </Link>
            </p>
            <p className="text-xs" style={{ color: TOKEN.textMuted }}>
              Your organization data is stored on your own server. We only verify your account.
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <AuthLoadingOverlay
          title="Signing you in"
          steps={['Verifying credentials', 'Contacting secure server', 'Loading your workspace']}
        />
      )}
    </div>
  );
}
