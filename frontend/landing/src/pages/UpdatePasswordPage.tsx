import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { Shield, Lock, Loader2, ArrowRight } from 'lucide-react';
import { updatePassword } from '../lib/org-service';

export default function UpdatePasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
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

  const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0F172A] placeholder-slate-400 focus:outline-none focus:border-[#0A5ED6] focus:bg-white transition-all";

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />

      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center items-center">
          <div className="w-[600px] h-[600px] bg-[#0A5ED6]/5 rounded-full blur-[120px]" />
        </div>
        
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8 space-y-2">
            <h1 className="text-2xl font-bold text-[#0F172A]">Update Password</h1>
            <p className="text-sm text-[#45464D]">Please enter your new portal password.</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xl">
            {success ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-[#0F172A]">Password Updated!</h2>
                <p className="text-sm text-[#45464D]">Redirecting you to login...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="space-y-1.5">
                  <label htmlFor="new-password" className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <Lock className="w-3 h-3" /> New Password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    className={inputCls}
                    placeholder="Enter new password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600 font-medium flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] disabled:bg-[#0A5ED6]/50 text-white font-bold py-3 rounded-xl text-sm transition-all mt-2"
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
