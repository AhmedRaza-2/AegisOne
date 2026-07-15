import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield, Copy, CheckCircle2, Download, Terminal, LogOut,
  Building2, Key, Cpu, Users, Globe, AlertCircle, Loader2,
  ExternalLink, ChevronRight, Package, ArrowRight
} from 'lucide-react';
import { getMyOrganization, logoutOrganization } from '../lib/org-service';
import type { Organization } from '../lib/supabase';

// URLs for the other apps
const SETUP_WIZARD_URL = 'http://localhost:3001';
const DASHBOARD_URL = 'http://localhost:3002/login';

// ─── Small helpers ────────────────────────────────────────────────────────────
function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-all ${
        copied
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
      }`}
    >
      {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : (label ?? 'Copy')}
    </button>
  );
}

function InfoRow({ label, value, mono = false, copiable = false }: {
  label: string; value: string; mono?: boolean; copiable?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
      <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm text-white ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
        {copiable && <CopyButton value={value} />}
      </div>
    </div>
  );
}

const STEPS = [
  {
    icon: <Download className="w-5 h-5" />,
    title: 'Download Deployment Bundle',
    desc: 'Get your pre-configured Docker package with your organization credentials baked in.',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  {
    icon: <Terminal className="w-5 h-5" />,
    title: 'Run on Your Server',
    desc: 'Execute docker compose up -d inside your organization\'s own infrastructure.',
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  },
  {
    icon: <Cpu className="w-5 h-5" />,
    title: 'Complete Setup Wizard',
    desc: 'Add departments, employees, and configure security policies — all locally.',
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Protection Goes Live',
    desc: 'Install browser extensions and start real-time phishing detection. Zero data leaves your network.',
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
];

// ─── Main Portal ──────────────────────────────────────────────────────────────
export default function PortalPage() {
  const navigate = useNavigate();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await getMyOrganization();
      if (!data) { navigate('/login'); return; }
      setOrg(data);
      setLoading(false);
    })();
  }, [navigate]);

  const handleLogout = async () => {
    await logoutOrganization();
    navigate('/login');
  };

  const [downloading, setDownloading] = useState(false);

  const handleDownloadBundle = () => {
    if (!org) return;
    setDownloading(true);

    // Build the deployment bundle JSON
    const bundle = {
      aegisone_version: `v${org.product_version}`,
      generated_at: new Date().toISOString(),
      organization: {
        id: org.org_id,
        name: org.name,
        industry: org.industry,
        country: org.country,
        admin_email: org.admin_email,
        allowed_users: org.allowed_users,
      },
      credentials: {
        deployment_token: org.deployment_token,
        license_key: org.license_key,
      },
      setup_instructions: {
        step_1: 'Run setup wizard at http://localhost:3001 on your office server',
        step_2: 'Paste your Deployment Token when prompted',
        step_3: 'Add departments and employees inside the setup wizard',
        step_4: 'Access your dashboard at http://localhost:3002',
      },
      docker_command: `docker compose up -d --env ORG_ID=${org.org_id} LICENSE_KEY=${org.license_key}`,
    };

    // Trigger browser download
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aegisone-bundle-${org.org_id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setTimeout(() => {
      setDownloading(false);
      // Open setup wizard in new tab
      window.open(SETUP_WIZARD_URL, '_blank');
    }, 800);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!org) return null;

  const statusColor = org.status === 'active'
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : org.status === 'pending'
    ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    : 'text-red-400 bg-red-500/10 border-red-500/30';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      {/* Decorative bg */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#0A5ED6]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-600/5 rounded-full blur-[120px]" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0A5ED6]/10 border border-[#0A5ED6]/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#0A5ED6]" />
          </div>
          <span className="font-bold text-[#0F172A] text-sm">AegisOne</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden sm:block text-xs text-slate-500 font-semibold">{org.admin_email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-200"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </nav>

      {/* Main */}
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8 relative z-10">

        {/* Welcome banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Organization Dashboard</p>
            <h1 className="text-2xl font-bold text-[#0F172A]">{org.name}</h1>
            <p className="text-sm text-[#45464D] mt-0.5">{org.industry} · {org.country}</p>
          </div>
          <span className={`self-start sm:self-auto text-xs font-bold px-3 py-1.5 rounded-full border uppercase tracking-wider ${statusColor}`}>
            {org.status === 'active' && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
            {org.status === 'pending' && <AlertCircle className="w-3 h-3 inline mr-1" />}
            License {org.status}
          </span>
        </div>

        {org.status === 'pending' ? (
          <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-[#0F172A]">Your request is under review</h2>
            <p className="text-[#45464D] max-w-md mx-auto text-sm leading-relaxed">
              Your registration has been published. Our team is currently reviewing your application. We will contact you soon with your approval status and next steps.
            </p>
          </div>
        ) : org.status === 'suspended' ? (
          <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-100 border border-red-200 flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-[#0F172A]">Application Declined</h2>
            <p className="text-[#45464D] max-w-md mx-auto text-sm leading-relaxed">
              Unfortunately, we are unable to approve your organization at this time.
            </p>
            {org.product_version !== '1.0.0' && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl inline-block text-left">
                <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-1">Reason</p>
                <p className="text-sm text-red-600">{org.product_version}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: <Key className="w-5 h-5 text-[#0A5ED6]" />, label: 'Organization ID', value: org.org_id },
                { icon: <Users className="w-5 h-5 text-purple-600" />, label: 'Allowed Users', value: `${org.allowed_users}` },
                { icon: <Package className="w-5 h-5 text-emerald-600" />, label: 'Product Version', value: `v${org.product_version}` },
                { icon: <Globe className="w-5 h-5 text-amber-600" />, label: 'Deployment Type', value: 'Self-Hosted' },
              ].map(s => (
                <div key={s.label} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">{s.icon}</div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{s.label}</p>
                  <p className="text-lg font-bold text-[#0F172A] font-mono">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Credentials card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-[#0A5ED6]/10 border border-[#0A5ED6]/20 flex items-center justify-center">
                  <Key className="w-4 h-4 text-[#0A5ED6]" />
                </div>
                <div>
                  <h2 className="font-bold text-[#0F172A] text-sm">Deployment Credentials</h2>
                  <p className="text-xs text-slate-500">Store these securely. Used during your first local setup.</p>
                </div>
              </div>

              <InfoRow label="Organization ID"    value={org.org_id}            mono copiable />
              <InfoRow label="Deployment Token"   value={org.deployment_token}  mono copiable />
              <InfoRow label="License Key"        value={org.license_key}       mono copiable />
              <InfoRow label="Admin Email"        value={org.admin_email}             copiable />

              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed font-medium">
                  Keep your Deployment Token and License Key private. These are used to activate your local AegisOne portal during the first boot. Do not share them.
                </p>
              </div>
            </div>

            {/* Download & Docker Instructions */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 text-white shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-[#0A5ED6]/20 border border-[#0A5ED6]/30 flex items-center justify-center shrink-0">
                  <Download className="w-7 h-7 text-[#0A5ED6]" />
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-white text-base">Local Docker Setup Guide</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Your environment is ready. Follow these layman steps to spin up AegisOne on your local server.
                  </p>
                </div>
                <button
                  onClick={handleDownloadBundle}
                  disabled={downloading}
                  className="flex items-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] disabled:bg-[#0A5ED6]/50 disabled:cursor-not-allowed text-white font-bold px-5 py-3 rounded-xl text-sm transition-all shrink-0 whitespace-nowrap"
                >
                  {downloading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Preparing...</>
                  ) : (
                    <><Download className="w-4 h-4" /> Download Config Bundle</>
                  )}
                </button>
              </div>

              {/* Docker Setup Steps */}
              <div className="bg-slate-950 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#0A5ED6]" /> 
                  Quick Start Instructions
                </h3>
                
                <div className="space-y-4 text-sm text-slate-300">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs shrink-0">1</div>
                    <div>
                      <p className="font-semibold text-white mb-1">Download Configuration</p>
                      <p className="text-xs">Click the button above to download your <code className="text-[#0A5ED6] bg-[#0A5ED6]/10 px-1 py-0.5 rounded">aegisone-bundle.json</code> file.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs shrink-0">2</div>
                    <div>
                      <p className="font-semibold text-white mb-1">Install Docker</p>
                      <p className="text-xs">Ensure you have <a href="https://docs.docker.com/get-docker/" target="_blank" rel="noreferrer" className="text-[#0A5ED6] hover:underline">Docker installed</a> on your machine or server.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs shrink-0">3</div>
                    <div className="w-full">
                      <p className="font-semibold text-white mb-1">Run the AegisOne Container</p>
                      <p className="text-xs mb-2">Open your terminal/command prompt and run the following command:</p>
                      <div className="bg-black/50 p-3 rounded-lg border border-slate-800 overflow-x-auto">
                        <code className="text-emerald-400 font-mono text-xs whitespace-pre">
                          docker run -d \<br/>
                          &nbsp;&nbsp;--name aegisone-shield \<br/>
                          &nbsp;&nbsp;-p 3000:3000 -p 5432:5432 \<br/>
                          &nbsp;&nbsp;-v ./aegisone-bundle.json:/app/config.json \<br/>
                          &nbsp;&nbsp;aegisone/enterprise-shield:latest
                        </code>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs shrink-0">4</div>
                    <div>
                      <p className="font-semibold text-white mb-1">Access Your Local Dashboard</p>
                      <p className="text-xs">Open <a href="http://localhost:3000" target="_blank" rel="noreferrer" className="text-[#0A5ED6] hover:underline">http://localhost:3000</a> in your browser to view your live perimeter security!</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondary CTA row */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-blue-500/20">
                <a
                  href={SETUP_WIZARD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all border border-slate-700"
                >
                  <ChevronRight className="w-4 h-4 text-blue-400" />
                  Open Setup Wizard
                </a>
                <a
                  href={DASHBOARD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all border border-slate-700"
                >
                  <ArrowRight className="w-4 h-4 text-emerald-400" />
                  Go to Dashboard
                </a>
              </div>
            </div>

            {/* Next Steps */}
            <div>
              <h2 className="text-base font-bold text-white mb-4">Your Setup Journey</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {STEPS.map((s, i) => (
                  <div key={i} className={`bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3 relative hover:border-slate-700 transition-all`}>
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${s.color}`}>
                      {s.icon}
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Step {i + 1}</p>
                      <h3 className="text-sm font-bold text-white leading-snug">{s.title}</h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{s.desc}</p>
                    </div>
                    {i < STEPS.length - 1 && (
                      <ChevronRight className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 hidden lg:block" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Docs link */}
            <div className="flex justify-center pt-2">
              <a href="#" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-400 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> View Full Installation Guide
              </a>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
