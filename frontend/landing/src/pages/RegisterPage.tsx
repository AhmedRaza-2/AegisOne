import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2, User, Mail, Lock, Phone, Globe, Users, Briefcase,
  ChevronRight, ChevronLeft, Shield, CheckCircle2, Loader2, Eye, EyeOff
} from 'lucide-react';
import { registerOrganization } from '../lib/org-service';

// ─── Constants ───────────────────────────────────────────────────────────────
const INDUSTRIES = [
  'Technology', 'Finance & Banking', 'Healthcare', 'Education',
  'Manufacturing', 'Retail & E-Commerce', 'Legal & Compliance',
  'Government', 'Telecommunications', 'Other',
];

const COUNTRIES = [
  'Pakistan', 'United Arab Emirates', 'Saudi Arabia', 'United Kingdom',
  'United States', 'Canada', 'India', 'Germany', 'France', 'Other',
];

const EMP_RANGES = [
  { label: '1 – 25', value: 25 },
  { label: '26 – 100', value: 100 },
  { label: '101 – 500', value: 500 },
  { label: '501 – 1000', value: 1000 },
  { label: '1000+', value: 5000 },
];

// ─── Step Indicator ──────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <React.Fragment key={step}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-300 ${
            step < current ? 'bg-emerald-500 text-white' :
            step === current ? 'bg-blue-500 text-white ring-4 ring-blue-500/30' :
            'bg-slate-800 text-slate-500'
          }`}>
            {step < current ? <CheckCircle2 className="w-4 h-4" /> : step}
          </div>
          {step < total && (
            <div className={`h-px w-10 transition-all duration-300 ${step < current ? 'bg-emerald-500' : 'bg-slate-800'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Input Component ─────────────────────────────────────────────────────────
interface InputProps {
  label: string;
  icon: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}
function Field({ label, icon, error, children }: InputProps) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
        {icon} {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-400 font-medium">{error}</p>}
    </div>
  );
}

