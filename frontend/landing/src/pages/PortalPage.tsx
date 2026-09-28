import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Copy, CheckCircle2, LogOut,
  AlertCircle, Loader2, ArrowRight, X, ChevronRight, Download, ArrowDown,
  Server, Terminal, Globe, Info
} from 'lucide-react';
import { getMyOrganization, logoutOrganization } from '../lib/org-service';
import type { Organization } from '../lib/supabase';

const DASHBOARD_URL = `http://${window.location.hostname}:3002/login`;

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
      className={`flex items-center gap-1.5 text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg transition-all ${copied
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
  const [serverHost, setServerHost] = useState('localhost');
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    (async () => {
      // Detect Supabase email confirmation redirect (hash contains access_token)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        // Supabase SDK automatically exchanges this hash for a session
        // Give it a moment to process, then clean the URL
        await new Promise(r => setTimeout(r, 300));
        window.history.replaceState(null, '', window.location.pathname);
        setEmailConfirmed(true);
        // Hide the confirmed banner after 4 seconds
        setTimeout(() => setEmailConfirmed(false), 4000);
      }

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
      <div className="min-h-screen bg-[#F6FAFD] flex flex-col items-center justify-center gap-4">
        {emailConfirmed && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold px-5 py-3 rounded-xl shadow-sm animate-pulse">
            <CheckCircle2 className="w-5 h-5" />
            Email confirmed! Loading your portal...
          </div>
        )}
        <Loader2 className="w-8 h-8 text-[#4A7FA7] animate-spin" />
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

  // Do not use Vercel/public domain as the SERVER_HOST. 
  // Let PowerShell automatically detect the server's local network IP.
  const serverHostExportLinux = `export SERVER_HOST="$(hostname -I | awk '{print $1}')" && `;
  const serverHostExportWin = `$env:SERVER_HOST = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -ExpandProperty IPAddress -First 1); `;


  // Linux/macOS
  const linuxCommand = `mkdir -p AegisOne && cd AegisOne && curl -sSL https://raw.githubusercontent.com/AhmedRaza-2/AegisOne/main/docker-compose.prod.yml -o docker-compose.yml && ${serverHostExportLinux}export ORG_ID="${org.org_id}" LICENSE_KEY="${org.license_key}" DEPLOYMENT_TOKEN="${org.deployment_token}" ADMIN_EMAIL="${org.admin_email}" && docker compose pull && docker compose up -d --force-recreate`;

  // Windows PowerShell
  const windowsCommand = `mkdir AegisOne -ErrorAction SilentlyContinue; Set-Location AegisOne; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/AhmedRaza-2/AegisOne/main/docker-compose.prod.yml" -OutFile "docker-compose.yml"; ${serverHostExportWin}$env:ORG_ID="${org.org_id}"; $env:LICENSE_KEY="${org.license_key}"; $env:DEPLOYMENT_TOKEN="${org.deployment_token}"; $env:ADMIN_EMAIL="${org.admin_email}"; docker compose pull; docker compose up -d --force-recreate`;

  const activeCommand = osTab === 'linux' ? linuxCommand : windowsCommand;

  return (
    <div className="min-h-screen bg-[#F6FAFD] text-[#0A1931] flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Decorative bg */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#4A7FA7]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-600/5 rounded-full blur-[120px]" />
      </div>

      {/* Nav — identical style to main Header */}
      <header className="sticky top-0 z-50 bg-[#F8FAFC]/90 backdrop-blur-md border-b border-[#E2E8F0] px-6 py-4 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">

          {/* Logo — same as Header.tsx */}
          <div
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={() => navigate('/')}
          >
            <img src="/logo.png" alt="AegisOne" className="h-7 w-auto shrink-0 transition-transform duration-200 group-hover:scale-105" />
            <span className="font-sans font-bold text-lg text-[#0A1931] tracking-tight">AegisOne</span>
          </div>

          {/* Right side — email + sign out */}
          <div className="flex items-center gap-5">
            <span className="hidden sm:block text-sm font-medium text-[#45464D]">{org.admin_email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#45464D] hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </header>

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
          <h1 className="text-4xl md:text-5xl font-bold text-[#0A1931] tracking-tight">Welcome to AegisOne, {org.name}</h1>
          <p className="text-base text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Your deployment credentials have been securely generated and bound to your account.
            Run the command below on your own machine to start your private AegisOne services.
          </p>
        </div>

        {!isApproved ? (
          <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-12 text-center space-y-5 max-w-2xl mx-auto w-full mt-8">
            {org.status === 'pending' ? (
              <>
                <div className="w-20 h-20 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-10 h-10 text-amber-500" />
                </div>
                <h2 className="text-2xl font-bold text-[#0A1931]">Your request is under review</h2>
                <p className="text-[#45464D] max-w-md mx-auto text-base leading-relaxed">
                  Your registration has been successfully published. Our team is currently reviewing your enterprise application.
                  Once approved, your deployment command will unlock here automatically.
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
                  <X className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-[#0A1931]">Application Declined</h2>
                <p className="text-[#45464D] max-w-md mx-auto text-base leading-relaxed">
                  Unfortunately, we are unable to approve your organization at this time.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="animate-fadeIn max-w-4xl mx-auto w-full relative">
            
            {/* Vertical Connecting Line */}
            <div className="absolute left-[23px] top-6 bottom-10 w-[2px] bg-slate-300 hidden md:block z-0" />

            <div className="space-y-6 relative z-10">

              {/* Step 1: Install Docker */}
              <div className="flex flex-col md:flex-row gap-5 items-start">
                {/* Step Circle Badge */}
                <div className="shrink-0 hidden md:flex items-center justify-center w-12 h-12 rounded-full bg-[#0A1931] text-white font-bold text-lg border-4 border-[#F6FAFD] shadow-sm z-10">
                  1
                </div>

                {/* Card Body */}
                <div className="flex-1 w-full bg-white border border-slate-200/90 rounded-xl p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-3">
                      <span className="md:hidden inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#0A1931] text-white font-bold text-xs">
                        1
                      </span>
                      <h3 className="text-xl font-bold text-[#0A1931]">Install Docker Engine</h3>
                    </div>
                    <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      <Server className="w-3 h-3 mr-1 text-slate-500" /> Target Server Host
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                    Docker runs your private AegisOne backend, setup engine, and security services on your server.
                    Verify Docker is installed and running on the target server machine before continuing.
                  </p>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">Prerequisite:</span> Docker Desktop or Docker Engine.
                    </div>
                    <a
                      href="https://docs.docker.com/get-docker/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#4A7FA7] hover:bg-[#3B6A8C] px-4 py-2 rounded-lg transition-colors shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Docker
                    </a>
                  </div>
                </div>
              </div>

              {/* Step 2: Run Command */}
              <div className="flex flex-col md:flex-row gap-5 items-start">
                {/* Step Circle Badge */}
                <div className="shrink-0 hidden md:flex items-center justify-center w-12 h-12 rounded-full bg-[#1E3A8A] text-white font-bold text-lg border-4 border-[#F6FAFD] shadow-sm z-10">
                  2
                </div>

                {/* Card Body */}
                <div className="flex-1 w-full bg-white border border-slate-200/90 rounded-xl p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-3">
                      <span className="md:hidden inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#1E3A8A] text-white font-bold text-xs">
                        2
                      </span>
                      <h3 className="text-xl font-bold text-[#0A1931]">Run Deployment Script</h3>
                    </div>
                    <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      <Terminal className="w-3 h-3 mr-1 text-blue-600" /> Server Terminal
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                    Copy the script below and paste it inside the terminal prompt <strong className="text-slate-800">on your server machine</strong> where Docker is running.
                  </p>

                  {/* Execution Location Callout */}
                  <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs text-slate-700 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      <strong>Terminal Host Location:</strong> Open SSH / Terminal on your server machine, then run the command below.
                    </span>
                  </div>

                  {/* Terminal Block */}
                  <div className="bg-[#0B172A] rounded-lg shadow-md overflow-hidden border border-slate-800 text-left">
                    <div className="bg-[#1E293B]/90 border-b border-slate-700 px-3.5 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="hidden sm:flex gap-1.5 mr-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                        </div>
                        <button
                          onClick={() => setOsTab('linux')}
                          className={`text-xs font-medium px-2.5 py-1 rounded transition-colors ${osTab === 'linux' ? 'bg-[#334155] text-white font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          Linux / macOS (Bash)
                        </button>
                        <button
                          onClick={() => setOsTab('windows')}
                          className={`text-xs font-medium px-2.5 py-1 rounded transition-colors ${osTab === 'windows' ? 'bg-[#334155] text-white font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          Windows (PowerShell)
                        </button>
                      </div>
                      <div className="pl-3 border-l border-slate-700">
                        <CopyButton value={activeCommand} label="Copy Script" />
                      </div>
                    </div>

                    <div className="p-3.5 md:p-4 overflow-x-auto custom-scrollbar">
                      <pre className="text-emerald-400 font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-all font-bold">
                        {activeCommand}
                      </pre>
                    </div>
                  </div>

                </div>
              </div>

              {/* Step 3: Access Dashboard */}
              <div className="flex flex-col md:flex-row gap-5 items-start">
                {/* Step Circle Badge */}
                <div className="shrink-0 hidden md:flex items-center justify-center w-12 h-12 rounded-full bg-emerald-600 text-white font-bold text-lg border-4 border-[#F6FAFD] shadow-sm z-10">
                  3
                </div>

                {/* Card Body */}
                <div className="flex-1 w-full bg-white border border-slate-200/90 rounded-xl p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-3">
                      <span className="md:hidden inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs">
                        3
                      </span>
                      <h3 className="text-xl font-bold text-[#0A1931]">Launch Setup Engine</h3>
                    </div>
                    <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Globe className="w-3 h-3 mr-1 text-emerald-600" /> Web Browser
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                    Once containers finish booting, AegisOne Setup Engine will be live on <strong className="text-slate-800">port 3002</strong> of your server.
                  </p>

                  {/* Server Host IP Config Box */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 text-left">
                      Server Host IP or Domain
                    </label>
                    <input 
                      type="text" 
                      value={serverHost}
                      onChange={(e) => setServerHost(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-[#0A1931] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none font-mono"
                      placeholder="e.g. 192.168.1.50 or localhost"
                    />
                    <p className="text-xs text-slate-500 mt-2 text-left">
                      If your server is running on a remote machine or VM on your network, enter its IP address above. Otherwise, leave it as <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">localhost</code>.
                    </p>
                  </div>

                  {/* Launch Action Area */}
                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <a
                      href={(() => {
                        let host = serverHost.trim() || 'localhost';
                        host = host.replace(/^https?:\/\//, '');
                        host = host.split('/')[0];
                        host = host.split(':')[0];
                        return `http://${host}:3002/dashboard/admin/setup?fromLanding=true&orgName=${encodeURIComponent(org?.name || '')}&industry=${encodeURIComponent(org?.industry || '')}&adminEmail=${encodeURIComponent(org?.admin_email || '')}&adminName=${encodeURIComponent(org?.admin_name || org?.contact_person || 'Administrator')}&adminPassword=${encodeURIComponent(sessionStorage.getItem('tempAdminPassword') || '')}`;
                      })()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0A1931] hover:bg-[#1E293B] text-white font-bold px-7 py-3 rounded-xl text-sm transition-all shadow-sm hover:shadow-md"
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
