import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { ShieldCheck, Lock, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { updatePassword } from '../lib/org-service';

export default function UpdatePasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError('Please enter a new password.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    
    setLoading(true);
    setError('');
    try {
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: '#F6FAFD', color: '#0A1931' }}>
      <Header />

      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        {/* Layered background glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full opacity-50"
            style={{ background: 'radial-gradient(ellipse, rgba(74,127,167,0.14) 0%, transparent 65%)' }} />
          <div className="absolute bottom-0 right-0 w-[350px] h-[350px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(ellipse, rgba(26,61,99,0.5) 0%, transparent 70%)' }} />
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
            <h1 className="font-semibold tracking-tight" style={{ fontSize: '1.375rem', color: '#0A1931' }}>Update Password</h1>
            <p className="mt-1 text-sm" style={{ color: '#8CA3B8' }}>Please enter your new portal password.</p>
          </div>

          {/* Card */}
          <div
            className="rounded-[20px] p-10"
            style={{
              background: '#FFFFFF',
              border: '1px solid #E1EBF2',
              boxShadow: '0 2px 4px rgba(10,25,49,0.04), 0 8px 24px rgba(10,25,49,0.08), 0 24px 56px rgba(10,25,49,0.06)',
            }}
          >
            {success ? (
              <div className="text-center space-y-4 py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-2"
                  style={{
                    background: 'linear-gradient(135deg, rgba(47,169,126,0.15) 0%, rgba(47,169,126,0.05) 100%)',
                    border: '1px solid rgba(47,169,126,0.25)',
                  }}>
                  <ShieldCheck className="w-8 h-8" style={{ color: '#2FA97E' }} />
                </div>
                <h2 className="text-xl font-semibold" style={{ color: '#0A1931' }}>Password Updated!</h2>
                <p className="text-sm" style={{ color: '#8CA3B8' }}>Redirecting you to login...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium mb-2" style={{ color: '#4A6D8C' }}>
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#8CA3B8' }} />
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      className="w-full bg-[#F6FAFD] border border-[#E1EBF2] rounded-xl pl-10 pr-11 py-[11px] text-sm text-[#0A1931] placeholder-[#8CA3B8] focus:outline-none focus:border-[#4A7FA7] focus:ring-[3px] focus:ring-[#4A7FA7]/15 focus:bg-white transition-all"
                      placeholder="Enter new password"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(''); }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: '#8CA3B8' }}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-xs font-medium"
                    style={{ background: 'rgba(214,92,92,0.08)', border: '1px solid rgba(214,92,92,0.2)', color: '#D65C5C' }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#D65C5C' }} />
                    {error}
                  </div>
                )}

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
                    <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
                  ) : (
                    <>Update Password <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
