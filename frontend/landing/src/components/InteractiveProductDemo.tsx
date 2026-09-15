import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Shield, RefreshCw, Search, Users, Activity, BarChart3, TrendingUp, AlertTriangle, 
  Cpu, Clock, Globe, Mail, FileText, Image, Building2, LayoutDashboard,
  MessageSquare, ClipboardList, ShieldCheck, Puzzle, Settings, Bell,
  Menu, User, Laptop, Maximize2, EyeOff, Monitor, X, Play, 
  ChevronDown, ArrowRight, CheckCircle2, ShieldAlert, Lock, Check, Zap, Sparkles, Send, Phone, Video, MoreVertical, Paperclip, Database, ExternalLink, Download, Key, Sun, Moon, LogOut, UserCog
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

type TimeRange = '24h' | '7d' | '30d' | 'all_time';
type SidebarTab = 'admin' | 'scanner' | 'email' | 'departments' | 'incidents' | 'analytics' | 'communication' | 'extension' | 'audit' | 'setup';
type DisplayMode = 'laptop' | 'expanded' | 'hidden';

export default function InteractiveProductDemo() {
  const [activeTab, setActiveTab] = useState<SidebarTab>('admin');
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isModalOpen) {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'unset';
        document.documentElement.style.overflow = 'unset';
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'unset';
        document.documentElement.style.overflow = 'unset';
      }
    };
  }, [isModalOpen]);

  // Simulated attack state
  const [threatCountBonus, setThreatCountBonus] = useState(0);
  const [scanCountBonus, setScanCountBonus] = useState(0);
  const [liveAlert, setLiveAlert] = useState<{
    id: string;
    url: string;
    type: string;
    dept: string;
    time: string;
  } | null>(null);

  // Live URL Scanner State
  const [scanInputUrl, setScanInputUrl] = useState('https://secure-login-microsoft365-verify.com/auth');
  const [isScanningUrl, setIsScanningUrl] = useState(false);
  const [scanResult, setScanResult] = useState<{
    status: 'phishing' | 'safe' | 'suspicious';
    score: number;
    verdict: string;
    reasons: string[];
  } | null>(null);

  const metrics = {
    '24h': { employees: 10, scans: 84 + scanCountBonus, threats: 1 + threatCountBonus, incidents: 0 },
    '7d': { employees: 10, scans: 246 + scanCountBonus, threats: 3 + threatCountBonus, incidents: 0 },
    '30d': { employees: 10, scans: 1184 + scanCountBonus, threats: 14 + threatCountBonus, incidents: 0 },
    'all_time': { employees: 10, scans: 8940 + scanCountBonus, threats: 87 + threatCountBonus, incidents: 1 },
  }[timeRange];

  const trendData = [
    { date: "Mon", safe: 120 + scanCountBonus, threats: 1 },
    { date: "Tue", safe: 150, threats: 2 },
    { date: "Wed", safe: 180, threats: 0 },
    { date: "Thu", safe: 130 + (threatCountBonus > 0 ? 1 : 0), threats: threatCountBonus },
    { date: "Fri", safe: 160, threats: 1 },
    { date: "Sat", safe: 90, threats: 0 },
    { date: "Sun", safe: 110, threats: 0 },
  ];

  const departments = [
    { id: 'it', name: 'Information Technology', members: 2, lead: 'Ahmed 2', scans: 84, threats: 2 + (threatCountBonus > 0 ? 1 : 0), avgRisk: 12, employees: ['Ahmed R. (Network Sec)', 'Tariq K. (SysAdmin)'] },
    { id: 'devops', name: 'DevOps', members: 3, lead: 'Muhid 1', scans: 112, threats: 1, avgRisk: 8, employees: ['Muhid A. (SRE Lead)', 'Usman B. (CI/CD Pipeline)', 'Danyal P. (Cloud Architect)'] },
    { id: 'webdev', name: 'Web Development', members: 3, lead: 'Ali Bin 1', scans: 50, threats: 0, avgRisk: 0, employees: ['Ali B. (Frontend Tech)', 'Sara M. (Fullstack)', 'Zain H. (UI Design)'] },
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleSimulateAttack = () => {
    const attackSamples = [
      { url: 'https://login-auth-office365-sec.ru/login', type: 'Fake Microsoft SSO Credential Harvester', dept: 'DevOps' },
      { url: 'http://wire-transfer-approval-ceo.info/doc', type: 'Urgent Wire Scam / CEO Impersonation', dept: 'Information Technology' },
      { url: 'https://secure-invoice-dropbox.download.zip', type: 'Weaponized Attachment Gateway', dept: 'Web Development' },
    ];
    const picked = attackSamples[Math.floor(Math.random() * attackSamples.length)];
    setScanCountBonus((prev) => prev + 1);
    setThreatCountBonus((prev) => prev + 1);
    setLiveAlert({ id: Math.random().toString(), url: picked.url, type: picked.type, dept: picked.dept, time: 'Just now' });
  };

  const handleRunUrlScan = () => {
    if (!scanInputUrl) return;
    setIsScanningUrl(true);
    setScanResult(null);
    setTimeout(() => {
      setIsScanningUrl(false);
      const isLegit = scanInputUrl.includes('github.com') || scanInputUrl.includes('google.com') || scanInputUrl.includes('microsoft.com') && !scanInputUrl.includes('-verify');
      if (isLegit) {
        setScanResult({
          status: 'safe', score: 99.8, verdict: 'Legitimate & Safe Domain',
          reasons: ['SSL Certificate verified against official authority', 'No credential forms detected matching known corporate spoofing', 'Domain reputation score: Clean (0/92 vendor alerts)']
        });
      } else {
        setScanResult({
          status: 'phishing', score: 98.9, verdict: 'High-Risk Phishing Threat Isolated',
          reasons: ['Heuristic detection: Brand impersonation pattern identified', 'Deceptive login form targeting corporate credentials', 'Domain registered within last 48 hours via high-risk registrar']
        });
      }
    }, 700);
  };

  const navItems = [
    { label: "Dashboard", id: "admin", icon: LayoutDashboard, group: "" },
    { label: "Analytics", id: "analytics", icon: BarChart3, group: "" },
    { label: "Communication", id: "communication", icon: MessageSquare, group: "" },
    { label: "Departments & Users", id: "departments", icon: Building2, group: "Team" },
    { label: "Email Security", id: "email", icon: Mail, group: "Protection" },
    { label: "Live Threat Scanner", id: "scanner", icon: Globe, group: "Protection" },
    { label: "Browser Extension", id: "extension", icon: Puzzle, group: "Protection" },
    { label: "Incidents", id: "incidents", icon: AlertTriangle, group: "Monitoring" },
    { label: "Audit Logs", id: "audit", icon: ClipboardList, group: "Monitoring" },
    { label: "Organization Setup", id: "setup", icon: ShieldCheck, group: "Settings" },
  ];

  const groupedItems = navItems.reduce((acc: Record<string, any[]>, item: any) => {
    const g = item.group || "ungrouped";
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  const renderDashboardUI = () => (
    <div className={`flex bg-slate-50 w-full relative overflow-hidden font-sans text-left ${isModalOpen ? 'flex-1 min-h-0' : 'h-[750px] md:h-[800px]'}`}>
      {/* Sidebar */}
      <aside className="w-[260px] flex-col border-r border-slate-200 bg-white shrink-0 hidden md:flex h-full absolute left-0 top-0 bottom-0 z-20">
        <div className="h-[72px] flex flex-col justify-center px-6 shrink-0 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AegisOne Logo" className="w-9 h-9 object-contain shrink-0" />
            <div className="flex flex-col">
              <span className="text-[17px] font-bold tracking-tight text-[#0A5ED6] leading-tight">AegisOne</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Enterprise Portal</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {groupedItems["ungrouped"] && (
            <div className="mb-2 space-y-1">
              {groupedItems["ungrouped"].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as SidebarTab)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all relative group cursor-pointer ${
                    activeTab === item.id || (activeTab === 'admin' && item.id === 'admin')
                      ? "bg-slate-100 text-[#0A5ED6] font-semibold shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <item.icon className={`shrink-0 transition-colors ${activeTab === item.id ? 'w-[18px] h-[18px]' : 'w-[18px] h-[18px] group-hover:text-slate-800'}`} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.id === 'scanner' && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wider">Test</span>
                  )}
                  {item.id === 'email' && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold leading-none flex items-center justify-center">3</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-center py-2">
            <div className="w-full h-[1px] bg-slate-200 mx-2"></div>
          </div>

          <div className="space-y-1">
            {Object.entries(groupedItems).map(([group, items]) => {
              if (group === "ungrouped") return null;
              return items.map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as SidebarTab)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all relative group cursor-pointer ${
                    activeTab === item.id
                      ? "bg-slate-100 text-[#0A5ED6] font-semibold shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <item.icon className={`shrink-0 transition-colors ${activeTab === item.id ? 'w-[18px] h-[18px]' : 'w-[18px] h-[18px] group-hover:text-slate-800'}`} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.id === 'scanner' && (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wider">Test</span>
                  )}
                  {item.id === 'email' && (
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">3</span>
                  )}
                </button>
              ));
            })}
          </div>
        </nav>

        <div className="p-4 shrink-0 mt-auto border-t border-slate-200 relative bg-slate-50/50">
          <div className="flex items-center gap-3 p-2 -m-2 rounded-lg transition-colors">
            <div className="w-9 h-9 rounded-full bg-[#0A5ED6] flex items-center justify-center overflow-hidden shrink-0">
              <span className="text-sm font-bold text-white">DU</span>
            </div>
            <div className="flex flex-col min-w-0 flex-1 text-left">
              <span className="text-sm font-semibold text-slate-900 truncate">Demo User</span>
              <span className="text-[10px] text-slate-500 truncate uppercase tracking-wider font-medium">
                Admin • IT
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col ml-[260px] overflow-hidden bg-slate-50/80 min-w-0 min-h-0">
        {/* Top Header */}
        <header className="h-[72px] border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
          <div className="flex-1 flex items-center">
            <div className="relative w-full max-w-md hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search logs, threats, endpoints..."
                className="w-full bg-slate-100 border border-transparent rounded-full pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-[#0A5ED6] transition-colors"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-500 mr-2">
              System Status: <span className="flex items-center gap-1.5 text-slate-900"><span className="w-1.5 h-1.5 rounded-full bg-[#0A5ED6] animate-pulse shadow-[0_0_8px_#0A5ED6]"></span> Operational</span>
            </div>
            <div className="hidden sm:block h-5 w-px bg-slate-200 mx-1"></div>
            
            <div className="relative">
              <button 
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  setActivityOpen(false);
                  setSettingsOpen(false);
                }}
                className="text-slate-500 hover:text-slate-900 transition-colors relative flex items-center justify-center p-1.5 cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {metrics.threats > 0 && (
                  <span className="absolute 1 top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center">
                    {metrics.threats}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">Messages</span>
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                      {metrics.threats} New
                    </span>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    <div className="w-full p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors text-left flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-blue-50">
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">System Alert</p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">High severity threat blocked on endpoint.</p>
                        <p className="text-[10px] text-slate-400 mt-1">Just now</p>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0"></span>
                    </div>
                  </div>
                  <div className="p-2 border-t border-slate-100 flex gap-2">
                    <button onClick={() => setNotificationsOpen(false)} className="flex-1 py-1.5 text-xs text-center font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                      Mark all read
                    </button>
                    <button onClick={() => { setNotificationsOpen(false); setActiveTab('communication'); }} className="flex-1 py-1.5 text-xs text-center font-bold text-[#0A5ED6] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer">
                      Open Inbox
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="relative">
              <button 
                onClick={() => {
                  setActivityOpen(!activityOpen);
                  setNotificationsOpen(false);
                  setSettingsOpen(false);
                }}
                className="text-slate-500 hover:text-slate-900 transition-colors relative flex items-center justify-center p-1.5 cursor-pointer"
              >
                <Activity className="w-4 h-4" />
              </button>

              {activityOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <span className="text-sm font-semibold text-slate-900">System Performance</span>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600">AI Models</span>
                        <span className="text-emerald-500 font-medium">Optimal</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000 w-full bg-emerald-500"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600">Ingestion Pipelines</span>
                        <span className="text-emerald-500 font-medium">Operational</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000 w-full bg-emerald-500"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="h-5 w-px bg-slate-200 mx-1"></div>
            
            <div className="relative">
              <button 
                onClick={() => {
                  setSettingsOpen(!settingsOpen);
                  setNotificationsOpen(false);
                  setActivityOpen(false);
                }}
                className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>

              {settingsOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <div className="text-sm font-bold text-slate-900 truncate">Demo User</div>
                    <div className="text-[10px] text-slate-500 truncate uppercase tracking-wider font-medium mt-0.5">Admin • IT</div>
                    <div className="text-[10px] text-[#0A5ED6] font-medium truncate mt-1">admin@aegisone.com</div>
                  </div>
                  <div className="py-1">
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:text-[#0A5ED6] hover:bg-slate-50 transition-colors text-left cursor-not-allowed">
                      <Sun className="w-4 h-4" /> Light Mode (Demo)
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:text-[#0A5ED6] hover:bg-slate-50 transition-colors text-left cursor-not-allowed">
                      <Key className="w-4 h-4" /> Reset Password
                    </button>
                    <button onClick={() => { setSettingsOpen(false); setActiveTab('setup'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:text-[#0A5ED6] hover:bg-slate-50 transition-colors text-left cursor-pointer">
                      <UserCog className="w-4 h-4" /> Account Settings
                    </button>
                  </div>
                  <div className="h-px bg-slate-100 my-1"></div>
                  <div className="py-1">
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors text-left cursor-not-allowed">
                      <LogOut className="w-4 h-4" /> Logout (Demo)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar relative min-h-0">
          
          {liveAlert && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-rose-100 text-rose-600">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    Threat Blocked in Real-Time 
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px]">12ms response</span>
                  </div>
                  <div className="text-slate-600 text-xs mt-0.5 max-w-xl truncate">
                    <span className="font-semibold">{liveAlert.type}</span> detected in {liveAlert.dept} ({liveAlert.url}) — Isolated safely.
                  </div>
                </div>
              </div>
              <button onClick={() => setLiveAlert(null)} className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-500 transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* VIEW: ADMIN COMMAND */}
          {activeTab === 'admin' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Organization Admin Center</h1>
                  <p className="text-sm text-slate-500 mt-1">Security policies, threat feeds, and enterprise employee directory</p>
                </div>
                
                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    {[
                      { label: "24h", value: "24h" },
                      { label: "7d", value: "7d" },
                      { label: "30d", value: "30d" },
                      { label: "All Time", value: "all_time" }
                    ].map(item => (
                      <button
                        key={item.value}
                        onClick={() => setTimeRange(item.value as TimeRange)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          timeRange === item.value
                            ? "bg-[#0A5ED6] text-white shadow-sm"
                            : "text-slate-600 hover:text-slate-900 hover:bg-white"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleRefresh}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 shadow-sm transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#0A5ED6]' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Top Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: "Total Employees", value: metrics.employees, icon: Users, color: "text-blue-600" },
                  { label: "Active Devices", value: metrics.employees, icon: Activity, color: "text-emerald-600" },
                  { label: "Total Scans", value: metrics.scans, icon: BarChart3, color: "text-[#0A5ED6]" },
                  { label: "Threats Blocked", value: metrics.threats, icon: Shield, color: "text-rose-600" },
                  { label: "Open Incidents", value: metrics.incidents, icon: AlertTriangle, color: "text-amber-500" },
                ].map((s) => (
                  <div key={s.label} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col">
                    <s.icon className={`w-5 h-5 ${s.color} mb-3`} />
                    <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                    <div className="text-xs text-slate-500 mt-1 font-medium">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Department Analytics */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-900">
                      <Building2 className="w-4 h-4 text-[#0A5ED6]" /> Department Breakdown &amp; Threat Telemetry
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Click any department card to view full employee security analytics &amp; audit details</p>
                  </div>
                  <button className="text-xs text-[#0A5ED6] font-semibold flex items-center gap-1 hover:underline cursor-pointer">
                    View Full Analytics →
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departments.map((dept) => (
                    <div key={dept.id} className="p-4 rounded-xl bg-slate-50/50 border border-slate-200/80 hover:border-[#0A5ED6]/50 hover:shadow-md transition-all cursor-pointer block space-y-3 group">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900 group-hover:text-[#0A5ED6] transition-colors">{dept.name}</span>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 shrink-0 border border-blue-100">{dept.members} members</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate border-b border-slate-200/60 pb-2">
                        Lead: <span className="font-semibold text-slate-800">{dept.lead}</span>
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
                        <div className="p-2 rounded-lg bg-white border border-slate-200/60 shadow-xs">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Scans</div>
                          <div className="text-sm font-black text-slate-900 mt-0.5">{dept.scans}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-white border border-slate-200/60 shadow-xs">
                          <div className="text-[10px] text-rose-500 font-semibold uppercase">Threats</div>
                          <div className="text-sm font-black text-rose-600 mt-0.5">{dept.threats}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-white border border-slate-200/60 shadow-xs">
                          <div className="text-[10px] text-amber-500 font-semibold uppercase">Avg Risk</div>
                          <div className="text-sm font-black text-amber-600 mt-0.5">{dept.avgRisk}%</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-slate-900">
                    <TrendingUp className="w-4 h-4 text-[#0A5ED6]" /> Threat Trends ({timeRange})
                  </h3>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorSafe" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                          <linearGradient id="colorThreat" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Area type="monotone" dataKey="safe" stroke="#10b981" fillOpacity={1} fill="url(#colorSafe)" strokeWidth={2} name="Safe Scans" />
                        <Area type="monotone" dataKey="threats" stroke="#f43f5e" fillOpacity={1} fill="url(#colorThreat)" strokeWidth={2} name="Threats" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-slate-900">
                    <Building2 className="w-4 h-4 text-[#0A5ED6]" /> Top Threat Types
                  </h3>
                  <div className="flex-1 space-y-4 pt-2">
                    {[
                      { name: "Phishing URLs", count: 42 + threatCountBonus, percent: 54, color: "bg-rose-500" },
                      { name: "Suspicious Attachments", count: 21, percent: 27, color: "bg-amber-500" },
                      { name: "CEO Impersonation", count: 14, percent: 18, color: "bg-orange-500" },
                      { name: "Malware Payloads", count: 1, percent: 1, color: "bg-red-600" },
                    ].map((threat, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 font-medium">{threat.name}</span>
                          <span className="text-slate-900 font-bold">{threat.count} ({threat.percent}%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${threat.color}`} style={{ width: `${threat.percent}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Inference Engine Nodes */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-900">
                    <Activity className="w-4 h-4 text-[#0A5ED6]" /> AI Inference Engine Nodes
                  </h3>
                  <button className="text-xs text-[#0A5ED6] font-semibold hover:underline cursor-pointer">Details →</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { name: 'url', icon: Globe, online: true },
                    { name: 'text', icon: FileText, online: true },
                    { name: 'email', icon: Mail, online: true },
                    { name: 'image', icon: Image, online: false },
                    { name: 'attachment', icon: Cpu, online: true },
                  ].map((node) => (
                    <div key={node.name} className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-[#0A5ED6]/30 transition-all cursor-default">
                      <div className="flex items-center gap-2 mb-2">
                        <node.icon className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-semibold text-slate-800 uppercase">{node.name}</span>
                        <span className={`ml-auto w-2 h-2 rounded-full ${node.online ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" : "bg-rose-500"}`} />
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium mt-1">
                        Status: {node.online ? <span className="text-emerald-600 font-bold">Online</span> : <span className="text-rose-500 font-bold">Offline</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW: SCANNER */}
          {activeTab === 'scanner' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Live Threat Scanner</h1>
                <p className="text-sm text-slate-500 mt-1">Test the local inference engine against potential phishing links</p>
              </div>
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm max-w-3xl">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={scanInputUrl}
                    onChange={(e) => setScanInputUrl(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#0A5ED6]"
                    placeholder="Enter URL to scan..."
                  />
                  <button
                    onClick={handleRunUrlScan}
                    disabled={isScanningUrl || !scanInputUrl}
                    className="px-6 py-2.5 rounded-xl bg-[#0A5ED6] text-white font-bold text-sm shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    {isScanningUrl ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                    {isScanningUrl ? 'Scanning...' : 'Scan URL'}
                  </button>
                </div>
                {scanResult && (
                  <div className={`mt-6 p-5 rounded-xl border ${scanResult.status === 'safe' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} animate-in fade-in`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-2 rounded-lg ${scanResult.status === 'safe' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                        {scanResult.status === 'safe' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className={`font-bold ${scanResult.status === 'safe' ? 'text-emerald-900' : 'text-rose-900'}`}>{scanResult.verdict}</h4>
                        <p className={`text-xs ${scanResult.status === 'safe' ? 'text-emerald-700' : 'text-rose-700'}`}>Confidence Score: {scanResult.score}%</p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {scanResult.reasons.map((reason, i) => (
                        <li key={i} className={`text-sm flex items-start gap-2 ${scanResult.status === 'safe' ? 'text-emerald-800' : 'text-rose-800'}`}>
                          <Check className="w-4 h-4 mt-0.5 shrink-0 opacity-70" />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW: EMAIL */}
          {activeTab === 'email' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Email Security Quarantines</h1>
                  <p className="text-sm text-slate-500 mt-1">Intercepted malicious emails across the organization</p>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {[
                    { from: "IT Support <admin-verify@microsoft-sec.com>", sub: "Action Required: Password Expiry", threat: "Credential Harvesting", time: "10 mins ago" },
                    { from: "HR Dept <benefits@aegisone-hr.org>", sub: "Updated Q3 Benefits Package.pdf", threat: "Malware Attachment", time: "1 hour ago" },
                    { from: "CEO <ceo@aegisone-executive.com>", sub: "Urgent Wire Transfer Approval", threat: "Executive Impersonation", time: "3 hours ago" },
                  ].map((email, i) => (
                    <div key={i} className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                          <Mail className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{email.sub}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">From: {email.from}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-bold uppercase">{email.threat}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold text-slate-500">{email.time}</div>
                        <button className="mt-2 text-xs font-bold text-[#0A5ED6] hover:underline cursor-pointer">Inspect</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW: DEPARTMENTS */}
          {activeTab === 'departments' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Departments & Users</h1>
                  <p className="text-sm text-slate-500 mt-1">Manage workforce protection policies and user risk scores</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map((dept) => (
                  <div key={dept.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900">{dept.name}</h3>
                      <span className="px-2 py-1 rounded bg-blue-50 text-[#0A5ED6] text-xs font-bold">{dept.members} Users</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Department Lead</span>
                        <span className="font-semibold text-slate-900">{dept.lead}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Avg Risk Score</span>
                        <span className="font-semibold text-amber-600">{dept.avgRisk}%</span>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                      <button className="w-full py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
                        View Users
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: INCIDENTS */}
          {activeTab === 'incidents' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Security Incidents</h1>
                <p className="text-sm text-slate-500 mt-1">Review and manage isolated threats across endpoints</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Incident Type</th>
                      <th className="py-3 px-4 font-semibold">Department</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {liveAlert && (
                      <tr className="bg-rose-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-900">{liveAlert.type}</td>
                        <td className="py-3 px-4 text-slate-600">{liveAlert.dept}</td>
                        <td className="py-3 px-4"><span className="px-2 py-1 rounded bg-rose-100 text-rose-700 text-xs font-bold">Isolated</span></td>
                        <td className="py-3 px-4 text-slate-500">{liveAlert.time}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-3 px-4 font-semibold text-slate-900">Suspicious Login Attempt</td>
                      <td className="py-3 px-4 text-slate-600">DevOps</td>
                      <td className="py-3 px-4"><span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-bold">Resolved</span></td>
                      <td className="py-3 px-4 text-slate-500">2 hours ago</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-slate-900">Malware Attachment Blocked</td>
                      <td className="py-3 px-4 text-slate-600">Web Development</td>
                      <td className="py-3 px-4"><span className="px-2 py-1 rounded bg-rose-100 text-rose-700 text-xs font-bold">Isolated</span></td>
                      <td className="py-3 px-4 text-slate-500">Yesterday</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
                    <BarChart3 className="w-6 h-6 text-[#0A5ED6]" /> Enterprise Analytics
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">Real-time security telemetry and department risk matrix</p>
                </div>
              </div>

              {/* Top Telemetry KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">Total Scans Executed</span>
                    <Globe className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">14,208</p>
                  <p className="text-[11px] text-emerald-500 mt-1 font-medium">Live Telemetry Active</p>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">Threats Neutralized</span>
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">89</p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">AI Decision Engine</p>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">Active Departments</span>
                    <Building2 className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{departments.length}</p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">Monitored Segments</p>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">Protected Employees</span>
                    <Users className="w-4 h-4 text-purple-500" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">156</p>
                  <p className="text-[11px] text-purple-400 mt-1 font-medium">Active Credentials</p>
                </div>
              </div>

              {/* Analytics Charts Row */}
              <div className="grid lg:grid-cols-2 gap-5">
                <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-slate-900">
                    <TrendingUp className="w-4 h-4 text-[#0A5ED6]" /> Organization Scan Velocity
                  </h3>
                  <ResponsiveContainer width="100%" height={230}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorPhishing" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                        <linearGradient id="colorSafe" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                      <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                      <Area type="monotone" dataKey="phishing" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorPhishing)" />
                      <Area type="monotone" dataKey="safe" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSafe)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-slate-900">
                    <BarChart3 className="w-4 h-4 text-[#0A5ED6]" /> Department Scans & Threats
                  </h3>
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={[
                      { name: "IT", scans: 1400, threats: 45 },
                      { name: "DevOps", scans: 2100, threats: 12 },
                      { name: "Web", scans: 800, threats: 3 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                      <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="scans" fill="#3b82f6" name="Total Scans" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="threats" fill="#ef4444" name="Threats Neutralized" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Selected Department Employee Telemetry Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">Employee Telemetry</h3>
                  <div className="relative w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input type="text" placeholder="Search employee..." className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#0A5ED6]" />
                  </div>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Employee</th>
                      <th className="py-3 px-4 font-semibold">Role</th>
                      <th className="py-3 px-4 font-semibold text-center">Total Scans</th>
                      <th className="py-3 px-4 font-semibold text-center">Threats Detected</th>
                      <th className="py-3 px-4 font-semibold text-center">Security Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { name: "Ahmed Raza", email: "ahmed@aegisone.com", role: "admin", scans: 840, threats: 3, risk: 12 },
                      { name: "Muhid Khan", email: "muhid@aegisone.com", role: "manager", scans: 1120, threats: 1, risk: 8 },
                      { name: "Ali Bin", email: "ali@aegisone.com", role: "manager", scans: 500, threats: 0, risk: 0 },
                      { name: "John Doe", email: "john@aegisone.com", role: "employee", scans: 156, threats: 12, risk: 45 }
                    ].map((u, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-[#0A5ED6] font-bold flex items-center justify-center shrink-0">
                              {u.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{u.name}</p>
                              <p className="text-[11px] text-slate-500">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'manager' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-[#0A5ED6]'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-900">{u.scans}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-bold ${u.threats > 0 ? "text-rose-500" : "text-emerald-500"}`}>{u.threats}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${u.risk >= 40 ? "bg-rose-100 text-rose-700" : u.risk >= 10 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {u.risk}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: COMMUNICATION */}
          {activeTab === 'communication' && (
            <div className="animate-in fade-in duration-300 h-[calc(100vh-12rem)] min-h-[600px] flex gap-6">
              {/* Sidebar */}
              <div className="w-80 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden shrink-0">
                <div className="p-4 border-b border-slate-100">
                  <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                    <MessageSquare className="w-5 h-5 text-[#0A5ED6]" /> Secure Messages
                  </h2>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input type="text" placeholder="Search contacts..." className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#0A5ED6]" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {[
                    { name: "Ahmed Raza", role: "Admin", active: true, time: "Now", msg: "Please check the latest scan results." },
                    { name: "Muhid Khan", role: "Manager", active: false, time: "10m", msg: "I've reviewed the incident report." },
                    { name: "System Alerts", role: "Bot", active: false, time: "1h", msg: "Automated scan completed." }
                  ].map((contact, i) => (
                    <div key={i} className={`p-4 border-b border-slate-50 cursor-pointer transition-colors ${i === 0 ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-[#0A5ED6] font-bold flex items-center justify-center shrink-0">
                            {contact.name.charAt(0)}
                          </div>
                          {contact.active && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="font-bold text-sm text-slate-900 truncate">{contact.name}</span>
                            <span className="text-[10px] text-slate-400 shrink-0">{contact.time}</span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">{contact.msg}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-[#0A5ED6] font-bold flex items-center justify-center">A</div>
                    <div>
                      <h3 className="font-bold text-slate-900">Ahmed Raza</h3>
                      <p className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online • Admin
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"><Phone className="w-5 h-5" /></button>
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"><Video className="w-5 h-5" /></button>
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"><MoreVertical className="w-5 h-5" /></button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                  <div className="flex flex-col items-center mb-6">
                    <span className="text-xs font-medium text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100">Today</span>
                  </div>

                  <div className="flex gap-3 max-w-[80%]">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-[#0A5ED6] font-bold flex items-center justify-center shrink-0 text-xs">A</div>
                    <div>
                      <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm text-sm text-slate-700">
                        Hey, did you see the new threat alert from the HR department?
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">10:42 AM</span>
                    </div>
                  </div>

                  <div className="flex gap-3 max-w-[80%] ml-auto flex-row-reverse">
                    <div className="w-8 h-8 rounded-full bg-[#0A5ED6] text-white font-bold flex items-center justify-center shrink-0 text-xs">Y</div>
                    <div>
                      <div className="bg-[#0A5ED6] text-white p-3 rounded-2xl rounded-tr-none shadow-sm text-sm">
                        Yes, I'm looking into it right now. The AI scanner automatically quarantined the suspicious attachments.
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block text-right">10:45 AM</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 max-w-[80%]">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-[#0A5ED6] font-bold flex items-center justify-center shrink-0 text-xs">A</div>
                    <div>
                      <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm text-sm text-slate-700">
                        Excellent. Please check the latest scan results to make sure nothing else was compromised.
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">10:46 AM</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-white">
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"><Paperclip className="w-5 h-5" /></button>
                    <input type="text" placeholder="Type a secure message..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#0A5ED6]" />
                    <button className="p-2.5 bg-[#0A5ED6] text-white hover:bg-blue-600 rounded-xl transition-colors shadow-sm"><Send className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: EXTENSION */}
          {activeTab === 'extension' && (
            <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto mt-8">
              <div className="text-center mb-10">
                <div className="w-20 h-20 mx-auto bg-blue-50 rounded-full flex items-center justify-center mb-4 border-4 border-blue-50/50">
                  <Puzzle className="w-10 h-10 text-[#0A5ED6]" />
                </div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <User className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Manager Personal Device</span>
                </div>
                <h1 className="text-3xl font-bold text-slate-900">Browser Protection Status</h1>
                <p className="text-slate-500 mt-2 text-base">
                  Your workspace is secured by AegisOne. Manager-level threats are tracked separately and also reflected in organizational analytics.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-2xl">
                  <ShieldCheck className="w-8 h-8 text-emerald-500 mb-3" />
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Extension State</div>
                  <div className="text-xl font-bold text-slate-900">Online</div>
                </div>

                <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-2xl">
                  <Globe className="w-8 h-8 text-blue-500 mb-3" />
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Protection Level</div>
                  <div className="text-xl font-bold text-slate-900">Enabled</div>
                </div>

                <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-2xl">
                  <Activity className="w-8 h-8 text-amber-500 mb-3" />
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">AI Pipeline</div>
                  <div className="text-xl font-bold text-slate-900">Connected</div>
                </div>

                <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-2xl">
                  <Database className="w-8 h-8 text-purple-500 mb-3" />
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Local Database</div>
                  <div className="text-xl font-bold text-slate-900">Synced</div>
                </div>

                <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-2xl col-span-2 md:col-span-2">
                  <RefreshCw className="w-8 h-8 text-blue-500 mb-3" />
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Last Telemetry Sync</div>
                  <div className="text-xl font-bold text-slate-900">Just now</div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 md:p-8 mt-8">
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                    <div className="p-2.5 bg-blue-100 rounded-lg text-[#0A5ED6]">
                      <Puzzle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">AegisOne Extension Setup</h3>
                      <p className="text-sm text-slate-500">Install the extension to protect your browser and contribute to organizational threat intelligence.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                      { step: 1, title: "Download Package", desc: "Click the download button below to save the AegisOne extension bundle (.zip) to your computer." },
                      { step: 2, title: "Extract ZIP File", desc: "Find the downloaded ZIP in your downloads folder. Right-click and select \"Extract All...\" to a dedicated folder." },
                      { step: 3, title: "Open Extension Settings", desc: <>Open a new tab and paste <strong className="text-blue-600 font-mono text-[11px] bg-white px-1 rounded">chrome://extensions</strong> into your browser address bar.</> },
                      { step: 4, title: "Load Unpacked", desc: <>Enable <strong>\"Developer Mode\"</strong> in the top-right. Click <strong>\"Load unpacked\"</strong> and select the extracted folder.</> },
                    ].map(({ step, title, desc }) => (
                      <div key={step} className="flex flex-col bg-white border border-slate-200 p-5 rounded-xl space-y-3">
                        <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#0A5ED6] text-white font-bold text-xs shrink-0">{step}</div>
                        <h4 className="font-bold text-sm text-slate-900">{title}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 flex flex-wrap gap-4 border-t border-slate-200 mt-2">
                    <button className="inline-flex items-center gap-2 bg-[#0A5ED6] hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors shadow-md">
                      <Download className="w-4 h-4" /> Download Extension ZIP
                    </button>
                    <button className="inline-flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors">
                      Open Extension Settings <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: AUDIT */}
          {activeTab === 'audit' && (
            <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
                    <ClipboardList className="w-6 h-6 text-[#0A5ED6]" /> System Audit Trail
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Immutable operational and administrative activity logs for your organization.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter logs by actor, action..."
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0A5ED6]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Live</span>
                  </div>
                  <button className="p-2 bg-slate-50 text-slate-700 rounded-xl hover:bg-slate-100 transition-colors shrink-0 border border-slate-200">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Audit Logs Table */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider bg-slate-50/50">
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Actor</th>
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Module</th>
                        <th className="py-3 px-4">Target</th>
                        <th className="py-3 px-4 text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { timestamp: "2026-09-15 10:45:12", actor: "Ahmed Raza", action: "policy.updated", module: "Security", target: "Global Default", result: "success", color: "bg-blue-100 text-blue-700" },
                        { timestamp: "2026-09-15 10:42:05", actor: "System", action: "incident.assigned", module: "Threats", target: "INC-2041", result: "success", color: "bg-amber-100 text-amber-700" },
                        { timestamp: "2026-09-15 10:15:30", actor: "Muhid Khan", action: "user.role_changed", module: "IAM", target: "john@aegisone.com", result: "success", color: "bg-purple-100 text-purple-700" },
                        { timestamp: "2026-09-15 09:30:00", actor: "System", action: "user.deactivated", module: "IAM", target: "old_employee@aegisone.com", result: "success", color: "bg-rose-100 text-rose-700" },
                        { timestamp: "2026-09-15 08:00:12", actor: "Admin", action: "user.created", module: "IAM", target: "new_hire@aegisone.com", result: "success", color: "bg-emerald-100 text-emerald-700" }
                      ].map((l, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-500">{l.timestamp}</td>
                          <td className="py-3 px-4 font-medium text-slate-900">{l.actor}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] ${l.color}`}>
                              {l.action}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{l.module}</td>
                          <td className="py-3 px-4 font-medium text-slate-800">{l.target}</td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 capitalize">
                              {l.result}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: SETUP */}
          {activeTab === 'setup' && (
            <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
              <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-100">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Settings className="w-6 h-6 text-[#0A5ED6]" /> Organization Setup
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">Configure your company structure, departments, and security policies.</p>
                </div>
                <button className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  Locked for Demo
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Organization Setup Engine</h3>
                    <p className="text-xs text-slate-500">Step 1 of 5 — Completed (100%)</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { num: 1, title: 'Organization' },
                      { num: 2, title: 'Structure' },
                      { num: 3, title: 'Validation' },
                      { num: 4, title: 'Security' },
                      { num: 5, title: 'Rollout' }
                    ].map((s) => (
                      <div key={s.num} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${s.num === 1 ? 'bg-[#0A5ED6] text-white' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                        {s.num === 1 ? <span>{s.num}.</span> : <Check className="w-3.5 h-3.5" />}
                        <span>{s.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#0A5ED6] h-full rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 mb-1">Organization Profile & Environment</h2>
                  <p className="text-slate-500 text-xs">Verify your company profile and deployment environment parameters.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Organization</p>
                      <p className="text-sm font-extrabold text-slate-900">AegisOne Demo</p>
                      <span className="text-[11px] font-medium text-blue-600">Cybersecurity</span>
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deployment Engine</p>
                      <p className="text-sm font-extrabold text-emerald-700">Docker Isolated</p>
                      <span className="text-[11px] font-medium text-emerald-600">v2.4.0 • Enterprise Edition</span>
                    </div>
                  </div>

                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admin Account</p>
                      <p className="text-xs font-bold text-slate-900 truncate">admin@aegisone.com</p>
                      <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1 mt-0.5"><CheckCircle2 className="w-3 h-3" /> Credentials Provisioned</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-[#0A5ED6]" /> Company Identity Details
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">These parameters establish your organization's tenant configuration.</p>
                    </div>
                    <span className="text-[11px] font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                      Active Tenant
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Organization Name</label>
                      <input disabled value="AegisOne Demo" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-semibold cursor-not-allowed" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Industry / Sector</label>
                      <input disabled value="Cybersecurity" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-semibold cursor-not-allowed" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Primary Timezone</label>
                      <input disabled value="UTC+00:00 (GMT - Universal Time)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-semibold cursor-not-allowed" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Default Security Policy</label>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs font-semibold text-slate-900">
                        <span className="text-emerald-600 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Strict Real-time Scanning
                        </span>
                        <span className="text-slate-400 text-[11px]">Standard Policy</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );

  return (
    <div id="demo" className="w-full relative scroll-mt-24">
      {/* Top Banner & Display Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 px-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
            LIVE DASHBOARD SYNC
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer">
            <Monitor className="w-3.5 h-3.5 text-[#0A5ED6]" /> <span className="hidden sm:inline">Fullscreen Modal</span>
          </button>
          <button onClick={handleSimulateAttack} className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> <span>Trigger Alert</span>
          </button>
          <a href="/login" className="px-4 py-2 rounded-xl bg-[#0A5ED6] hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5">
            <span>Open App</span> <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="relative w-full">
        <div className="relative rounded-3xl border border-slate-200/90 bg-white shadow-[0_25px_70px_-15px_rgba(10,94,214,0.12)] overflow-hidden ring-4 ring-slate-100">
          {renderDashboardUI()}
        </div>
      </div>

      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999] bg-white flex flex-col animate-in fade-in duration-200 w-screen h-screen overflow-hidden">
          {/* Top Bar for Modal */}
          <div className="px-6 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-[#0A5ED6]" />
              <span className="font-bold text-sm text-white">AegisOne Unified Shield — Live Interactive Sandbox</span>
            </div>
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-bold flex items-center gap-2">
              <X className="w-4 h-4" /> Close Fullscreen
            </button>
          </div>
          {/* Dashboard Container - stretches to fill remaining height */}
          <div className="flex-1 w-full overflow-hidden bg-white flex flex-col min-h-0">
            {renderDashboardUI()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
