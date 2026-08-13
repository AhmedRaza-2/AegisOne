import React, { useState } from 'react';
import { ShieldCheck, Mail, User, Building2, Key, ArrowRight, Sparkles, CheckCircle, Info } from 'lucide-react';
import { signUpUser, signInUser, getOrganizations } from '../lib/firebase';
import { UserSession } from '../types';

interface AuthScreenProps {
  onAuthSuccess: (session: UserSession) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [password, setPassword] = useState('••••••••'); // Demo lock placeholder
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email) {
      setErrorMsg('Please enter your work email.');
      return;
    }

    try {
      if (isSignUp) {
        if (!name || !orgName) {
          setErrorMsg('Please fill in your name and organization.');
          return;
        }
        const session = signUpUser(email, name, orgName);
        onAuthSuccess(session);
      } else {
        const session = signInUser(email);
        onAuthSuccess(session);
      }
    } catch (err) {
      setErrorMsg('Authentication failed. Please verify fields.');
    }
  };

  const handleQuickDemoLogin = (demoEmail: string) => {
    const session = signInUser(demoEmail);
    onAuthSuccess(session);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden" id="auth-screen-container">
      {/* Background radial accent */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-[#0A5ED6] font-mono text-[10px] uppercase tracking-widest mb-4">
          <ShieldCheck className="w-3.5 h-3.5" />
          Sovereign Edge Authentication
        </div>
        <h2 className="font-sans text-3xl font-extrabold tracking-tight text-[#0F172A]">
          AegisOne Local Portal
        </h2>
        <p className="mt-2 font-sans text-sm text-[#45464D]">
          {isSignUp 
            ? 'Register your organization and deploy a secure admin node.' 
            : 'Access your office safe link administration dashboard.'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="bg-white border border-slate-200/80 shadow-xl rounded-2xl p-6 sm:p-10 text-left">
          {errorMsg && (
            <div className="mb-4 bg-red-50 border border-red-100 text-red-600 rounded-lg p-3 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ahmad Raza"
                    className="font-sans text-sm w-full bg-slate-50 border border-slate-200 focus:border-[#0A5ED6] focus:bg-white rounded-lg px-3.5 py-2.5 text-[#0F172A] placeholder-slate-400 outline-none transition-all"
                  />
                </div>

                {/* Organization Name */}
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" /> Company / Organization Name
                  </label>
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Al-Baraka Logistics"
                    className="font-sans text-sm w-full bg-slate-50 border border-slate-200 focus:border-[#0A5ED6] focus:bg-white rounded-lg px-3.5 py-2.5 text-[#0F172A] placeholder-slate-400 outline-none transition-all"
                  />
                </div>
              </>
            )}

            {/* Email Address */}
            <div className="space-y-1.5">
              <label className="font-sans text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> Work Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="font-sans text-sm w-full bg-slate-50 border border-slate-200 focus:border-[#0A5ED6] focus:bg-white rounded-lg px-3.5 py-2.5 text-[#0F172A] placeholder-slate-400 outline-none transition-all"
              />
            </div>

            {/* Demo Password Lock */}
            <div className="space-y-1.5">
              <label className="font-sans text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-slate-400" /> Passcode (Pre-filled for Sandbox)
              </label>
              <input
                type="password"
                disabled
                value={password}
                className="font-sans text-sm w-full bg-slate-100 border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-500 cursor-not-allowed select-none"
              />
            </div>

            <button
              type="submit"
              className="font-sans w-full text-center text-sm font-bold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white py-3 rounded-lg flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-colors mt-6"
            >
              {isSignUp ? 'Create Admin Node Account' : 'Authenticate & Open Portal'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Toggle Login/Signup links */}
          <div className="mt-5 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
              }}
              className="font-sans text-xs font-semibold text-[#0A5ED6] hover:underline cursor-pointer"
            >
              {isSignUp 
                ? 'Already have an office admin node? Log In' 
                : "Don't have an account? Sign Up your organization"}
            </button>
          </div>

          {/* Quick Demo Preloads */}
          {!isSignUp && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                <Sparkles className="w-3 h-3 text-yellow-500" /> Quick Sandbox Access
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => handleQuickDemoLogin('araza2125012.pgc@gmail.com')}
                  className="font-sans text-xs w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 py-2.5 px-3 rounded-lg text-left flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div>
                    <span className="font-bold text-[#0F172A] block text-xs">Ahmad Raza (Super Admin)</span>
                    <span className="text-[10px] text-slate-400 block">Al-Baraka Logistics • Active</span>
                  </div>
                  <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase shrink-0">
                    SME Demo
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Small warning note */}
        <div className="mt-4 text-center">
          <p className="font-sans text-[11px] text-slate-400 leading-relaxed flex items-center justify-center gap-1">
            <Info className="w-3.5 h-3.5" />
            Locked down under local sovereignty policies. No telemetry data leaves the computer.
          </p>
        </div>
      </div>
    </div>
  );
}
