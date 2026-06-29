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
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Decorative bg */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/4 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-600/3 rounded-full blur-[150px]" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-slate-900 bg-slate-950/90 backdrop-blur-sm">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-blue-400" />
          </div>
          <span className="font-bold text-white text-sm">AegisOne</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden sm:block text-xs text-slate-400">{org.admin_email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </nav>

      {/* Main */}
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8 relative z-10">

        {/* Welcome banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-900">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Organization Dashboard</p>
            <h1 className="text-2xl font-bold text-white">{org.name}</h1>
            <p className="text-sm text-slate-400 mt-0.5">{org.industry} · {org.country}</p>
          </div>
          <span className={`self-start sm:self-auto text-xs font-bold px-3 py-1.5 rounded-full border uppercase tracking-wider ${statusColor}`}>
            {org.status === 'active' && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
            {org.status === 'pending' && <AlertCircle className="w-3 h-3 inline mr-1" />}
            License {org.status}
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: <Key className="w-5 h-5 text-blue-400" />, label: 'Organization ID', value: org.org_id },
            { icon: <Users className="w-5 h-5 text-purple-400" />, label: 'Allowed Users', value: `${org.allowed_users}` },
            { icon: <Package className="w-5 h-5 text-emerald-400" />, label: 'Product Version', value: `v${org.product_version}` },
            { icon: <Globe className="w-5 h-5 text-amber-400" />, label: 'Deployment Type', value: 'Self-Hosted' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">{s.icon}</div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{s.label}</p>
              <p className="text-lg font-bold text-white font-mono">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Credentials card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Key className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">Deployment Credentials</h2>
              <p className="text-xs text-slate-500">Store these securely. Used during your first local setup.</p>
            </div>
          </div>

          <InfoRow label="Organization ID"    value={org.org_id}            mono copiable />
          <InfoRow label="Deployment Token"   value={org.deployment_token}  mono copiable />
          <InfoRow label="License Key"        value={org.license_key}       mono copiable />
          <InfoRow label="Admin Email"        value={org.admin_email}             copiable />

          <div className="mt-4 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300/80 leading-relaxed">
              Keep your Deployment Token and License Key private. These are used to activate your local AegisOne portal during the first boot. Do not share them.
            </p>
          </div>
        </div>

          {/* Download CTA */}
          <div className="bg-gradient-to-br from-blue-600/15 to-cyan-600/10 border border-blue-500/20 rounded-2xl p-6 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <Download className="w-7 h-7 text-blue-400" />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-white text-base">Download Your Deployment Bundle</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Your <code className="font-mono text-blue-300">aegisone-bundle.json</code> contains your Org ID, License Key, and Deployment Token. The setup wizard will open automatically.
                </p>
              </div>
              <button
                onClick={handleDownloadBundle}
                disabled={downloading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold px-5 py-3 rounded-xl text-sm transition-all shrink-0 whitespace-nowrap"
              >
                {downloading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Preparing...</>
                ) : (
                  <><Download className="w-4 h-4" /> Download Bundle</>
                )}
              </button>
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

      </div>
    </div>
  );
}
