import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, ShieldAlert, Cpu, Globe, Server, Activity, Users, Zap, 
  Terminal, Play, RotateCcw, Search, CheckCircle2, AlertTriangle, 
  Settings, Layers, Database, ArrowRight, Lock, Key, Copy, Share2,
  LogOut, Plus, Trash2, UserCheck, Shield, HelpCircle, LayoutDashboard,
  BarChart3, FileText, Puzzle, Download, RefreshCw, Sliders, Building2,
  AlertCircle, Laptop, ArrowRightLeft, Check, FileCheck, HelpCircle as HelpIcon,
  BookOpen, Network, CheckSquare, Square, MessageSquare, Mail
} from 'lucide-react';
import { 
  ThreatLog, 
  UserSession, 
  Employee, 
  Department, 
  OrganizationChecklist 
} from '../types';
import { 
  getEmployees, 
  addEmployee, 
  removeEmployee,
  getDepartments,
  addDepartment,
  getOrganization,
  updateOrganizationChecklist,
  updateEmployeeProfile
} from '../lib/firebase';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';

interface DashboardProps {
  session: UserSession;
  onLogOut: () => void;
}

export default function Dashboard({ session, onLogOut }: DashboardProps) {
  // Fetch dynamic database states
  const org = getOrganization(session.orgId);
  const orgCode = org ? org.orgCode : 'AEG-9021';
  
  // Tab control based on checklists & roles
  const [activeTab, setActiveTab] = useState<
    | 'wizard'
    | 'dashboard'
    | 'threats'
    | 'users'
    | 'departments'
    | 'analytics'
    | 'reports'
    | 'extensions'
    | 'settings'
    | 'help'
  >(() => {
    if (session.role === 'employee') return 'wizard'; // Employees have specialized journey
    if (org && org.checklist) {
      // If setup isn't complete, welcome them with Setup Wizard first
      const completedCount = Object.values(org.checklist).filter(Boolean).length;
      if (completedCount < 8) {
        return 'wizard';
      }
    }
    return 'dashboard';
  });

  // Checklist local states
  const [checklist, setChecklist] = useState<OrganizationChecklist>(() => {
    return org && org.checklist ? org.checklist : {
      serverInstalled: true,
      orgConfigured: false,
      departmentsCreated: false,
      managersAdded: false,
      employeesAdded: false,
      extensionInstalled: false,
      connectionVerified: false,
      protectionStarted: false,
    };
  });

  // Setup Wizard fields
  const [wizardOrgName, setWizardOrgName] = useState(org ? org.name : session.orgName);
  const [wizardDomain, setWizardDomain] = useState('internal-network.lan');
  const [wizardPolicy, setWizardPolicy] = useState<'aggressive' | 'moderate'>('moderate');
  const [wizardDeptName, setWizardDeptName] = useState('');
  
  const [wizardLeadName, setWizardLeadName] = useState('');
  const [wizardLeadEmail, setWizardLeadEmail] = useState('');
  const [wizardLeadEmpId, setWizardLeadEmpId] = useState('');
  
  const [wizardEmpName, setWizardEmpName] = useState('');
  const [wizardEmpEmail, setWizardEmpEmail] = useState('');
  const [wizardEmpId, setWizardEmpId] = useState('');

  const [isVerifyingConnection, setIsVerifyingConnection] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  // General Portal states
  const [departments, setDepartments] = useState<Department[]>(getDepartments(session.orgId));
  const [employees, setEmployees] = useState<Employee[]>(getEmployees(session.orgId));
  const [newDeptName, setNewDeptName] = useState('');
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpId, setNewEmpId] = useState('');
  const [newEmpDept, setNewEmpDept] = useState('');
  const [newEmpRole, setNewEmpRole] = useState<'lead' | 'employee'>('employee');
  const [addSuccessMsg, setAddSuccessMsg] = useState<string | null>(null);
  const [staffSearch, setStaffSearch] = useState('');

  // Sandbox Threat Simulator states
  const [urlInput, setUrlInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    status: 'CLEAN' | 'BLOCKED' | 'WARN' | null;
    score: number;
    latency: number;
    reasons: string[];
  } | null>(null);

  // Live simulation log states
  const [autoSimulate, setAutoSimulate] = useState(checklist.protectionStarted);
  const [threatLogs, setThreatLogs] = useState<ThreatLog[]>([
    {
      id: '1',
      timestamp: new Date(Date.now() - 5000).toLocaleTimeString(),
      url: 'http://irs-tax-refund-portal.secure-update-irs.com/refund',
      status: 'BLOCKED',
      type: 'Phishing Brand Impersonation',
      sourceIp: '192.168.1.104',
      latencyMs: 1.4,
      threatScore: 98,
      employeeName: 'Aisha Jamil',
      employeeId: 'EMP-LOG-4092',
      department: 'Logistics Operations'
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 15000).toLocaleTimeString(),
      url: 'https://login-appleid.icloud-recovery-service.net/verify',
      status: 'BLOCKED',
      type: 'Credential Harvesting',
      sourceIp: '192.168.1.189',
      latencyMs: 0.9,
      threatScore: 99,
      employeeName: 'Zainab Bibi',
      employeeId: 'EMP-TEX-2003',
      department: 'Spinning Division'
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 30000).toLocaleTimeString(),
      url: 'https://google.com',
      status: 'ALLOWED',
      type: 'Search Engine',
      sourceIp: '192.168.1.102',
      latencyMs: 0.4,
      threatScore: 0,
      employeeName: 'Haris Munir',
      employeeId: 'EMP-LOG-4091',
      department: 'Logistics Operations'
    }
  ]);

  const [stats, setStats] = useState({
    totalScanned: 2489,
    totalBlocked: 54,
    avgLatency: 1.15,
    bytesLeaked: 0
  });

  const logContainerRef = useRef<HTMLDivElement>(null);

  // Extension management controls
  const [extForceUpdate, setExtForceUpdate] = useState(false);
  const [extBlockUntrusted, setExtBlockUntrusted] = useState(true);
  const [extHealthCheck, setExtHealthCheck] = useState('Healthy');

  // Employee journey wizard states
  const [empProfileName, setEmpProfileName] = useState(session.name);
  const [empProfileDept, setEmpProfileDept] = useState('');
  const [empProfileSaved, setEmpProfileSaved] = useState(session.profileCompleted || false);
  const [empExtDownloaded, setEmpExtDownloaded] = useState(false);
  const [empExtInstalled, setEmpExtInstalled] = useState(session.extensionInstalled || false);
  const [empOrgCodeChallenger, setEmpOrgCodeChallenger] = useState('');
  const [empOrgCodeVerified, setEmpOrgCodeVerified] = useState(false);
  const [empDeviceLogs, setEmpDeviceLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] Local Agent Daemon started successfully.`,
    `[${new Date().toLocaleTimeString()}] Looking up active Gateway interface...`
  ]);

  // Update dynamic lists
  const refreshDirectory = () => {
    setEmployees(getEmployees(session.orgId));
    setDepartments(getDepartments(session.orgId));
    const freshOrg = getOrganization(session.orgId);
    if (freshOrg && freshOrg.checklist) {
      setChecklist(freshOrg.checklist);
    }
  };

  // Live browser telemetry simulator for Employees
  useEffect(() => {
    if (session.role !== 'employee' || !empOrgCodeVerified) return;

    const employeeUrls = [
      'https://linkedin.com/feed',
      'http://scam-security-update-chasebank.cn/login',
      'https://gmail.com',
      'https://internal-wiki.local/docs',
      'http://secure-update-outlook-login.com/redirect',
      'https://github.com'
    ];

    const interval = setInterval(() => {
      const selectedUrl = employeeUrls[Math.floor(Math.random() * employeeUrls.length)];
      const isPhish = selectedUrl.includes('scam') || selectedUrl.includes('outlook-login');
      const timeStr = new Date().toLocaleTimeString();

      if (isPhish) {
        setEmpDeviceLogs(prev => [
          `[${timeStr}] ⚠️ CRITICAL SHIELD: Blocked access request to malicious domain: ${selectedUrl}`,
          `[${timeStr}] Safe page redirected. Isolated attack signature locally.`,
          ...prev.slice(0, 10)
        ]);
        // Also push to central admin logs to simulate full network sync
        const newLog: ThreatLog = {
          id: Math.random().toString(),
          timestamp: timeStr,
          url: selectedUrl,
          status: 'BLOCKED',
          type: 'Employee Extension Shield',
          sourceIp: '127.0.0.1',
          latencyMs: 1.1,
          threatScore: 96,
          employeeName: session.name,
          employeeId: session.employeeId || 'EMP-LIVE-TEST',
          department: departments.find(d => d.id === session.departmentId)?.name || 'Standard Staff'
        };
        setThreatLogs(prev => [newLog, ...prev]);
        setStats(prev => ({
          ...prev,
          totalScanned: prev.totalScanned + 1,
          totalBlocked: prev.totalBlocked + 1
        }));
      } else {
        setEmpDeviceLogs(prev => [
          `[${timeStr}] Checked secure link successfully: ${selectedUrl}`,
          ...prev.slice(0, 10)
        ]);
        const newLog: ThreatLog = {
          id: Math.random().toString(),
          timestamp: timeStr,
          url: selectedUrl,
          status: 'ALLOWED',
          type: 'Secure Safe-Filter',
          sourceIp: '127.0.0.1',
          latencyMs: 0.5,
          threatScore: 0,
          employeeName: session.name,
          employeeId: session.employeeId || 'EMP-LIVE-TEST',
          department: departments.find(d => d.id === session.departmentId)?.name || 'Standard Staff'
        };
        setThreatLogs(prev => [newLog, ...prev]);
        setStats(prev => ({
          ...prev,
          totalScanned: prev.totalScanned + 1
        }));
      }
    }, 5500);

    return () => clearInterval(interval);
  }, [session.role, empOrgCodeVerified]);

  // Traffic simulation loop for Admins/Managers
  useEffect(() => {
    if (!autoSimulate) return;

    const mockUrls = [
      { url: 'https://slack.com', status: 'ALLOWED', type: 'Collaborative Workspace', score: 0 },
      { url: 'https://chase-bank-logon.routing-auth-portal-secure.com/signin', status: 'BLOCKED', type: 'Financial Phishing', score: 97 },
      { url: 'https://wikipedia.org/wiki/Phishing', status: 'ALLOWED', type: 'Educational Site', score: 0 },
      { url: 'http://office365-login-verify.service-auth-azure.net/oauth', status: 'BLOCKED', type: 'Credential Harvesting', score: 94 },
      { url: 'https://amazon.com', status: 'ALLOWED', type: 'E-Commerce', score: 1 },
      { url: 'http://account-recovery-netflix.billing-update.com/reactivate', status: 'BLOCKED', type: 'Billing Scam', score: 89 },
    ];

    const interval = setInterval(() => {
      const selected = mockUrls[Math.floor(Math.random() * mockUrls.length)];
      const latency = parseFloat((0.4 + Math.random() * 1.5).toFixed(2));
      const isBlocked = selected.status === 'BLOCKED';
      const randomEmployee = employees[Math.floor(Math.random() * employees.length)] || {
        name: 'Aisha Jamil',
        employeeId: 'EMP-LOG-4092'
      };
      
      const matchedDept = departments.find(d => d.id === randomEmployee.departmentId)?.name || 'Operations';

      const newLog: ThreatLog = {
        id: Math.random().toString(),
        timestamp: new Date().toLocaleTimeString(),
        url: selected.url,
        status: selected.status as 'BLOCKED' | 'ALLOWED',
        type: selected.type,
        sourceIp: `192.168.1.${Math.floor(100 + Math.random() * 100)}`,
        latencyMs: latency,
        threatScore: selected.score,
        employeeName: randomEmployee.name,
        employeeId: randomEmployee.employeeId,
        department: matchedDept
      };

      setThreatLogs(prev => [newLog, ...prev.slice(0, 19)]);
      setStats(prev => ({
        totalScanned: prev.totalScanned + 1,
        totalBlocked: isBlocked ? prev.totalBlocked + 1 : prev.totalBlocked,
        avgLatency: parseFloat(((prev.avgLatency * 49 + latency) / 50).toFixed(2)),
        bytesLeaked: 0
      }));
    }, 4500);

    return () => clearInterval(interval);
  }, [autoSimulate, employees, departments]);

  // Checklist configuration hand-offs
  const markChecklistStep = (stepKey: keyof OrganizationChecklist, isDone: boolean) => {
    updateOrganizationChecklist(session.orgId, { [stepKey]: isDone });
    setChecklist(prev => ({ ...prev, [stepKey]: isDone }));
    refreshDirectory();
  };

  const handleSaveWizardOrg = (e: React.FormEvent) => {
    e.preventDefault();
    markChecklistStep('orgConfigured', true);
  };

  const handleCreateWizardDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wizardDeptName) return;
    addDepartment(wizardDeptName, session.orgId);
    setWizardDeptName('');
    markChecklistStep('departmentsCreated', true);
    refreshDirectory();
  };

  const handleAddWizardLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wizardLeadName || !wizardLeadEmail || !wizardLeadEmpId) return;
    addEmployee(wizardLeadName, wizardLeadEmail, wizardLeadEmpId, 'lead', session.orgId, session.name);
    setWizardLeadName('');
    setWizardLeadEmail('');
    setWizardLeadEmpId('');
    markChecklistStep('managersAdded', true);
    refreshDirectory();
  };

  const handleAddWizardEmp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wizardEmpName || !wizardEmpEmail || !wizardEmpId) return;
    addEmployee(wizardEmpName, wizardEmpEmail, wizardEmpId, 'employee', session.orgId, session.name);
    setWizardEmpName('');
    setWizardEmpEmail('');
    setWizardEmpId('');
    markChecklistStep('employeesAdded', true);
    refreshDirectory();
  };

  const handleVerifyWizardConnection = () => {
    setIsVerifyingConnection(true);
    setTimeout(() => {
      setIsVerifyingConnection(false);
      setVerificationSuccess(true);
      markChecklistStep('connectionVerified', true);
    }, 1800);
  };

  // Standard interactive directory creation forms
  const handleAddEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName || !newEmpEmail || !newEmpId) return;

    const added = addEmployee(
      newEmpName,
      newEmpEmail,
      newEmpId,
      newEmpRole,
      session.orgId,
      session.name,
      newEmpDept || undefined
    );

    setNewEmpName('');
    setNewEmpEmail('');
    setNewEmpId('');
    setNewEmpDept('');
    setAddSuccessMsg(`Successfully registered ${added.name} with unique ID ${added.employeeId}.`);
    setTimeout(() => setAddSuccessMsg(null), 4000);
    refreshDirectory();
  };

  const handleCreateDeptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    addDepartment(newDeptName.trim(), session.orgId);
    setNewDeptName('');
    refreshDirectory();
  };

  // Sandbox scanner
  const handleUrlAnalysis = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);

    setTimeout(() => {
      const lowerUrl = urlInput.toLowerCase();
      let status: 'CLEAN' | 'BLOCKED' | 'WARN' = 'CLEAN';
      let score = 0;
      let reasons: string[] = [];

      if (lowerUrl.includes('login') || lowerUrl.includes('verify') || lowerUrl.includes('secure') || lowerUrl.includes('recovery') || lowerUrl.includes('signin')) {
        if (!lowerUrl.includes('google.com') && !lowerUrl.includes('microsoft.com') && !lowerUrl.includes('github.com')) {
          status = 'BLOCKED';
          score = Math.floor(85 + Math.random() * 14);
          reasons.push('High-risk keywords inside non-whitelisted domain');
        }
      }

      if (lowerUrl.includes('tax') || lowerUrl.includes('irs') || lowerUrl.includes('bank') || lowerUrl.includes('paypal')) {
        status = 'BLOCKED';
        score = Math.floor(90 + Math.random() * 9);
        reasons.push('Deceptive corporate brand impersonation heuristics');
      }

      if (status === 'CLEAN') {
        score = Math.floor(Math.random() * 5);
        reasons.push('Domain matches secure local whitelist');
        reasons.push('Valid SSL certificate and routing footprint');
      }

      const latency = parseFloat((0.3 + Math.random() * 1.1).toFixed(2));

      setAnalysisResult({
        status,
        score,
        latency,
        reasons
      });
      setIsAnalyzing(false);

      const newLog: ThreatLog = {
        id: Math.random().toString(),
        timestamp: new Date().toLocaleTimeString(),
        url: urlInput,
        status: status === 'CLEAN' ? 'ALLOWED' : 'BLOCKED',
        type: status === 'CLEAN' ? 'Whitelisted Domain' : 'Manual Sandbox Evaluation',
        sourceIp: '192.168.1.254',
        latencyMs: latency,
        threatScore: score,
        employeeName: session.name,
        employeeId: session.employeeId || 'ADMIN-CLI-01',
        department: 'Corporate Admin Group'
      };

      setThreatLogs(prev => [newLog, ...prev]);
      setStats(prev => ({
        totalScanned: prev.totalScanned + 1,
        totalBlocked: status !== 'CLEAN' ? prev.totalBlocked + 1 : prev.totalBlocked,
        avgLatency: parseFloat(((prev.avgLatency * 49 + latency) / 50).toFixed(2)),
        bytesLeaked: 0
      }));
    }, 1000);
  };

  const clearLogs = () => {
    setThreatLogs([]);
    setStats({
      totalScanned: 0,
      totalBlocked: 0,
      avgLatency: 0,
      bytesLeaked: 0
    });
  };

  // Recharts fake stats data for analytics
  const analyticsTimeData = [
    { name: '08:00', safe: 420, threats: 2 },
    { name: '10:00', safe: 580, threats: 15 },
    { name: '12:00', safe: 890, threats: 24 },
    { name: '14:00', safe: 710, threats: 11 },
    { name: '16:00', safe: 620, threats: 4 },
    { name: '18:00', safe: 310, threats: 1 },
  ];

  const analyticsCategoryData = [
    { name: 'Credential Harvesting', value: 24, fill: '#0A5ED6' },
    { name: 'Financial Phishing', value: 18, fill: '#ef4444' },
    { name: 'Corporate Mimicry', value: 8, fill: '#f59e0b' },
    { name: 'Malware Scams', value: 4, fill: '#10b981' },
  ];

  // Employee Profile Handlers
  const handleEmployeeProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empProfileName || !empProfileDept) return;
    updateEmployeeProfile(session.uid, {
      name: empProfileName,
      departmentId: empProfileDept,
      profileCompleted: true
    });
    setEmpProfileSaved(true);
    setEmpDeviceLogs(prev => [
      `[${new Date().toLocaleTimeString()}] Corporate identity details saved under assigned department.`,
      ...prev
    ]);
  };

  const handleEmployeeDownloadExt = () => {
    setEmpExtDownloaded(true);
    setEmpDeviceLogs(prev => [
      `[${new Date().toLocaleTimeString()}] Downloaded personalized client configuration package successfully.`,
      `[${new Date().toLocaleTimeString()}] Packed Config: { ServerUrl: '${window.location.origin}', OrgId: '${session.orgId}' }`,
      ...prev
    ]);
  };

  const handleEmployeeVerifyInstall = () => {
    setEmpExtInstalled(true);
    updateEmployeeProfile(session.uid, { extensionInstalled: true });
    setEmpDeviceLogs(prev => [
      `[${new Date().toLocaleTimeString()}] Extension daemon local listener established.`,
      `[${new Date().toLocaleTimeString()}] Handshake pending secure organization authorization challenge...`,
      ...prev
    ]);
  };

  const handleEmployeeVerifyOrgCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (empOrgCodeChallenger.trim().toUpperCase() === orgCode.toUpperCase()) {
      setEmpOrgCodeVerified(true);
      setEmpDeviceLogs(prev => [
        `[${new Date().toLocaleTimeString()}] ✔️ SECURE CHALLENGE PASSED. Org Code matching verified!`,
        `[${new Date().toLocaleTimeString()}] Local proxy traffic is now actively rerouted through AegisOne Sovereign filter.`,
        `[${new Date().toLocaleTimeString()}] Status: SECURED & ACTIVE. Ready to navigate.`,
        ...prev
      ]);
    } else {
      alert(`Invalid Org Code. Please reference your organization's exact join code (e.g., '${orgCode}') displayed inside the Admin setup portal.`);
    }
  };

  // Failsafe triggers for checklist count
  const checklistCompletedCount = Object.values(checklist).filter(Boolean).length;

  return (
    <section className="min-h-screen bg-slate-950 text-white font-sans py-12 px-4 sm:px-6 lg:px-8 border-t-2 border-[#0A5ED6]">
      <div className="max-w-7xl mx-auto">
        
        {/* Portal Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 border-b border-slate-900 mb-8 text-left">
          <div>
            <div className="flex items-center gap-2 text-[#0A5ED6] font-mono text-xs uppercase tracking-widest mb-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${session.role === 'employee' && !empOrgCodeVerified ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
              {session.role === 'employee' ? 'Endpoint Terminal Node' : `Sovereign Tenant: ${session.orgName}`}
            </div>
            
            <h1 className="font-sans text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Shield className="w-7 h-7 text-[#0A5ED6]" />
              AegisOne Shield Admin Portal
            </h1>
            
            <p className="font-sans text-xs text-slate-400 mt-1">
              Logged in as <strong className="text-slate-200">{session.name}</strong> ({session.email}) • Role: <span className="text-[#0A5ED6] font-mono uppercase font-bold text-xs">{session.role === 'admin' ? 'Organization Admin' : session.role === 'subadmin' ? 'Manager / Team Lead' : 'Staff Employee'}</span>
            </p>
          </div>

          {/* Role specific navigation tabs */}
          {session.role !== 'employee' && (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1.5 rounded-xl flex-wrap">
              {/* Optional setup checklist flag */}
              <button
                onClick={() => setActiveTab('wizard')}
                className={`font-sans text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer relative ${
                  activeTab === 'wizard' 
                    ? 'bg-[#0A5ED6] text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-4 h-4" /> Setup Wizard
                {checklistCompletedCount < 8 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-[9px] text-slate-950 font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                    !
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('dashboard')}
                className={`font-sans text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'dashboard' 
                    ? 'bg-[#0A5ED6] text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </button>

              <button
                onClick={() => setActiveTab('threats')}
                className={`font-sans text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'threats' 
                    ? 'bg-[#0A5ED6] text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <AlertTriangle className="w-4 h-4" /> Threat Center
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`font-sans text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'users' 
                    ? 'bg-[#0A5ED6] text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" /> Users
              </button>

              <button
                onClick={() => setActiveTab('departments')}
                className={`font-sans text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'departments' 
                    ? 'bg-[#0A5ED6] text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4" /> Departments
              </button>

              <button
                onClick={() => setActiveTab('analytics')}
                className={`font-sans text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'analytics' 
                    ? 'bg-[#0A5ED6] text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-4 h-4" /> Analytics
              </button>

              <button
                onClick={() => setActiveTab('reports')}
                className={`font-sans text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'reports' 
                    ? 'bg-[#0A5ED6] text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" /> Reports
              </button>

              <button
                onClick={() => setActiveTab('extensions')}
                className={`font-sans text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'extensions' 
                    ? 'bg-[#0A5ED6] text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Puzzle className="w-4 h-4" /> Extension Management
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`font-sans text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'settings' 
                    ? 'bg-[#0A5ED6] text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4" /> Settings
              </button>

              <button
                onClick={() => setActiveTab('help')}
                className={`font-sans text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'help' 
                    ? 'bg-[#0A5ED6] text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <HelpCircle className="w-4 h-4" /> Help
              </button>

              <div className="w-[1px] h-6 bg-slate-800 self-center mx-1" />
              <button
                onClick={onLogOut}
                className="font-sans text-xs font-semibold px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-all flex items-center gap-1 cursor-pointer"
                title="Logout session"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          )}

          {session.role === 'employee' && (
            <button
              onClick={onLogOut}
              className="font-sans text-xs font-semibold px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-all flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Log Out Endpoint
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* WORKFLOW 4 & 5 - EMPLOYEE WORKSPACE                                       */}
        {/* ========================================================================= */}
        {session.role === 'employee' && (
          <div className="space-y-8 animate-fadeIn text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="font-sans font-bold text-xl text-white mb-2 flex items-center gap-2">
                <Laptop className="w-6 h-6 text-[#0A5ED6]" />
                Endpoint Protection Hub
              </h2>
              <p className="font-sans text-xs text-slate-400 leading-relaxed max-w-4xl">
                Complete the steps below to secure your corporate laptop or desktop endpoint. Once the local browser extension is connected with your organization's server, all phishing attempts, deceptive mimic loops, and harvesting scams will be blocked dynamically.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Employee setup steps (7 cols) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Step 1: Complete Profile */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs text-[#0A5ED6] font-bold uppercase tracking-wider block mb-1">Step 1</span>
                      <h3 className="font-sans font-bold text-base text-white">Complete Corporate Profile</h3>
                      <p className="font-sans text-xs text-slate-400 mt-1">Associate this endpoint with your name and department assignment inside {session.orgName}.</p>
                    </div>
                    {empProfileSaved ? (
                      <span className="bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded text-xs font-bold border border-emerald-800 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Completed
                      </span>
                    ) : (
                      <span className="bg-amber-950 text-amber-400 px-2.5 py-1 rounded text-xs font-bold border border-amber-800">Pending</span>
                    )}
                  </div>

                  {!empProfileSaved ? (
                    <form onSubmit={handleEmployeeProfileSave} className="mt-4 space-y-4 pt-4 border-t border-slate-850">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="font-sans text-[11px] font-bold text-slate-300 uppercase tracking-wide">Full Name</label>
                          <input 
                            type="text" 
                            required
                            value={empProfileName} 
                            onChange={(e) => setEmpProfileName(e.target.value)}
                            className="font-sans text-xs w-full bg-slate-950 border border-slate-800 focus:border-[#0A5ED6] rounded-lg px-3 py-2.5 text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-sans text-[11px] font-bold text-slate-300 uppercase tracking-wide">My Department</label>
                          <select 
                            required
                            value={empProfileDept} 
                            onChange={(e) => setEmpProfileDept(e.target.value)}
                            className="font-sans text-xs w-full bg-slate-950 border border-slate-800 focus:border-[#0A5ED6] rounded-lg px-3 py-2.5 text-white cursor-pointer"
                          >
                            <option value="">Select Department...</option>
                            {departments.length === 0 ? (
                              <option value="dept-gen">General Operations</option>
                            ) : (
                              departments.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))
                            )}
                          </select>
                        </div>
                      </div>
                      <button 
                        type="submit" 
                        className="font-sans text-xs font-bold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white px-4 py-2.5 rounded-lg cursor-pointer transition-colors"
                      >
                        Verify Identity Profile
                      </button>
                    </form>
                  ) : (
                    <div className="mt-4 bg-slate-950 p-3 rounded-lg text-xs text-slate-300 border border-slate-850">
                      <strong>Assigned Card ID:</strong> {session.employeeId || 'EMP-LIVE-4091'} <br />
                      <strong>Roster Name:</strong> {empProfileName} <br />
                      <strong>System Group:</strong> {departments.find(d => d.id === session.departmentId || d.id === empProfileDept)?.name || 'General Operations'}
                    </div>
                  )}
                </div>

                {/* Step 2: Download Extension */}
                <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all ${!empProfileSaved ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs text-[#0A5ED6] font-bold uppercase tracking-wider block mb-1">Step 2</span>
                      <h3 className="font-sans font-bold text-base text-white">Download Secure Local Installer</h3>
                      <p className="font-sans text-xs text-slate-400 mt-1">Receive the baked binary package containing your secure credentials directly.</p>
                    </div>
                    {empExtDownloaded ? (
                      <span className="bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded text-xs font-bold border border-emerald-800 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Downloaded
                      </span>
                    ) : (
                      <span className="bg-amber-950 text-amber-400 px-2.5 py-1 rounded text-xs font-bold border border-amber-800">Ready</span>
                    )}
                  </div>

                  <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-850 text-xs space-y-2">
                    <div className="font-mono text-[11px] text-slate-400 grid grid-cols-2 gap-2">
                      <div><strong>Organization ID:</strong> {session.orgId}</div>
                      <div><strong>Gateway Host:</strong> API-SECURE-NODE</div>
                      <div><strong>Deployment Version:</strong> v2.4.0 (Enterprise)</div>
                      <div><strong>Target Platform:</strong> Chrome, Edge, Safari</div>
                    </div>
                  </div>

                  <button 
                    onClick={handleEmployeeDownloadExt}
                    className="font-sans text-xs font-bold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white px-4 py-2.5 rounded-lg cursor-pointer mt-4 transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> Download Client Extension Bundle
                  </button>
                </div>

                {/* Step 3: Install Extension */}
                <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all ${!empExtDownloaded ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs text-[#0A5ED6] font-bold uppercase tracking-wider block mb-1">Step 3</span>
                      <h3 className="font-sans font-bold text-base text-white">Establish Local Filter Hook</h3>
                      <p className="font-sans text-xs text-slate-400 mt-1">Open your Chrome extension settings, turn on Developer Mode, and click "Load Unpacked" pointing to the zip.</p>
                    </div>
                    {empExtInstalled ? (
                      <span className="bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded text-xs font-bold border border-emerald-800 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Handshake OK
                      </span>
                    ) : (
                      <span className="bg-amber-950 text-amber-400 px-2.5 py-1 rounded text-xs font-bold border border-amber-800">Pending</span>
                    )}
                  </div>

                  {!empExtInstalled && (
                    <button 
                      onClick={handleEmployeeVerifyInstall}
                      className="font-sans text-xs font-bold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white px-4 py-2.5 rounded-lg cursor-pointer mt-4 transition-colors"
                    >
                      Verify Extension local Listener
                    </button>
                  )}
                </div>

                {/* Step 4: Enter Organization Code */}
                <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all ${!empExtInstalled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs text-[#0A5ED6] font-bold uppercase tracking-wider block mb-1">Step 4</span>
                      <h3 className="font-sans font-bold text-base text-white">Submit Organization Join Code</h3>
                      <p className="font-sans text-xs text-slate-400 mt-1">Enter your organization's private join token to register this hardware node with the threat dashboard.</p>
                    </div>
                    {empOrgCodeVerified ? (
                      <span className="bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded text-xs font-bold border border-emerald-800 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Filter Active
                      </span>
                    ) : (
                      <span className="bg-amber-950 text-amber-400 px-2.5 py-1 rounded text-xs font-bold border border-amber-800">Action Required</span>
                    )}
                  </div>

                  {!empOrgCodeVerified ? (
                    <form onSubmit={handleEmployeeVerifyOrgCode} className="mt-4 flex items-center gap-3">
                      <input 
                        type="text" 
                        required
                        value={empOrgCodeChallenger}
                        onChange={(e) => setEmpOrgCodeChallenger(e.target.value)}
                        placeholder="e.g. ALB-3902"
                        className="font-sans text-xs bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white outline-none focus:border-[#0A5ED6] uppercase font-bold w-48"
                      />
                      <button 
                        type="submit"
                        className="font-sans text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg cursor-pointer transition-colors"
                      >
                        Activate Shield Protection
                      </button>
                    </form>
                  ) : (
                    <div className="mt-4 bg-emerald-950/40 p-4 rounded-xl border border-emerald-900/40 flex items-center gap-3 text-emerald-400 text-xs">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <strong>Connection Authenticated:</strong> Secure tunnel active. Web page visits from this local terminal are filtered locally through memory-cache database safely inside your node firewall. Zero telemetry leaked to outside attackers.
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Employee status logs terminal (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <h4 className="font-sans font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Terminal className="w-4 h-4 text-[#0A5ED6]" />
                    Local Agent Console Log
                  </h4>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 font-mono text-[10.5px] text-slate-300 h-96 overflow-y-auto space-y-2 select-all text-left">
                    {empDeviceLogs.map((log, index) => (
                      <div key={index} className="leading-relaxed break-all">
                        {log}
                      </div>
                    ))}
                  </div>

                  {empOrgCodeVerified && (
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-850 flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                      <div className="text-[11px] text-slate-400 font-mono text-left">
                        Proxy Interceptor: <strong>Active (Port 8443)</strong> <br />
                        Filtering latency: <strong>~0.6ms</strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* WORKFLOW 3 - WELCOME & ONBOARDING SETUP CHECKLIST (ADMINS/LEADS)           */}
        {/* ========================================================================= */}
        {session.role !== 'employee' && activeTab === 'wizard' && (
          <div className="space-y-8 animate-fadeIn text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="font-sans font-extrabold text-xl md:text-2xl text-white mb-2 flex items-center gap-2">
                  Welcome to AegisOne Shield Portal Setup Wizard
                </h2>
                <p className="font-sans text-xs text-slate-400 max-w-3xl leading-relaxed">
                  Your Sovereign node is pre-installed. Complete this quick local interactive wizard step-by-step to configure organizations, register managers, whitelist departments, and secure endpoints correctly.
                </p>
              </div>

              {/* Skip to Dashboard */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="font-sans text-xs font-bold text-white bg-[#0A5ED6] hover:bg-[#0B63E0] px-5 py-3 rounded-xl flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-sm"
              >
                Go to Dashboard Console <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Main Checklist steps */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Checklist Cards List (7 cols) */}
              <div className="lg:col-span-7 space-y-5">
                
                {/* 1. Server Installed */}
                <div className="bg-slate-900 border border-emerald-900/50 rounded-2xl p-5 flex items-start gap-4">
                  <div className="bg-emerald-950 border border-emerald-800 p-2.5 rounded-xl text-emerald-400 shrink-0">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-sans font-bold text-sm text-white flex items-center gap-2">
                      Server Installed Successfully
                      <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] px-2 py-0.5 rounded font-mono font-bold">LIVE ON PORT 3000</span>
                    </h3>
                    <p className="font-sans text-xs text-slate-400 mt-1">The local docker daemon listener is active and serving requests entirely inside your local network firewall. 100% data sovereignty is achieved.</p>
                  </div>
                </div>

                {/* 2. Configure Organization */}
                <div className={`bg-slate-900 border rounded-2xl p-5 flex items-start gap-4 transition-all ${checklist.orgConfigured ? 'border-emerald-900/50' : 'border-slate-800'}`}>
                  <button 
                    type="button"
                    onClick={() => markChecklistStep('orgConfigured', !checklist.orgConfigured)}
                    className="p-1 text-slate-400 hover:text-white shrink-0 mt-0.5"
                  >
                    {checklist.orgConfigured ? (
                      <CheckSquare className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-600" />
                    )}
                  </button>
                  <div className="flex-1">
                    <h3 className="font-sans font-bold text-sm text-white">Configure Organization Profile</h3>
                    <p className="font-sans text-xs text-slate-400 mt-1">Specify custom domain whitelists and parameters for threat alerts.</p>
                    
                    {!checklist.orgConfigured && (
                      <form onSubmit={handleSaveWizardOrg} className="mt-4 bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="font-mono text-[10px] text-slate-400 uppercase font-bold">Organization Name</label>
                            <input 
                              type="text" 
                              value={wizardOrgName} 
                              onChange={(e) => setWizardOrgName(e.target.value)}
                              className="font-sans text-xs w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="font-mono text-[10px] text-slate-400 uppercase font-bold">Corporate Local Domain</label>
                            <input 
                              type="text" 
                              value={wizardDomain} 
                              onChange={(e) => setWizardDomain(e.target.value)}
                              className="font-sans text-xs w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                            />
                          </div>
                        </div>
                        <button 
                          type="submit" 
                          className="font-sans text-[11px] font-bold bg-[#0A5ED6] text-white px-3 py-1.5 rounded"
                        >
                          Save Corporate Settings
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* 3. Create Departments */}
                <div className={`bg-slate-900 border rounded-2xl p-5 flex items-start gap-4 transition-all ${checklist.departmentsCreated ? 'border-emerald-900/50' : 'border-slate-800'}`}>
                  <button 
                    type="button"
                    onClick={() => markChecklistStep('departmentsCreated', !checklist.departmentsCreated)}
                    className="p-1 text-slate-400 hover:text-white shrink-0 mt-0.5"
                  >
                    {checklist.departmentsCreated ? (
                      <CheckSquare className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-600" />
                    )}
                  </button>
                  <div className="flex-1">
                    <h3 className="font-sans font-bold text-sm text-white">Create Departments</h3>
                    <p className="font-sans text-xs text-slate-400 mt-1">Register default corporate divisions (e.g. Sales, Marketing, IT Ops) to partition threat logs correctly.</p>
                    
                    {!checklist.departmentsCreated && (
                      <form onSubmit={handleCreateWizardDept} className="mt-4 bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
                        <div className="space-y-1">
                          <label className="font-mono text-[10px] text-slate-400 uppercase font-bold">Department Name</label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g. IT Security Division"
                            value={wizardDeptName} 
                            onChange={(e) => setWizardDeptName(e.target.value)}
                            className="font-sans text-xs w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                          />
                        </div>
                        <button 
                          type="submit" 
                          className="font-sans text-[11px] font-bold bg-[#0A5ED6] text-white px-3 py-1.5 rounded"
                        >
                          Add Division
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* 4. Add Managers */}
                <div className={`bg-slate-900 border rounded-2xl p-5 flex items-start gap-4 transition-all ${checklist.managersAdded ? 'border-emerald-900/50' : 'border-slate-800'}`}>
                  <button 
                    type="button"
                    onClick={() => markChecklistStep('managersAdded', !checklist.managersAdded)}
                    className="p-1 text-slate-400 hover:text-white shrink-0 mt-0.5"
                  >
                    {checklist.managersAdded ? (
                      <CheckSquare className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-600" />
                    )}
                  </button>
                  <div className="flex-1">
                    <h3 className="font-sans font-bold text-sm text-white">Add Managers &amp; Team Leads</h3>
                    <p className="font-sans text-xs text-slate-400 mt-1">Register sub-administrator emails. They receive credentials to log in, oversee their departments, and download installers.</p>
                    
                    {!checklist.managersAdded && (
                      <form onSubmit={handleAddWizardLead} className="mt-4 bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <input 
                            type="text" 
                            required
                            placeholder="Full Name"
                            value={wizardLeadName} 
                            onChange={(e) => setWizardLeadName(e.target.value)}
                            className="font-sans text-xs bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white col-span-1"
                          />
                          <input 
                            type="email" 
                            required
                            placeholder="manager@domain.com"
                            value={wizardLeadEmail} 
                            onChange={(e) => setWizardLeadEmail(e.target.value)}
                            className="font-sans text-xs bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white col-span-1"
                          />
                          <input 
                            type="text" 
                            required
                            placeholder="Corporate ID"
                            value={wizardLeadEmpId} 
                            onChange={(e) => setWizardLeadEmpId(e.target.value)}
                            className="font-sans text-xs bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white col-span-1"
                          />
                        </div>
                        <button 
                          type="submit" 
                          className="font-sans text-[11px] font-bold bg-[#0A5ED6] text-white px-3 py-1.5 rounded"
                        >
                          Register Team Lead
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* 5. Add Employees */}
                <div className={`bg-slate-900 border rounded-2xl p-5 flex items-start gap-4 transition-all ${checklist.employeesAdded ? 'border-emerald-900/50' : 'border-slate-800'}`}>
                  <button 
                    type="button"
                    onClick={() => markChecklistStep('employeesAdded', !checklist.employeesAdded)}
                    className="p-1 text-slate-400 hover:text-white shrink-0 mt-0.5"
                  >
                    {checklist.employeesAdded ? (
                      <CheckSquare className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-600" />
                    )}
                  </button>
                  <div className="flex-1">
                    <h3 className="font-sans font-bold text-sm text-white">Add Staff Members</h3>
                    <p className="font-sans text-xs text-slate-400 mt-1">Register standard corporate employees so the server associates active endpoint queries with real people inside logs.</p>
                    
                    {!checklist.employeesAdded && (
                      <form onSubmit={handleAddWizardEmp} className="mt-4 bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <input 
                            type="text" 
                            required
                            placeholder="Staff Name"
                            value={wizardEmpName} 
                            onChange={(e) => setWizardEmpName(e.target.value)}
                            className="font-sans text-xs bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white col-span-1"
                          />
                          <input 
                            type="email" 
                            required
                            placeholder="staff@domain.com"
                            value={wizardEmpEmail} 
                            onChange={(e) => setWizardEmpEmail(e.target.value)}
                            className="font-sans text-xs bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white col-span-1"
                          />
                          <input 
                            type="text" 
                            required
                            placeholder="Staff ID"
                            value={wizardEmpId} 
                            onChange={(e) => setWizardEmpId(e.target.value)}
                            className="font-sans text-xs bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white col-span-1"
                          />
                        </div>
                        <button 
                          type="submit" 
                          className="font-sans text-[11px] font-bold bg-[#0A5ED6] text-white px-3 py-1.5 rounded"
                        >
                          Register Employee
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* 6. Install Extension */}
                <div className={`bg-slate-900 border rounded-2xl p-5 flex items-start gap-4 transition-all ${checklist.extensionInstalled ? 'border-emerald-900/50' : 'border-slate-800'}`}>
                  <button 
                    type="button"
                    onClick={() => markChecklistStep('extensionInstalled', !checklist.extensionInstalled)}
                    className="p-1 text-slate-400 hover:text-white shrink-0 mt-0.5"
                  >
                    {checklist.extensionInstalled ? (
                      <CheckSquare className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-600" />
                    )}
                  </button>
                  <div className="flex-1">
                    <h3 className="font-sans font-bold text-sm text-white">Install AegisOne Browser Extension</h3>
                    <p className="font-sans text-xs text-slate-400 mt-1">Download the corporate unpacked installer or configuration policies inside the Extension Management panel.</p>
                    
                    {!checklist.extensionInstalled && (
                      <div className="mt-4 flex gap-3">
                        <button 
                          onClick={() => {
                            markChecklistStep('extensionInstalled', true);
                            setActiveTab('extensions');
                          }}
                          className="font-sans text-xs font-bold bg-[#0A5ED6] text-white px-4 py-2 rounded"
                        >
                          Go to Extension Manager
                        </button>
                        <button 
                          onClick={() => markChecklistStep('extensionInstalled', true)}
                          className="font-sans text-xs font-bold text-slate-400 bg-slate-950 px-4 py-2 rounded border border-slate-800 hover:text-white"
                        >
                          Simulate Installation
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 7. Verify Connection */}
                <div className={`bg-slate-900 border rounded-2xl p-5 flex items-start gap-4 transition-all ${checklist.connectionVerified ? 'border-emerald-900/50' : 'border-slate-800'}`}>
                  <button 
                    type="button"
                    onClick={() => markChecklistStep('connectionVerified', !checklist.connectionVerified)}
                    className="p-1 text-slate-400 hover:text-white shrink-0 mt-0.5"
                  >
                    {checklist.connectionVerified ? (
                      <CheckSquare className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-600" />
                    )}
                  </button>
                  <div className="flex-1">
                    <h3 className="font-sans font-bold text-sm text-white">Verify Connection Pipeline</h3>
                    <p className="font-sans text-xs text-slate-400 mt-1">Test the connection integrity between corporate employees and the sovereign database filter.</p>
                    
                    {!checklist.connectionVerified && (
                      <div className="mt-4">
                        <button 
                          onClick={handleVerifyWizardConnection}
                          disabled={isVerifyingConnection}
                          className="font-sans text-xs font-bold bg-[#0A5ED6] disabled:bg-slate-800 text-white px-4 py-2 rounded flex items-center gap-2"
                        >
                          {isVerifyingConnection ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying connection...
                            </>
                          ) : (
                            'Run Gateway connection Test'
                          )}
                        </button>
                        {verificationSuccess && (
                          <p className="font-mono text-xs text-emerald-400 mt-2">✔️ Network handshake success! Node ping verified.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 8. Start Protection */}
                <div className={`bg-slate-900 border rounded-2xl p-5 flex items-start gap-4 transition-all ${checklist.protectionStarted ? 'border-emerald-900/50' : 'border-slate-800'}`}>
                  <button 
                    type="button"
                    onClick={() => markChecklistStep('protectionStarted', !checklist.protectionStarted)}
                    className="p-1 text-slate-400 hover:text-white shrink-0 mt-0.5"
                  >
                    {checklist.protectionStarted ? (
                      <CheckSquare className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-600" />
                    )}
                  </button>
                  <div className="flex-1">
                    <h3 className="font-sans font-bold text-sm text-white">Enable Threat Shield Protection</h3>
                    <p className="font-sans text-xs text-slate-400 mt-1">Boot active filters and initialize simulated security telemetry feeds on your main dashboard.</p>
                    
                    {!checklist.protectionStarted && (
                      <button 
                        onClick={() => {
                          markChecklistStep('protectionStarted', true);
                          setAutoSimulate(true);
                          setActiveTab('dashboard');
                        }}
                        className="font-sans text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded mt-4"
                      >
                        Enable Active Protection Shield
                      </button>
                    )}
                  </div>
                </div>

              </div>

              {/* Progress Tracker (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
                  <h4 className="font-sans font-bold text-sm text-white">Onboarding Progress</h4>
                  
                  {/* Huge Percentage Circle */}
                  <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" stroke="#1e293b" strokeWidth="8" fill="transparent" />
                      <circle cx="50" cy="50" r="42" stroke="#0A5ED6" strokeWidth="8" fill="transparent" 
                        strokeDasharray={263.8} 
                        strokeDashoffset={263.8 - (263.8 * checklistCompletedCount) / 8}
                        className="transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute font-mono text-2xl font-bold text-white">
                      {Math.round((checklistCompletedCount / 8) * 100)}%
                    </div>
                  </div>

                  <p className="font-sans text-xs text-slate-400">
                    <strong>{checklistCompletedCount} of 8</strong> setup tasks are validated.
                  </p>

                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-850 text-left space-y-2">
                    <div className="font-mono text-[11px] text-slate-400">
                      <strong>Organization Code:</strong> <span className="text-[#0A5ED6] font-bold">{orgCode}</span>
                    </div>
                    <p className="font-sans text-[11px] text-slate-500 leading-relaxed leading-normal">
                      Share this private Org Code with employees. When they install the local extension and enter this token, their browsers will automatically connect with this node's whitelists.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: DASHBOARD OVERVIEW                                                   */}
        {/* ========================================================================= */}
        {session.role !== 'employee' && activeTab === 'dashboard' && (
          <div className="space-y-8 animate-fadeIn text-left">
            
            {/* Live protection status banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-950 border border-emerald-900/60 p-3 rounded-2xl text-emerald-400">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="font-sans font-bold text-lg text-white">Sovereign Protection Active</h2>
                  <p className="font-sans text-xs text-slate-400 mt-1">AegisOne is monitoring {employees.length} connected corporate devices with 100% cloud privacy. Zero bits of telemetry leave your nodes.</p>
                </div>
              </div>

              <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-850 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-xs text-slate-300">Organization Code: <strong className="text-white select-all">{orgCode}</strong></span>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">Total Inspected web paths</div>
                <div className="text-2xl font-bold font-mono text-white">{stats.totalScanned.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 mt-2 font-mono flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Fully Inspected
                </div>
              </div>
              
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">Blocked Phish Assets</div>
                <div className="text-2xl font-bold font-mono text-red-400">{stats.totalBlocked}</div>
                <div className="text-[10px] text-red-500/80 mt-2 font-mono flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Isolated on local browser client
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">Average Inspection Time</div>
                <div className="text-2xl font-bold font-mono text-[#0A5ED6]">{stats.avgLatency} ms</div>
                <div className="text-[10px] text-slate-500 mt-2 font-mono flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-yellow-500" /> Memory cache lookup limits
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">External Leaks to Cloud</div>
                <div className="text-2xl font-bold font-mono text-emerald-400">0.00 Bytes</div>
                <div className="text-[10px] text-emerald-500/80 mt-2 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Zero telemetry policies
                </div>
              </div>
            </div>

            {/* Quick Overview Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Recent Logs Summary (8 cols) */}
              <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-sans font-bold text-sm text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#0A5ED6]" /> Recent Network Inspections
                  </h3>
                  <button 
                    onClick={() => setActiveTab('threats')}
                    className="font-sans text-xs text-[#0A5ED6] hover:underline"
                  >
                    View All Logs
                  </button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {threatLogs.slice(0, 5).map(log => (
                    <div key={log.id} className="bg-slate-950 p-3 rounded-lg border border-slate-850/50 flex items-center justify-between gap-4 text-xs font-mono">
                      <div className="truncate text-left min-w-0">
                        <span className="text-slate-400 mr-2">[{log.timestamp}]</span>
                        <span className="text-slate-100 font-bold truncate">{log.url}</span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Checked for: <strong>{log.employeeName || 'Anonymous'}</strong> ({log.employeeId || 'ID-UNKNOWN'})
                        </div>
                      </div>
                      <div className="shrink-0">
                        {log.status === 'BLOCKED' ? (
                          <span className="bg-red-950/80 border border-red-500/20 text-red-400 font-bold px-2 py-0.5 rounded text-[10px]">
                            BLOCKED
                          </span>
                        ) : (
                          <span className="bg-blue-950/80 border border-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded text-[10px]">
                            CLEAN
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connected Staff overview (4 cols) */}
              <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-sans font-bold text-sm text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-500" /> Roster Status
                  </h3>
                  <span className="text-xs bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold px-2.5 py-0.5 rounded">
                    {employees.length} Active
                  </span>
                </div>

                <div className="space-y-3">
                  {employees.slice(0, 4).map(emp => (
                    <div key={emp.id} className="flex items-center justify-between text-xs bg-slate-950 p-3 rounded-xl border border-slate-850/50">
                      <div className="text-left">
                        <div className="font-bold text-slate-200">{emp.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{emp.employeeId}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        emp.role === 'lead' ? 'bg-amber-950 border border-amber-900 text-amber-400' : 'bg-blue-950 border border-blue-900 text-blue-400'
                      }`}>
                        {emp.role === 'lead' ? 'Team Lead' : 'Staff'}
                      </span>
                    </div>
                  ))}
                  {employees.length === 0 && (
                    <div className="text-center text-slate-500 text-xs py-4">No employees registered yet. Please add them inside the Roster directory!</div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: THREAT CENTER                                                        */}
        {/* ========================================================================= */}
        {session.role !== 'employee' && activeTab === 'threats' && (
          <div className="space-y-8 animate-fadeIn text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="font-sans font-bold text-lg text-white mb-2 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" /> Threat Center Console
              </h2>
              <p className="font-sans text-xs text-slate-400 max-w-4xl leading-relaxed">
                Analyze mock web URLs inside the Sandbox simulator or view the live filtered client traffic from connected local endpoints in real-time.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Sandbox Simulator (5 cols) */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div>
                  <h3 className="font-sans font-bold text-sm text-white border-b border-slate-800 pb-3 flex items-center gap-1.5">
                    <Play className="w-4 h-4 text-[#0A5ED6]" /> Phishing Sandbox Simulator
                  </h3>
                  <p className="font-sans text-xs text-slate-400 mt-2 leading-relaxed">
                    Test how our heuristics algorithm inspects URLs. Submit any domain string to run the sandboxed detection logic.
                  </p>
                </div>

                <form onSubmit={handleUrlAnalysis} className="space-y-3">
                  <div className="space-y-1">
                    <label className="font-sans text-[11px] font-bold text-slate-300 uppercase tracking-wide">Suspicious Link URL</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. http://irs-tax-refund.com"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="font-sans text-xs w-full bg-slate-950 border border-slate-800 focus:border-[#0A5ED6] rounded-lg px-3 py-2.5 text-white outline-none"
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={isAnalyzing}
                    className="font-sans text-xs font-bold bg-[#0A5ED6] disabled:bg-slate-800 text-white w-full py-2.5 rounded-lg transition-all cursor-pointer shadow-sm"
                  >
                    {isAnalyzing ? 'Running Local Isolation Analysis...' : 'Evaluate Web Link'}
                  </button>
                </form>

                {analysisResult && (
                  <div className={`p-4 rounded-xl border animate-fadeIn text-xs text-left space-y-2 ${
                    analysisResult.status === 'BLOCKED' 
                      ? 'bg-red-950/40 border-red-900/35 text-red-300' 
                      : 'bg-emerald-950/40 border-emerald-900/35 text-emerald-300'
                  }`}>
                    <div className="flex items-center justify-between font-bold">
                      <span>Heuristic Verdict: {analysisResult.status}</span>
                      <span>Threat Score: {analysisResult.score}%</span>
                    </div>
                    <div className="font-mono text-[10px] text-slate-400 mt-1">
                      Inspection Speed: <strong>{analysisResult.latency}ms</strong>
                    </div>
                    <div className="space-y-1 mt-2">
                      {analysisResult.reasons.map((r, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Live Logs (7 cols) */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-sans font-bold text-sm text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-[#0A5ED6]" /> Live Protective Gateway Logs
                  </h3>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={autoSimulate}
                        onChange={(e) => setAutoSimulate(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-950 text-blue-500 focus:ring-0 w-3.5 h-3.5"
                      />
                      <span className="font-mono text-[11px] text-slate-400">Reroute Feed</span>
                    </label>
                    <button 
                      onClick={clearLogs}
                      className="font-mono text-[10px] text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 px-2.5 py-1 rounded cursor-pointer transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="p-4 max-h-[420px] overflow-y-auto" ref={logContainerRef}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse min-w-[600px]">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-500">
                          <th className="pb-3 pt-1 pl-2">Timestamp</th>
                          <th className="pb-3 pt-1">Link URL Request</th>
                          <th className="pb-3 pt-1">Verdict</th>
                          <th className="pb-3 pt-1">Target Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {threatLogs.map((log) => (
                          <tr 
                            key={log.id} 
                            className={`border-b border-slate-900 hover:bg-slate-950/40 transition-colors ${
                              log.status === 'BLOCKED' ? 'bg-red-950/10' : ''
                            }`}
                          >
                            <td className="py-3 pl-2 text-slate-400">{log.timestamp}</td>
                            <td className="py-3 max-w-[200px] truncate text-slate-200" title={log.url}>
                              {log.url}
                            </td>
                            <td className="py-3">
                              {log.status === 'BLOCKED' ? (
                                <span className="bg-red-950/80 border border-red-500/20 text-red-400 font-bold px-2 py-0.5 rounded text-[10px]">
                                  BLOCKED
                                </span>
                              ) : (
                                <span className="bg-blue-950/80 border border-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded text-[10px]">
                                  ALLOWED
                                </span>
                              )}
                            </td>
                            <td className="py-3 text-slate-300">
                              {log.employeeName || 'Anonymous'}
                            </td>
                          </tr>
                        ))}
                        {threatLogs.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-500">
                              No logs recorded. Toggle Reroute Feed to simulate browser filter hits.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: USERS DIRECTORY                                                      */}
        {/* ========================================================================= */}
        {session.role !== 'employee' && activeTab === 'users' && (
          <div className="space-y-8 animate-fadeIn text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="font-sans font-bold text-lg text-white mb-2 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0A5ED6]" /> Manage Staff &amp; Team Roster
              </h2>
              <p className="font-sans text-xs text-slate-400 max-w-4xl leading-relaxed">
                Add and manage organizational roles. Registered employees and subadmins can log in to connect their personal client browsers using the organization code.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Form (5 cols) */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="font-sans font-bold text-sm text-white border-b border-slate-800 pb-3 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-[#0A5ED6]" /> Register New Corporate Account
                </h3>

                {addSuccessMsg && (
                  <div className="bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 p-3 rounded-lg text-xs flex items-center gap-2 animate-fadeIn">
                    {addSuccessMsg}
                  </div>
                )}

                <form onSubmit={handleAddEmployeeSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="font-sans text-[11px] font-bold text-slate-300 uppercase tracking-wide">Full Name</label>
                    <input 
                      type="text" 
                      required
                      value={newEmpName} 
                      onChange={(e) => setNewEmpName(e.target.value)}
                      placeholder="e.g. Zainab Bibi"
                      className="font-sans text-xs w-full bg-slate-950 border border-slate-800 focus:border-[#0A5ED6] rounded-lg px-3 py-2.5 text-white placeholder-slate-650"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-sans text-[11px] font-bold text-slate-300 uppercase tracking-wide">Official Email Address</label>
                    <input 
                      type="email" 
                      required
                      value={newEmpEmail} 
                      onChange={(e) => setNewEmpEmail(e.target.value)}
                      placeholder="zainab@company.com"
                      className="font-sans text-xs w-full bg-slate-950 border border-slate-800 focus:border-[#0A5ED6] rounded-lg px-3 py-2.5 text-white placeholder-slate-650"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-sans text-[11px] font-bold text-slate-300 uppercase tracking-wide">Corporate ID Assignment</label>
                    <input 
                      type="text" 
                      required
                      value={newEmpId} 
                      onChange={(e) => setNewEmpId(e.target.value)}
                      placeholder="EMP-LOG-4091"
                      className="font-sans text-xs w-full bg-slate-950 border border-slate-800 focus:border-[#0A5ED6] rounded-lg px-3 py-2.5 text-white placeholder-slate-650"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-sans text-[11px] font-bold text-slate-300 uppercase tracking-wide">Department Group</label>
                    <select 
                      value={newEmpDept} 
                      onChange={(e) => setNewEmpDept(e.target.value)}
                      className="font-sans text-xs w-full bg-slate-950 border border-slate-800 focus:border-[#0A5ED6] rounded-lg px-3 py-2.5 text-white cursor-pointer"
                    >
                      <option value="">No Department Assign</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-sans text-[11px] font-bold text-slate-300 uppercase tracking-wide">Role Class</label>
                    <select 
                      value={newEmpRole} 
                      onChange={(e) => setNewEmpRole(e.target.value as 'lead' | 'employee')}
                      className="font-sans text-xs w-full bg-slate-950 border border-slate-800 focus:border-[#0A5ED6] rounded-lg px-3 py-2.5 text-white cursor-pointer"
                    >
                      <option value="employee">Standard Staff Employee</option>
                      <option value="lead">Manager / Team Lead (Access to logs)</option>
                    </select>
                  </div>

                  <button 
                    type="submit" 
                    className="font-sans text-xs font-bold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white w-full py-3 rounded-lg transition-colors cursor-pointer"
                  >
                    Add User to Directory
                  </button>
                </form>
              </div>

              {/* Roster Table (7 cols) */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                  <h3 className="font-sans font-bold text-sm text-white">Roster Directory ({employees.length})</h3>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                    <input 
                      type="text" 
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      placeholder="Search name, email, ID..."
                      className="font-sans text-xs bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-white placeholder-slate-650"
                    />
                  </div>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {employees.filter(emp => {
                    const query = staffSearch.toLowerCase();
                    return emp.name.toLowerCase().includes(query) || emp.email.toLowerCase().includes(query) || emp.employeeId.toLowerCase().includes(query);
                  }).map(emp => (
                    <div key={emp.id} className="bg-slate-950 p-4 rounded-xl border border-slate-850/60 flex items-center justify-between gap-4">
                      <div className="text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100 truncate">{emp.name}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            emp.role === 'lead' ? 'bg-amber-950/40 border-amber-800/30 text-amber-400' : 'bg-blue-950/40 border-blue-800/30 text-blue-400'
                          }`}>
                            {emp.role === 'lead' ? 'Manager' : 'Staff'}
                          </span>
                        </div>
                        <div className="text-slate-400 text-[11px] mt-1">{emp.email} • <strong>Code:</strong> {emp.employeeId}</div>
                        <div className="text-slate-500 text-[10px] mt-0.5">
                          Department: <strong>{departments.find(d => d.id === emp.departmentId)?.name || 'General Operations'}</strong>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          removeEmployee(emp.id);
                          refreshDirectory();
                        }}
                        className="text-slate-500 hover:text-red-400 p-1.5 rounded bg-slate-900 border border-slate-850 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {employees.length === 0 && (
                    <div className="text-center text-slate-500 py-12">No corporate accounts match searching parameters.</div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: DEPARTMENTS                                                          */}
        {/* ========================================================================= */}
        {session.role !== 'employee' && activeTab === 'departments' && (
          <div className="space-y-8 animate-fadeIn text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="font-sans font-bold text-lg text-white mb-2 flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#0A5ED6]" /> Corporate Departments Whitelist
              </h2>
              <p className="font-sans text-xs text-slate-400 max-w-4xl leading-relaxed">
                Divide your team rosters into distinct segments. Each department has tailored heuristic rules and can have an assigned subadmin to monitor department threat events.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Form (5 cols) */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="font-sans font-bold text-sm text-white border-b border-slate-800 pb-3">Create New Division</h3>
                
                <form onSubmit={handleCreateDeptSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="font-sans text-[11px] font-bold text-slate-300 uppercase tracking-wide">Division / Department Name</label>
                    <input 
                      type="text" 
                      required
                      value={newDeptName} 
                      onChange={(e) => setNewDeptName(e.target.value)}
                      placeholder="e.g. IT Security Core"
                      className="font-sans text-xs w-full bg-slate-950 border border-slate-800 focus:border-[#0A5ED6] rounded-lg px-3 py-2.5 text-white placeholder-slate-650"
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="font-sans text-xs font-bold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white w-full py-3 rounded-lg cursor-pointer transition-colors"
                  >
                    Establish Department
                  </button>
                </form>
              </div>

              {/* Department List (7 cols) */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="font-sans font-bold text-sm text-white border-b border-slate-800 pb-3">Active Whitelists ({departments.length})</h3>

                <div className="space-y-3">
                  {departments.map(dept => {
                    const deptStaff = employees.filter(e => e.departmentId === dept.id);
                    const lead = deptStaff.find(e => e.role === 'lead');
                    return (
                      <div key={dept.id} className="bg-slate-950 p-4 rounded-xl border border-slate-850/60 flex items-center justify-between">
                        <div className="text-left">
                          <h4 className="font-sans font-bold text-sm text-slate-200">{dept.name}</h4>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Staff Count: <strong className="text-slate-300">{deptStaff.length} members</strong> • Lead: <span className="text-amber-400 font-semibold">{lead ? lead.name : 'Unassigned'}</span>
                          </div>
                        </div>
                        <span className="text-[10px] bg-slate-900 border border-slate-800 px-2 py-1 rounded text-slate-500 font-mono">
                          {dept.id}
                        </span>
                      </div>
                    );
                  })}
                  {departments.length === 0 && (
                    <div className="text-center text-slate-500 py-12">No active departments created yet.</div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: ANALYTICS (RECHARTS INTRODUCED WITH PROPER REACT 19 COMPATIBILITY)   */}
        {/* ========================================================================= */}
        {session.role !== 'employee' && activeTab === 'analytics' && (
          <div className="space-y-8 animate-fadeIn text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="font-sans font-bold text-lg text-white mb-2 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-yellow-500" /> Executive Analytics Console
              </h2>
              <p className="font-sans text-xs text-slate-400 max-w-4xl leading-relaxed">
                Graphing safe and blocked request flows across connected corporate networks locally.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Traffic Trends Chart (8 cols) */}
              <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="font-sans font-bold text-sm text-white">Link Traffic Trends (Today)</h3>
                
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsTimeData}>
                      <defs>
                        <linearGradient id="colorSafe" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0A5ED6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#0A5ED6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', color: '#fff' }} />
                      <Area type="monotone" dataKey="safe" name="Safe Hits" stroke="#0A5ED6" fillOpacity={1} fill="url(#colorSafe)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Threat Types Breakdown (4 cols) */}
              <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="font-sans font-bold text-sm text-white">Blocked Threats Breakdown</h3>

                <div className="h-48 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsCategoryData}>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', color: '#fff' }} />
                      <Bar dataKey="value" name="Threat Events">
                        {analyticsCategoryData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2 pt-2">
                  {analyticsCategoryData.map((cat, i) => (
                    <div key={i} className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.fill }} />
                        {cat.name}
                      </span>
                      <strong className="text-slate-200">{cat.value} blocked</strong>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: REPORTS SECTION                                                      */}
        {/* ========================================================================= */}
        {session.role !== 'employee' && activeTab === 'reports' && (
          <div className="space-y-8 animate-fadeIn text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="font-sans font-bold text-lg text-white mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0A5ED6]" /> Risk Executive Audit Reports
              </h2>
              <p className="font-sans text-xs text-slate-400 max-w-4xl leading-relaxed">
                Generate high-fidelity, printable summaries of security performance inside your SME. This reduces audit compliance friction.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <h3 className="font-sans font-bold text-lg text-white">Monthly Risk Executive Summary</h3>
                  <p className="font-sans text-xs text-slate-400">Security assessment for {session.orgName}. Prepared on {new Date().toLocaleDateString()}</p>
                </div>
                <button 
                  onClick={() => alert("Report printed successfully! Simulated PDF package was generated in cache.")}
                  className="font-sans text-xs font-bold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white px-5 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-2"
                >
                  <FileCheck className="w-4 h-4" /> Export Audit Report Card
                </button>
              </div>

              {/* Grid overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-left">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Shield Block Rate</div>
                  <div className="text-3xl font-extrabold text-emerald-400 font-mono mt-1">100%</div>
                  <p className="text-[11px] text-slate-400 mt-2">Zero credentials or sensitive strings compromised over browser layers.</p>
                </div>
                
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-left">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Active Whitelists</div>
                  <div className="text-3xl font-extrabold text-blue-400 font-mono mt-1">{departments.length} Divisions</div>
                  <p className="text-[11px] text-slate-400 mt-2">Custom safe heuristic rules loaded into gateway memory.</p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-left">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Local Data Leakage</div>
                  <div className="text-3xl font-extrabold text-emerald-400 font-mono mt-1">0.00 Bytes</div>
                  <p className="text-[11px] text-slate-400 mt-2">Sovereign Node isolation fully conforms with compliance policies.</p>
                </div>
              </div>

              {/* Compliance card */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-850 flex items-start gap-3">
                <div className="bg-emerald-950 p-2 rounded-lg text-emerald-400 shrink-0">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-sans font-bold text-xs text-white">HIPAA &amp; GDPR Sovereign Compliance Certificate</h4>
                  <p className="font-sans text-[11px] text-slate-500 leading-normal mt-1">
                    Your local installation on port 3000 intercepts all browser link lookups completely on-premise. No outside telemetry is transmitted, meeting strict international user privacy and database sovereignty protocols natively.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: EXTENSION MANAGEMENT                                                 */}
        {/* ========================================================================= */}
        {session.role !== 'employee' && activeTab === 'extensions' && (
          <div className="space-y-8 animate-fadeIn text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="font-sans font-bold text-lg text-white mb-2 flex items-center gap-2">
                <Puzzle className="w-5 h-5 text-emerald-500" /> Extension Control Center
              </h2>
              <p className="font-sans text-xs text-slate-400 max-w-4xl leading-relaxed">
                Configure installation parameters and review active client connection metrics. All browser extensions are pre-configured with baked organization credentials to reduce onboarding friction.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Config cards (5 cols) */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 text-left">
                <h3 className="font-sans font-bold text-sm text-white border-b border-slate-800 pb-3 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-[#0A5ED6]" /> Security Extension Policies
                </h3>

                <div className="space-y-4 text-xs">
                  <label className="flex items-center justify-between cursor-pointer p-3 bg-slate-950 rounded-xl border border-slate-850">
                    <div className="space-y-0.5 pr-2">
                      <span className="font-bold text-slate-200 block">Force Automatic Update</span>
                      <span className="text-slate-500 text-[10px]">Pushes update challenges to client extensions automatically.</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={extForceUpdate}
                      onChange={(e) => setExtForceUpdate(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-blue-500 w-4 h-4"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer p-3 bg-slate-950 rounded-xl border border-slate-850">
                    <div className="space-y-0.5 pr-2">
                      <span className="font-bold text-slate-200 block">Block Untrusted Devices</span>
                      <span className="text-slate-500 text-[10px]">Restricts lookups from endpoints without an organizational card ID.</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={extBlockUntrusted}
                      onChange={(e) => setExtBlockUntrusted(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-blue-500 w-4 h-4"
                    />
                  </label>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 text-[11px] font-mono text-slate-400 space-y-1">
                    <div><strong>Connection Health:</strong> <span className="text-emerald-400">Excellent</span></div>
                    <div><strong>Last Gateway Handshake:</strong> {new Date().toLocaleTimeString()}</div>
                  </div>
                </div>
              </div>

              {/* Right Column: Download Card (7 cols) */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <h3 className="font-sans font-bold text-sm text-white border-b border-slate-800 pb-3">Download Package</h3>

                <div className="p-6 bg-slate-950 rounded-2xl border border-slate-850 space-y-4">
                  <h4 className="font-sans font-bold text-sm text-[#0A5ED6]">Personalized Enterprise Installer</h4>
                  <p className="font-sans text-xs text-slate-400 leading-relaxed">
                    This build is customized with your organization ID. Running this installer automatically injects parameters so endpoints are protected instantly without manual text configurations:
                  </p>

                  <div className="grid grid-cols-2 gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-400 text-left">
                    <div><strong>Organization Code:</strong> {orgCode}</div>
                    <div><strong>Sovereign Endpoint URL:</strong> {window.location.origin}</div>
                    <div><strong>Tenant Node:</strong> {session.orgId}</div>
                    <div><strong>Version:</strong> v2.4.0-stable</div>
                  </div>

                  <button 
                    onClick={() => alert("Personalized Extension bundle downloaded. Config parameters pre-baked!")}
                    className="font-sans text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl cursor-pointer transition-colors w-full flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Download Configured Extension Package (.crx/.zip)
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: SETTINGS                                                             */}
        {/* ========================================================================= */}
        {session.role !== 'employee' && activeTab === 'settings' && (
          <div className="space-y-8 animate-fadeIn text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="font-sans font-bold text-lg text-white mb-2 flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-400" /> Core Node Config Stack
              </h2>
              <p className="font-sans text-xs text-slate-400 max-w-4xl leading-relaxed">
                View your docker daemon script and relational database schemas. Leads/Subadmins are restricted from editing root keys.
              </p>
            </div>

            {session.role === 'subadmin' ? (
              <div className="bg-slate-900 border border-amber-900/50 p-5 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="text-xs text-slate-300">
                  <strong>Read-Only Mode:</strong> You are logged in as a <strong>Team Lead / Subadmin</strong>. You have permissions to monitor and manage employees but modifying root server credentials, docker launch lines, and SQL database schemes is reserved for the primary <strong>Organization Admin</strong>.
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Docker compose card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-white">
                  <div className="bg-blue-950 border border-blue-900 p-2 rounded-lg text-blue-400">
                    <Server className="w-5 h-5" />
                  </div>
                  <h3 className="font-sans font-bold text-base">Docker Orchestration Config</h3>
                </div>
                <p className="font-sans text-xs text-slate-400 leading-relaxed">
                  The Dockerized AegisCore node operates fully within your corporate firewall. Run this container on-premise to keep all lookups strictly private.
                </p>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 font-mono text-xs text-slate-300 leading-relaxed select-all">
                  {`# AegisOne Local Filter Node\ndocker run -d --name aegis-filter \\\n  -e LICENSE_KEY="lic_org_token_9021" \\\n  -e HOST_GATEWAY="0.0.0.0" \\\n  -p 3000:3000 \\\n  aegisone/core:v2.4.0`}
                </div>
              </div>

              {/* DDL Schema card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-white">
                  <div className="bg-blue-950 border border-blue-900 p-2 rounded-lg text-blue-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <h3 className="font-sans font-bold text-base">Relational Audit Schema (PostgreSQL)</h3>
                </div>
                <p className="font-sans text-xs text-slate-400 leading-relaxed">
                  All filtered link and phishing block events are logged directly to your PostgreSQL container. Connect this table to Splunk or elasticSIEM.
                </p>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 font-mono text-xs text-slate-300 leading-relaxed select-all">
                  {`CREATE TABLE aegis_audit_events (\n  id UUID PRIMARY KEY,\n  occurred_at TIMESTAMP NOT NULL,\n  staff_id VARCHAR(128),\n  inspected_url TEXT,\n  action_verdict VARCHAR(64)\n);`}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: HELP & KNOWLEDGE BASE (REDUCES SUPPORT TICKETS)                      */}
        {/* ========================================================================= */}
        {session.role !== 'employee' && activeTab === 'help' && (
          <div className="space-y-8 animate-fadeIn text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="font-sans font-bold text-lg text-white mb-2 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#0A5ED6]" /> Help &amp; Knowledge Directory
              </h2>
              <p className="font-sans text-xs text-slate-400 max-w-4xl leading-relaxed">
                Read guide modules and FAQs designed to answer setup queries instantly. This keeps corporate administrative overhead very low.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Quick Guide Cards (7 cols) */}
              <div className="lg:col-span-7 space-y-5">
                
                {/* 1. Quick Start */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                  <h3 className="font-sans font-bold text-sm text-slate-200 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-[#0A5ED6]" /> Quick Start Guide
                  </h3>
                  <p className="font-sans text-xs text-slate-400 leading-relaxed">
                    First, configure your organization under the Setup Wizard. Second, create your departments and invite team leads. Lastly, distribute your <strong>Organization Code</strong> to employees. They can log in, download the unpacked extension, enter the code, and their browsers will automatically filter malicious links.
                  </p>
                </div>

                {/* 2. Deployment Guide */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                  <h3 className="font-sans font-bold text-sm text-slate-200 flex items-center gap-1.5">
                    <Network className="w-4 h-4 text-emerald-500" /> Deployment Instructions
                  </h3>
                  <p className="font-sans text-xs text-slate-400 leading-relaxed">
                    The local server docker container runs a light memory cache holding domain hashes. To update hashes, the local container pings the central threat registry every 24 hours. The local client requests are inspected in less than 2 milliseconds locally.
                  </p>
                </div>

                {/* 3. FAQ */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="font-sans font-bold text-sm text-slate-200">Frequently Asked Questions</h3>
                  
                  <div className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <strong className="text-slate-300 block">Do employee browser histories leave the local server?</strong>
                      <p className="text-slate-400">No. All analysis occurs entirely inside your on-premise database node. No lookup metrics are streamed outside your firewall.</p>
                    </div>
                    
                    <div className="space-y-1">
                      <strong className="text-slate-300 block">Where can employees find their login accounts?</strong>
                      <p className="text-slate-400">Admins can register employees inside the Users directory. Employees can then log in using their email addresses instantly.</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Troubleshooting (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <h3 className="font-sans font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                    <AlertCircle className="w-4 h-4 text-amber-500" /> Troubleshooting Guide
                  </h3>

                  <div className="space-y-3 text-xs leading-relaxed">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 text-left">
                      <strong className="text-slate-300 block mb-1">Extension shows "Handshake Pending"</strong>
                      <p className="text-slate-400">This occurs if the employee has not entered their matching corporate Org Code. Guide them to submit the exact token in their endpoint dashboard.</p>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 text-left">
                      <strong className="text-slate-300 block mb-1">Server connection test failing</strong>
                      <p className="text-slate-400">Verify your local node is running on port 3000 and matches the routing domain whitelisted inside your organization profile.</p>
                    </div>
                  </div>
                </div>

                {/* Direct Support Desk */}
                <div className="bg-slate-900 border border-[#0A5ED6]/30 rounded-2xl p-6 space-y-4 shadow-xl">
                  <h3 className="font-sans font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                    <MessageSquare className="w-4 h-4 text-[#0A5ED6]" /> Direct Support Desk
                  </h3>
                  <p className="font-sans text-xs text-slate-400 leading-relaxed">
                    Need immediate assistance with organization onboarding, node deployment, or Whitelist setups? Get in touch with our security support team:
                  </p>

                  <div className="space-y-3.5">
                    <a 
                      href="https://wa.me/923345216102" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3.5 p-3.5 bg-[#075E54]/10 hover:bg-[#075E54]/25 border border-[#075E54]/30 rounded-xl transition-all group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#128C7E] flex items-center justify-center text-white shrink-0">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="text-[9px] text-slate-400 block font-mono font-bold tracking-wider uppercase">WhatsApp Support Line</span>
                        <strong className="text-white text-xs font-mono group-hover:text-emerald-400 transition-colors">0334 5216102</strong>
                      </div>
                    </a>

                    <a 
                      href="mailto:araza2125012.pgc@gmail.com"
                      className="flex items-center gap-3.5 p-3.5 bg-[#0A5ED6]/10 hover:bg-[#0A5ED6]/20 border border-[#0A5ED6]/25 rounded-xl transition-all group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#0A5ED6] flex items-center justify-center text-white shrink-0">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="text-[9px] text-slate-400 block font-mono font-bold tracking-wider uppercase">Direct Support Email</span>
                        <strong className="text-white text-xs font-mono group-hover:text-[#0A5ED6] transition-colors break-all">araza2125012.pgc@gmail.com</strong>
                      </div>
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </section>
  );
}
