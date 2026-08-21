import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import AuthLoadingOverlay from '../components/AuthLoadingOverlay';
import {
  Building2, User, Mail, Lock, Phone, Globe, Users, Briefcase,
  ChevronRight, ChevronLeft, Shield, CheckCircle2, Loader2, Eye, EyeOff, X
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
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-300 ${step < current ? 'bg-emerald-500 text-white' :
              step === current ? 'bg-[#0A5ED6] text-white ring-4 ring-[#0A5ED6]/30' :
                'bg-slate-200 text-slate-500'
            }`}>
            {step < current ? <CheckCircle2 className="w-4 h-4" /> : step}
          </div>
          {step < total && (
            <div className={`h-px w-10 transition-all duration-300 ${step < current ? 'bg-emerald-500' : 'bg-slate-200'}`} />
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
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
        {icon} {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-400 font-medium">{error}</p>}
    </div>
  );
}

const inputCls = "w-full bg-[#F6FAFD] border border-[#E1EBF2] rounded-lg px-3.5 py-2 text-sm text-[#0A1931] placeholder-[#8CA3B8] focus:outline-none focus:border-[#4A7FA7] focus:ring-[3px] focus:ring-[#4A7FA7]/15 focus:bg-white transition-all";
const selectCls = inputCls + " appearance-none cursor-pointer";

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

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
      const org = await registerOrganization({
        name: form.name,
        industry: form.industry,
        employee_count: form.employee_count,
        country: form.country,
        admin_name: form.admin_name,
        admin_email: form.admin_email,
        phone: form.phone,
        password: form.password,
      });

      // Send Admin Welcome & Credentials email via public auth API
      try {
        await fetch("http://localhost:8000/auth/send-admin-credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.admin_email,
            full_name: form.admin_name,
            password: form.password,
            org_name: form.name
          })
        });
      } catch (e) {
        console.warn("[RegisterPage] Admin credentials email dispatch notify skipped/logged:", e);
      }

      // Temporarily store the password in sessionStorage so PortalPage can pass it to the local setup wizard
      sessionStorage.setItem('tempAdminPassword', form.password);

      navigate('/portal');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F6FAFD] text-[#0A1931] flex flex-col font-sans">
      <Header />

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-4 md:py-6 relative z-10">
        {/* Decorative background positioned behind the form area */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center items-center">
          <div className="w-[600px] h-[600px] bg-[#4A7FA7]/5 rounded-full blur-[120px]" />
        </div>

        <div className="w-full max-w-lg relative z-10">

          {/* Header — single clean title */}
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold text-[#0A1931]">
              {step === 1 && 'Register Your Organization'}
              {step === 2 && 'Administrator Details'}
              {step === 3 && 'Create Your Password'}
            </h1>
            <p className="text-xs text-[#4A6D8C] mt-1">
              {step === 1 && 'Tell us about your organization.'}
              {step === 2 && 'Who is the primary security administrator?'}
              {step === 3 && 'Secure your admin portal account.'}
            </p>
          </div>

          <StepIndicator current={step} total={3} />

          {/* Form Card */}
          <div className="bg-white border border-[#E1EBF2] rounded-2xl p-5 md:p-6 shadow-md">
            <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }} className="space-y-4" noValidate>

              {/* ── STEP 1: Organization ── */}
              {step === 1 && (
                <>
                  <Field label="Organization Name" icon={<Building2 className="w-3 h-3 text-[#4A6D8C]" />}>
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

                  <Field label="Industry" icon={<Briefcase className="w-3 h-3 text-[#4A6D8C]" />}>
                    <select id="industry" className={selectCls} value={form.industry} onChange={set('industry')}>
                      <option value="">Select industry...</option>
                      {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                    </select>
                  </Field>

                  <Field label="Country / Region" icon={<Globe className="w-3 h-3 text-[#4A6D8C]" />}>
                    <select id="country" className={selectCls} value={form.country} onChange={set('country')}>
                      <option value="">Select country...</option>
                      {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>

                  <Field label="Approximate Employees" icon={<Users className="w-3 h-3 text-[#4A6D8C]" />}>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {EMP_RANGES.map(r => (
                        <button
                          type="button"
                          key={r.value}
                          onClick={() => setForm(p => ({ ...p, employee_count: r.value }))}
                          className={`py-2 px-1 rounded-lg border text-xs font-semibold transition-all ${form.employee_count === r.value
                              ? 'bg-[#0A5ED6]/10 border-[#0A5ED6] text-[#0A5ED6]'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-[#0A5ED6]'
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
                      <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0A5ED6] transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Strength bar */}
                    {form.password && (
                      <div className="mt-1.5 h-1 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${form.password.length < 8 ? 'w-1/4 bg-red-500' :
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
                      <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#4A7FA7] transition-colors">
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
                      className="mt-0.5 w-4 h-4 rounded border-[#E1EBF2] bg-white accent-[#4A7FA7] cursor-pointer"
                    />
                    <span className="text-xs text-[#4A6D8C] leading-relaxed">
                      I agree to AegisOne's{' '}
                      <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTermsModal(true); }} className="text-[#4A7FA7] hover:text-[#3D6C90] cursor-pointer underline">Terms of Service</span>{' '}
                      and{' '}
                      <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowPrivacyModal(true); }} className="text-[#4A7FA7] hover:text-[#3D6C90] cursor-pointer underline">Privacy Policy</span>.
                      I understand that organization data is stored only on my own server.
                    </span>
                  </label>
                </>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600 font-medium flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                  {error}
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-2">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => { setStep(s => s - 1); setError(''); }}
                    className="flex items-center gap-1.5 px-4 py-[11px] rounded-lg border border-[#E1EBF2] text-[#4A6D8C] text-sm font-semibold hover:border-[#C7DAE8] hover:bg-[#F6FAFD] transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#4A7FA7] hover:bg-[#3D6C90] disabled:bg-[#4A7FA7]/50 text-white font-semibold py-[11px] rounded-lg text-sm transition-all shadow-sm"
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

          <div className="mt-8 text-center space-y-3">
            <p className="text-sm text-[#4A6D8C]">
              Already registered?{' '}
              <Link to="/login" className="text-[#4A7FA7] font-semibold hover:text-[#3D6C90] transition-colors">
                Sign In to Portal
              </Link>
            </p>
            <p className="text-xs text-[#8CA3B8]">
              We only store your organization profile. No employee, threat, or internal data ever reaches our servers.
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <AuthLoadingOverlay
          title="Creating your organization"
          steps={['Validating details', 'Securing admin account', 'Deploying your workspace']}
        />
      )}

      {/* PRIVACY POLICY MODAL */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden text-left">
            <div className="bg-[#F8FAFC] border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <span className="font-sans font-bold text-lg text-[#0F172A]">AegisOne Privacy Commitment</span>
              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[400px] overflow-y-auto space-y-4 text-xs text-[#45464D] leading-relaxed">
              <p className="font-semibold text-[#0F172A] text-sm">Your Data Stays With You — Always.</p>
              <p>
                At AegisOne, we design security tools around the fundamental right to data sovereignty. Unlike other link check and phishing services, our software functions directly inside your private hardware or corporate VPC. We do not inspect, upload, store, or transmit your URL checks, internal email activities, or employee credentials to our own external database servers.
              </p>
              <h4 className="font-bold text-[#0F172A] uppercase">1. Zero Log Transmission</h4>
              <p>
                All link inspection, scam diagnostics, and threat score calculations are completed entirely in memory on your private node. No log data or metadata containing user identity is sent back to AegisOne or any third-party analytics provider.
              </p>
              <h4 className="font-bold text-[#0F172A] uppercase">2. Local Storage Control</h4>
              <p>
                The audit trail, blocked scam URLs, and administrative threat reports generated by the software are saved directly onto your office local PostgreSQL database. You hold the unique decryption keys and maintain absolute control over security logs.
              </p>
              <h4 className="font-bold text-[#0F172A] uppercase">3. Strict Compliance</h4>
              <p>
                Because AegisOne does not act as a central data processor for your user traffic, using AegisOne greatly simplifies your GDPR, HIPAA, and SOC2 compliance profiles. No "cross-border data transfer" agreements are required for our core perimeter checks.
              </p>
            </div>
            <div className="bg-[#F8FAFC] border-t border-slate-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="font-sans text-xs font-bold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white px-5 py-2 rounded-lg cursor-pointer transition-colors"
              >
                Accept &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TERMS OF SERVICE MODAL */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden text-left">
            <div className="bg-[#F8FAFC] border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <span className="font-sans font-bold text-lg text-[#0F172A]">AegisOne Software Terms of Use</span>
              <button 
                onClick={() => setShowTermsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[400px] overflow-y-auto space-y-4 text-xs text-[#45464D] leading-relaxed">
              <p className="font-semibold text-[#0F172A] text-sm">Simple, Direct License Agreements</p>
              <h4 className="font-bold text-[#0F172A] uppercase">1. Sovereign Node Licensing</h4>
              <p>
                AegisOne grants you a non-exclusive, non-transferable license to execute our sovereign link filtering container on your own physical computer servers or cloud VPC subnets. You are solely responsible for setting up and keeping the Docker container active.
              </p>
              <h4 className="font-bold text-[#0F172A] uppercase">2. No Malicious Misuse</h4>
              <p>
                The provided AegisOne software is created solely to detect, block, and log phishing emails, scam portals, and credential stealing links targeting your staff. You may not reverse engineer, redistribute, or use our cognitive heuristics for malicious purposes.
              </p>
              <h4 className="font-bold text-[#0F172A] uppercase">3. Support &amp; SLA</h4>
              <p>
                Our team provides direct support, updates to local AI heuristics, and remote system integration consults for custom Cloud VPC deployments. You can trigger support updates and request revisions directly at araza2125-012.pgc@gmail.com.
              </p>
            </div>
            <div className="bg-[#F8FAFC] border-t border-slate-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowTermsModal(false)}
                className="font-sans text-xs font-bold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white px-5 py-2 rounded-lg cursor-pointer transition-colors"
              >
                Accept Terms
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