const inputCls = "w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all";
const selectCls = inputCls + " appearance-none cursor-pointer";

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    industry: '',
    employee_count: 100,
    country: '',
    admin_name: '',
    admin_email: '',
    phone: '',
    password: '',
    confirm_password: '',
    agreed: false,
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setError('');
    const val = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm(prev => ({ ...prev, [key]: val }));
  };

  // ── Validation per step ────────────────────────────────────────────────────
  const validateStep = (s: number): string => {
    if (s === 1) {
      if (!form.name.trim()) return 'Organization name is required.';
      if (!form.industry) return 'Please select an industry.';
      if (!form.country) return 'Please select a country.';
    }
    if (s === 2) {
      if (!form.admin_name.trim()) return 'Admin full name is required.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.admin_email)) return 'Enter a valid business email.';
      if (!/^\+?[0-9\s\-]{7,15}$/.test(form.phone)) return 'Enter a valid phone number.';
    }
    if (s === 3) {
      if (form.password.length < 8) return 'Password must be at least 8 characters.';
      if (!/[A-Z]/.test(form.password)) return 'Password must contain an uppercase letter.';
      if (!/[0-9]/.test(form.password)) return 'Password must contain a number.';
      if (form.password !== form.confirm_password) return 'Passwords do not match.';
      if (!form.agreed) return 'You must agree to the Terms of Service.';
    }
    return '';
  };

  const handleNext = () => {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setStep(s => s + 1);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateStep(3);
    if (err) { setError(err); return; }

    setLoading(true);
    setError('');
    try {
      await registerOrganization({
        name: form.name,
        industry: form.industry,
        employee_count: form.employee_count,
        country: form.country,
        admin_name: form.admin_name,
        admin_email: form.admin_email,
        phone: form.phone,
        password: form.password,
      });
      navigate('/portal');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top bar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-900">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-blue-400" />
          </div>
          <span className="font-bold text-white text-sm tracking-tight">AegisOne</span>
        </Link>
        <span className="text-xs text-slate-500">
          Already registered?{' '}
          <Link to="/login" className="text-blue-400 font-semibold hover:text-blue-300 transition-colors">
            Sign In
          </Link>
        </span>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">

          {/* Header */}
          <div className="text-center mb-8 space-y-2">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Organization Registration
            </div>
            <h1 className="text-2xl font-bold text-white">Deploy AegisOne in Your Organization</h1>
            <p className="text-sm text-slate-400">
              {step === 1 && 'Tell us about your organization.'}
              {step === 2 && 'Who is the primary security administrator?'}
              {step === 3 && 'Secure your admin portal account.'}
            </p>
          </div>

          <StepIndicator current={step} total={3} />

          {/* Form Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl">
            <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }} className="space-y-5" noValidate>

              {/* ── STEP 1: Organization ── */}
              {step === 1 && (
                <>
                  <Field label="Organization Name" icon={<Building2 className="w-3 h-3" />}>
                    <input
                      id="org-name"
                      type="text"
                      className={inputCls}
                      placeholder="e.g. ABC Software House"
                      value={form.name}
                      onChange={set('name')}
                      autoFocus
                    />
                  </Field>

                  <Field label="Industry" icon={<Briefcase className="w-3 h-3" />}>
                    <select id="industry" className={selectCls} value={form.industry} onChange={set('industry')}>
                      <option value="">Select industry...</option>
                      {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                    </select>
                  </Field>

                  <Field label="Country / Region" icon={<Globe className="w-3 h-3" />}>
                    <select id="country" className={selectCls} value={form.country} onChange={set('country')}>
                      <option value="">Select country...</option>
                      {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>

                  <Field label="Approximate Employees" icon={<Users className="w-3 h-3" />}>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {EMP_RANGES.map(r => (
                        <button
                          type="button"
                          key={r.value}
                          onClick={() => setForm(p => ({ ...p, employee_count: r.value }))}
                          className={`py-2 px-1 rounded-lg border text-xs font-semibold transition-all ${
                            form.employee_count === r.value
                              ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </>
              )}

              {/* ── STEP 2: Admin ── */}
              {step === 2 && (
                <>
                  <Field label="Full Name" icon={<User className="w-3 h-3" />}>
                    <input
                      id="admin-name"
                      type="text"
                      className={inputCls}
                      placeholder="Ahmed Raza"
                      value={form.admin_name}
                      onChange={set('admin_name')}
                      autoFocus
                    />
                  </Field>

                  <Field label="Business Email" icon={<Mail className="w-3 h-3" />}>
                    <input
                      id="admin-email"
                      type="email"
                      className={inputCls}
                      placeholder="admin@company.com"
                      value={form.admin_email}
                      onChange={set('admin_email')}
                    />
                  </Field>

                  <Field label="Phone Number" icon={<Phone className="w-3 h-3" />}>
                    <input
                      id="phone"
                      type="tel"
                      className={inputCls}
                      placeholder="+92 300 1234567"
                      value={form.phone}
                      onChange={set('phone')}
                    />
                  </Field>
                </>
              )}

              {/* ── STEP 3: Security ── */}
              {step === 3 && (
                <>
                  <Field label="Portal Password" icon={<Lock className="w-3 h-3" />}>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        className={inputCls + ' pr-11'}
                        placeholder="Min. 8 chars, 1 uppercase, 1 number"
                        value={form.password}
                        onChange={set('password')}
                        autoFocus
                      />
                      <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Strength bar */}
                    {form.password && (
                      <div className="mt-1.5 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${
                          form.password.length < 8 ? 'w-1/4 bg-red-500' :
                          !/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password) ? 'w-2/4 bg-amber-500' :
                          'w-full bg-emerald-500'
                        }`} />
                      </div>
                    )}
                  </Field>

                  <Field label="Confirm Password" icon={<Lock className="w-3 h-3" />}>
                    <div className="relative">
                      <input
                        id="confirm-password"
                        type={showConfirm ? 'text' : 'password'}
                        className={inputCls + ' pr-11'}
                        placeholder="Re-enter password"
                        value={form.confirm_password}
                        onChange={set('confirm_password')}
                      />
                      <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      id="terms"
                      type="checkbox"
                      checked={form.agreed}
                      onChange={set('agreed')}
                      className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-900 accent-blue-500 cursor-pointer"
                    />
                    <span className="text-xs text-slate-400 leading-relaxed">
                      I agree to AegisOne's{' '}
                      <span className="text-blue-400 hover:text-blue-300 cursor-pointer">Terms of Service</span>{' '}
                      and{' '}
                      <span className="text-blue-400 hover:text-blue-300 cursor-pointer">Privacy Policy</span>.
                      I understand that organization data is stored only on my own server.
                    </span>
                  </label>
                </>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400 font-medium flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  {error}
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-2">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => { setStep(s => s - 1); setError(''); }}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:border-slate-600 hover:bg-slate-800 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-bold py-3 rounded-xl text-sm transition-all"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating Organization...</>
                  ) : step < 3 ? (
                    <>Continue <ChevronRight className="w-4 h-4" /></>
                  ) : (
                    <>Complete Registration <CheckCircle2 className="w-4 h-4" /></>
                  )}
                </button>
              </div>

            </form>
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-slate-600 mt-6">
            🔒 We only store your organization profile. No employee, threat, or internal data ever reaches our servers.
          </p>
        </div>
      </div>
    </div>
  );
}
