import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield, Copy, CheckCircle2, LogOut,
  AlertCircle, Loader2, ArrowRight, X, ChevronRight, Download, ArrowDown
} from 'lucide-react';
import { getMyOrganization, logoutOrganization } from '../lib/org-service';
import type { Organization } from '../lib/supabase';

const DASHBOARD_URL = 'http://localhost:3002/login';

// ─── Copy Button Helper ────────────────────────────────────────────────────
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
      className={`flex items-center gap-1.5 text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg transition-all ${
        copied
          ? 'bg-emerald-500 text-white border border-emerald-600 shadow-md'
          : 'bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white border border-white/10 backdrop-blur-sm'
      }`}
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : (label ?? 'Copy')}
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function PortalPage() {
  const navigate = useNavigate();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [osTab, setOsTab] = useState<'linux' | 'windows'>('linux');

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#0A5ED6] animate-spin" />
      </div>
    );
  }

  if (!org) return null;

  const statusColor = org.status === 'active'
    ? 'text-emerald-700 bg-emerald-100 border-emerald-200'
    : org.status === 'pending'
    ? 'text-amber-700 bg-amber-100 border-amber-200'
    : 'text-red-700 bg-red-100 border-red-200';

  const isApproved = org.status === 'active';

  // ── Deploy commands ────────────────────────────────────────────────────────
  // Linux/macOS
  const linuxCommand = [
    `# ── First time / fresh install ────────────────────────────────`,
    `# Stop old containers (keeps database if upgrading, add -v to wipe)`,
    `docker compose down --remove-orphans 2>/dev/null`,
    ``,
    `# Set your organisation credentials`,
    `export ORG_ID="${org.org_id}" \\`,
    `       LICENSE_KEY="${org.license_key}" \\`,
    `       DEPLOYMENT_TOKEN="${org.deployment_token}" \\`,
    `       ADMIN_EMAIL="${org.admin_email}"`,
    ``,
    `# Build images from source and start all 4 services (Postgres + backend + setup + dashboard)`,
    `docker compose up -d --build --remove-orphans`,
  ].join('\n');

  // Windows PowerShell
  const windowsCommand = [
    `# ── First time / fresh install ────────────────────────────────`,
    `# Stop old containers (keeps database if upgrading, add -v to wipe)`,
    `docker compose down --remove-orphans 2>$null`,
    ``,
    `# Set your organisation credentials`,
    `$env:ORG_ID="${org.org_id}"`,
    `$env:LICENSE_KEY="${org.license_key}"`,
    `$env:DEPLOYMENT_TOKEN="${org.deployment_token}"`,
    `$env:ADMIN_EMAIL="${org.admin_email}"`,
    ``,
    `# Build images from source and start all 4 services (Postgres + backend + setup + dashboard)`,
    `docker compose up -d --build --remove-orphans`,
  ].join('\n');

  const activeCommand = osTab === 'linux' ? linuxCommand : windowsCommand;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Decorative bg */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#0A5ED6]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-600/5 rounded-full blur-[120px]" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0A5ED6]/10 border border-[#0A5ED6]/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#0A5ED6]" />
          </div>
          <span className="font-bold text-[#0F172A] text-sm tracking-tight">AegisOne Onboarding</span>
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

      {/* Main Content */}
      <div className="max-w-5xl mx-auto w-full px-4 py-16 relative z-10 flex flex-col gap-12">

        {/* Header */}
        <div className="text-center space-y-4 mb-4">
          <span className={`inline-flex items-center text-[10px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider mb-2 ${statusColor}`}>
            {org.status === 'active' && <CheckCircle2 className="w-3 h-3 mr-1" />}
            {org.status === 'pending' && <AlertCircle className="w-3 h-3 mr-1" />}
            {org.status === 'suspended' && <X className="w-3 h-3 mr-1" />}
            Status: {org.status}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-[#0F172A] tracking-tight">Welcome to AegisOne, {org.name}</h1>
          <p className="text-base text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Your deployment credentials have been securely generated and bound to your account.
            Run the command below on your own machine to start your private AegisOne services.
          </p>
        </div>

        {!isApproved ? (
          <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-12 text-center space-y-5 max-w-2xl mx-auto w-full mt-8">
            {org.status === 'pending' ? (
              <>
                <div className="w-20 h-20 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-10 h-10 text-amber-500" />
                </div>
                <h2 className="text-2xl font-bold text-[#0F172A]">Your request is under review</h2>
                <p className="text-[#45464D] max-w-md mx-auto text-base leading-relaxed">
                  Your registration has been successfully published. Our team is currently reviewing your enterprise application.
                  Once approved, your deployment command will unlock here automatically.
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-red-100 border border-red-200 flex items-center justify-center mx-auto mb-4">
                  <X className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-[#0F172A]">Application Declined</h2>
                <p className="text-[#45464D] max-w-md mx-auto text-base leading-relaxed">
                  Unfortunately, we are unable to approve your organization at this time.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="animate-fadeIn max-w-4xl mx-auto w-full relative">
            {/* Connecting line */}
            <div className="absolute left-6 top-8 bottom-16 w-0.5 bg-gradient-to-b from-blue-200 via-slate-200 to-emerald-200 hidden md:block" />

            <div className="space-y-16">

              {/* Step 1: Install Docker */}
              <div className="flex flex-col md:flex-row gap-6 md:gap-10 relative z-10">
                <div className="shrink-0 flex justify-center md:block">
                  <div className="w-12 h-12 rounded-full bg-white border-4 border-slate-100 shadow-sm flex items-center justify-center text-slate-500 font-bold text-lg relative">
                    1
                    <div className="absolute -bottom-6 text-slate-300 hidden md:block"><ArrowDown className="w-5 h-5" /></div>
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-bold text-[#0F172A] mb-3">Install Docker Engine</h3>
                  <p className="text-base text-slate-600 mb-5 leading-relaxed max-w-2xl mx-auto md:mx-0">
                    The landing site stays online independently. Docker runs your private backend, setup wizard,
                    and dashboard on your own machine. Before continuing, ensure Docker is installed and running.
                  </p>
                  <a
                    href="https://docs.docker.com/get-docker/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 text-sm font-bold text-[#0A5ED6] hover:text-white bg-blue-50 hover:bg-[#0A5ED6] border border-blue-100 hover:border-[#0A5ED6] px-6 py-3 rounded-xl transition-all shadow-sm"
                  >
                    <Download className="w-4 h-4" /> Download Docker Free
                  </a>
                </div>
              </div>

              {/* Step 2: Run Command */}
              <div className="flex flex-col md:flex-row gap-6 md:gap-10 relative z-10">
                <div className="shrink-0 flex justify-center md:block">
                  <div className="w-12 h-12 rounded-full bg-white border-4 border-blue-100 shadow-sm flex items-center justify-center text-[#0A5ED6] font-bold text-lg relative">
                    2
                    <div className="absolute -bottom-6 text-[#0A5ED6] animate-bounce hidden md:block"><ArrowDown className="w-5 h-5" /></div>
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-bold text-[#0F172A] mb-3">Run the Start Command</h3>
                  <p className="text-base text-slate-600 mb-6 leading-relaxed max-w-2xl mx-auto md:mx-0">
                    The command automatically <strong className="text-slate-800">stops any old containers</strong> first,
                    then pulls the latest compose file and spins up fresh services with your{' '}
                    <strong className="text-slate-800">Organization ID</strong>,{' '}
                    <strong className="text-slate-800">License Key</strong>, and{' '}
                    <strong className="text-slate-800">Deployment Token</strong> pre-injected.
                  </p>

                  {/* Terminal Block */}
                  <div className="bg-[#0F172A] rounded-2xl shadow-2xl relative group overflow-hidden border border-slate-800 text-left">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#0A5ED6]/30 rounded-full blur-[80px] pointer-events-none" />

                    <div className="bg-slate-900/50 border-b border-slate-800 px-4 py-3 flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <div className="hidden sm:flex gap-2 mr-2">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <div className="w-3 h-3 rounded-full bg-amber-500" />
                          <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        </div>
                        <button
                          onClick={() => setOsTab('linux')}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${osTab === 'linux' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                        >
                          Linux / macOS (Bash)
                        </button>
                        <button
                          onClick={() => setOsTab('windows')}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${osTab === 'windows' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                        >
                          Windows (PowerShell)
                        </button>
                      </div>
                      <div className="pl-4 border-l border-slate-700 ml-2">
                        <CopyButton value={activeCommand} label="Copy Script" />
                      </div>
                    </div>

                    <div className="p-6 md:p-8 overflow-x-auto relative z-10">
                      <pre className="text-emerald-400 font-mono text-sm leading-relaxed whitespace-pre">
                        {activeCommand}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Access Dashboard */}
              <div className="flex flex-col md:flex-row gap-6 md:gap-10 relative z-10">
                <div className="shrink-0 flex justify-center md:block">
                  <div className="w-12 h-12 rounded-full bg-white border-4 border-emerald-100 shadow-sm flex items-center justify-center text-emerald-600 font-bold text-lg">
                    3
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-bold text-[#0F172A] mb-3">Start Organization Setup</h3>
                  <p className="text-base text-slate-600 mb-6 leading-relaxed max-w-2xl mx-auto md:mx-0">
                    Your AegisOne instance is initialized and ready. Click below to launch the step-by-step setup engine and configure your organization.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                    <a
                      href={`http://localhost:3002/dashboard/admin/setup?fromLanding=true&orgName=${encodeURIComponent(org?.name || '')}&industry=${encodeURIComponent(org?.industry || '')}&adminEmail=${encodeURIComponent(org?.admin_email || '')}&adminName=${encodeURIComponent(org?.contact_person || 'Administrator')}&adminPassword=${encodeURIComponent(sessionStorage.getItem('tempAdminPassword') || '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold px-8 py-4 rounded-xl text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    >
                      Start Setup Engine Now <ChevronRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
