"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import {
  Building2, Users, Download, Upload, CheckCircle2, AlertCircle, Key, Mail,
  ShieldCheck, Activity, ArrowRight, ChevronRight, Loader2, Sparkles, UserPlus,
  Shield, Network, HardDrive, FileSpreadsheet, Lock, Check, Search, Laptop, Globe, X,
  Eye, EyeOff, Moon, Bell, Sun, Plus, Trash2, ListFilter, Table, Undo2, Edit2
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string;
  leadId?: string;
  employeeCount?: number;
}

interface Employee {
  id: string;
  employeeId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  departmentCode: string;
  role: string;
  designation?: string;
  status?: 'valid' | 'invalid';
  error?: string;
  generatedPassword?: string;
}

const STEPS = [
  { num: 1, title: 'Organization' },
  { num: 2, title: 'Review Structure' },
  { num: 3, title: 'Validation' },
  { num: 4, title: 'Security' },
  { num: 5, title: 'Rollout' },
];

const ModalPortal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
};

export default function AdminSetupPage() {
  const { user, invalidateCache } = useAuth();
  const router = useRouter();
  const API_BASE = 'http://localhost:8000';

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Step 1: Org Info
  const [isSetupCompleted, setIsSetupCompleted] = useState(false);
  const [isEditingSetup, setIsEditingSetup] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('');
  const [timezone, setTimezone] = useState('UTC+00:00 (GMT - Universal Time)');
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Step 2+: Structure
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [draggedEmployeeId, setDraggedEmployeeId] = useState<string | null>(null);
  const [visualSearch, setVisualSearch] = useState('');
  const [structureViewMode, setStructureViewMode] = useState<'visual' | 'table'>('visual');

  // Modals
  const [isAddEmpModalOpen, setIsAddEmpModalOpen] = useState(false);
  const [newEmpCustomId, setNewEmpCustomId] = useState('');
  const [newEmpFirstName, setNewEmpFirstName] = useState('');
  const [newEmpLastName, setNewEmpLastName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpDeptCode, setNewEmpDeptCode] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('Employee');

  const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
  const [newDeptNameInput, setNewDeptNameInput] = useState('');

  // SMTP Credentials
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestStatus, setSmtpTestStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestSmtp = async () => {
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      showToast('Please enter all SMTP credentials before testing.', 'error');
      return;
    }
    setTestingSmtp(true);
    setSmtpTestStatus(null);
    try {
      const res = await fetch(`${API_BASE}/setup/smtp/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpUser: smtpUser.trim(),
          smtpPass: smtpPass.trim(),
          smtpHost: smtpHost.trim(),
          smtpPort: parseInt(smtpPort, 10)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSmtpTestStatus({ success: true, message: data.message || 'SMTP Connection & Login Successful!' });
      } else {
        setSmtpTestStatus({ success: false, message: data.detail || 'SMTP Test Failed' });
      }
    } catch (e) {
      setSmtpTestStatus({ success: false, message: 'Network error connecting to SMTP server.' });
    } finally {
      setTestingSmtp(false);
    }
  };

  const [executing, setExecuting] = useState(false);
  const [dispatchDone, setDispatchDone] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const addDepartment = (name: string) => {
    if (!name.trim()) return;
    const code = name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6) || `DEPT${departments.length + 1}`;
    if (departments.some(d => d.code === code)) {
      showToast(`Department code ${code} already exists`, 'error');
      return;
    }
    const newDept: Department = { id: `dept_${Date.now()}`, name: name.trim(), code };
    setDepartments(prev => [...prev, newDept]);
    setIsAddDeptModalOpen(false);
    setNewDeptNameInput('');
    showToast(`Added department ${name}`);
  };

  const addEmployee = () => {
    if (!newEmpFirstName.trim() || !newEmpEmail.trim()) {
      showToast('First Name and Email are required', 'error');
      return;
    }

    const emailTrimmed = newEmpEmail.trim().toLowerCase();

    // Uniqueness email validation check
    const isDuplicateEmail = employees.some(e => e.email.toLowerCase() === emailTrimmed);
    if (isDuplicateEmail) {
      showToast(`Email address "${emailTrimmed}" is already assigned to another employee or admin!`, 'error');
      return;
    }

    const assignedEmpId = newEmpCustomId.trim() ? newEmpCustomId.trim().toUpperCase() : `EMP${Math.floor(100 + Math.random() * 900)}`;

    const isDuplicateId = employees.some(e => e.employeeId && e.employeeId.toUpperCase() === assignedEmpId);
    if (isDuplicateId) {
      showToast(`Employee ID "${assignedEmpId}" is already in use!`, 'error');
      return;
    }

    const newEmp: Employee = {
      id: `emp_${Date.now()}`,
      employeeId: assignedEmpId,
      firstName: newEmpFirstName.trim(),
      lastName: newEmpLastName.trim(),
      email: emailTrimmed,
      departmentCode: newEmpDeptCode || 'NONE',
      role: newEmpRole,
      status: 'valid'
    };
    setEmployees(prev => [...prev, newEmp]);
    setIsAddEmpModalOpen(false);
    setNewEmpCustomId('');
    setNewEmpFirstName('');
    setNewEmpLastName('');
    setNewEmpEmail('');
    setNewEmpDeptCode('');
    setNewEmpRole('Employee');
    showToast(`Added ${newEmpRole} ${newEmpFirstName} ${newEmpLastName}`);
  };

  const handleDeleteDepartment = (deptId: string, code: string) => {
    setDepartments(prev => prev.filter(d => d.id !== deptId));
    setEmployees(prev => prev.map(e => e.departmentCode === code ? { ...e, departmentCode: 'NONE' } : e));
    showToast('Department deleted');
  };

  const moveEmployeeToDept = (empId: string, targetDeptCode: string) => {
    setEmployees(prev => prev.map(e => e.id === empId ? { ...e, departmentCode: targetDeptCode } : e));
  };

  const handleExecuteDispatch = async () => {
    setExecuting(true);
    try {
      const res = await fetch(`${API_BASE}/setup/execute`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Setup-Key': 'aegis-setup-key-change-me'
        },
        body: JSON.stringify({
          employees,
          smtpUser,
          smtpPass,
          smtpHost,
          smtpPort: parseInt(smtpPort, 10)
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.access_token) {
          const loggedUser = { email: data.admin_email || "admin@amdevwork.com", full_name: "Administrator", role: "admin", organization_id: "org_default" };
          localStorage.setItem("aegis_access_token", data.access_token);
          localStorage.setItem("user", JSON.stringify(loggedUser));
          document.cookie = `aegis_access_token=${data.access_token}; path=/; SameSite=Lax`;
          document.cookie = `aegis_user=${encodeURIComponent(JSON.stringify(loggedUser))}; path=/; SameSite=Lax`;
        }
        setDispatchDone(true);
        setIsSetupCompleted(true);
        localStorage.setItem('aegis_setup_done', 'true');
        if (orgName) localStorage.setItem('aegis_org_name', orgName);
        invalidateCache(); // Invalidate cached dashboard stats & analytics so newly saved employees/departments load instantly!
        showToast('Rollout and credentials dispatch triggered successfully!');
      } else {
        const err = await res.json();
        showToast(err.detail || 'Dispatch failed', 'error');
      }
    } catch (e) {
      showToast('Network error executing dispatch', 'error');
    } finally {
      setExecuting(false);
    }
  };

  const handleCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return;

      const newEmployees: Employee[] = [];
      const newDeptMap = new Map<string, string>();
      const seenEmployeeIds = new Set<string>();
      const seenEmails = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
        if (cols.length < 4) continue;

        const [employeeId, firstName, lastName, email, phone, departmentCode, role, designation] = cols;
        const deptCode = (departmentCode || 'IT').toUpperCase().trim();
        const empRole = (role || 'Employee').trim();

        const cleanId = (employeeId || `EMP00${i}`).trim().toUpperCase();
        const cleanEmail = (email || `user${i}@company.com`).trim().toLowerCase();

        let status: 'valid' | 'invalid' = 'valid';
        let error = '';

        if (seenEmployeeIds.has(cleanId)) {
          status = 'invalid';
          error = `Duplicate Employee ID: ${cleanId}`;
        } else if (seenEmails.has(cleanEmail)) {
          status = 'invalid';
          error = `Duplicate Email: ${cleanEmail}`;
        }

        seenEmployeeIds.add(cleanId);
        seenEmails.add(cleanEmail);

        if (!newDeptMap.has(deptCode)) {
          let deptName = deptCode;
          if (deptCode === 'IT') deptName = 'Information Technology';
          else if (deptCode === 'DEVOPS') deptName = 'DevOps & Cloud';
          else if (deptCode === 'WEBDEV') deptName = 'Web Development';
          newDeptMap.set(deptCode, deptName);
        }

        newEmployees.push({
          id: `emp_csv_${i}_${Date.now()}`,
          employeeId: cleanId,
          firstName: firstName || 'User',
          lastName: lastName || `${i}`,
          email: cleanEmail,
          phone: phone || '',
          departmentCode: deptCode,
          role: empRole,
          designation: designation || 'Staff',
          status,
          error
        });
      }

      const currentAdmin = employees.find(e => e.role === 'Admin');
      const finalEmployees = currentAdmin ? [currentAdmin, ...newEmployees.filter(e => e.role !== 'Admin')] : newEmployees;

      const finalDepts: Department[] = Array.from(newDeptMap.entries()).map(([code, name], idx) => {
        const lead = finalEmployees.find(e => e.departmentCode === code && e.role.toLowerCase() === 'manager')?.id;
        return {
          id: `d_${code}_${idx}`,
          name,
          code,
          leadId: lead
        };
      });

      setEmployees(finalEmployees);
      setDepartments(finalDepts);
      showToast(`Uploaded CSV! Parsed ${newEmployees.length} employees across ${finalDepts.length} departments.`, 'success');
    };
    reader.readAsText(file);
  };

  // Pre-fill parameters if arriving from Onboarding Portal or logged in user
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSetupDone = localStorage.getItem('aegis_setup_done') === 'true' || dispatchDone;
      if (storedSetupDone) {
        setIsSetupCompleted(true);
      }

      const searchParams = new URLSearchParams(window.location.search);
      const orgNameParam = searchParams.get('orgName');
      const industryParam = searchParams.get('industry');
      const adminEmailParam = searchParams.get('adminEmail') || user?.email || '';
      const adminNameParam = searchParams.get('adminName') || user?.full_name || 'Administrator';
      const adminPasswordParam = searchParams.get('adminPassword');

      const activeOrgName = orgNameParam || user?.organization_name || localStorage.getItem('aegis_org_name') || '';
      if (activeOrgName) setOrgName(activeOrgName);
      if (industryParam) setIndustry(industryParam);

      if (adminEmailParam) {
        const parts = adminNameParam.split(' ');
        setEmployees(prev => [
          {
            id: 'admin_1',
            employeeId: 'ADM001',
            firstName: parts[0] || 'Admin',
            lastName: parts.slice(1).join(' ') || 'User',
            email: adminEmailParam,
            departmentCode: 'IT',
            role: 'Admin',
            status: 'valid'
          },
          ...prev.filter(e => e.role !== 'Admin')
        ]);
      }

      // Auto-authenticate session if arriving from Landing/Portal with credentials
      const fromLanding = searchParams.get('fromLanding') === 'true';
      const welcomeAlreadyShown = sessionStorage.getItem('aegis_welcome_shown') === 'true';
      if (fromLanding && !welcomeAlreadyShown) {
        setShowWelcomeModal(true);
        sessionStorage.setItem('aegis_welcome_shown', 'true');
        if (adminEmailParam && adminPasswordParam) {
          fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: adminEmailParam, password: adminPasswordParam })
          })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              if (data && data.access_token) {
                const loggedUser = data.user || { email: adminEmailParam, full_name: adminNameParam, role: 'admin', organization_id: 'org_default' };
                localStorage.setItem('aegis_access_token', data.access_token);
                localStorage.setItem('user', JSON.stringify(loggedUser));
                document.cookie = `aegis_access_token=${data.access_token}; path=/; SameSite=Lax`;
                document.cookie = `aegis_user=${encodeURIComponent(JSON.stringify(loggedUser))}; path=/; SameSite=Lax`;
              }
            })
            .catch(() => { });
        }
      }
    }
  }, [user, dispatchDone]);

  // Step validation state checks
  const hasInvalidEmployees = employees.some(e => e.status === 'invalid');
  const isStep1Valid = Boolean(orgName.trim() && industry.trim());
  const isStep2Valid = isStep1Valid && departments.length > 0 && employees.length > 0 && !hasInvalidEmployees;
  const isStep3Valid = isStep2Valid; // Validation
  const isStep4Valid = isStep3Valid && Boolean(smtpHost.trim() && smtpPort.trim() && smtpUser.trim() && smtpPass.trim());
  const isStep5Valid = isStep4Valid && dispatchDone;

  const canNavigateToStep = (targetStep: number) => {
    if (targetStep === 1) return true;
    if (targetStep === 2) return isStep1Valid;
    if (targetStep === 3) return isStep2Valid;
    if (targetStep === 4) return isStep3Valid;
    if (targetStep === 5) return isStep4Valid;
    return false;
  };

  // Calculate current progress percentage for horizontal progress bar (capped at 100%)
  const progressPercentage = Math.min(100, Math.round((step / 5) * 100));

  return (
    <div className={`space-y-8 bg-transparent text-[#0F172A] dark:text-slate-100 font-sans selection:bg-blue-100 selection:text-blue-900 ${isDark ? 'dark' : ''}`}>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[999] px-4 py-3 rounded-xl shadow-2xl text-xs font-bold text-white flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Main Content Area */}
      <main className="w-full">
        <div className="max-w-6xl mx-auto space-y-8 pb-12">

          {isSetupCompleted && !isEditingSetup && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-[#141A29] border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-extrabold text-[#0F172A] dark:text-white">Organization Setup is Active & Configured</h2>
                    <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full font-bold text-[10px] uppercase tracking-wide border border-emerald-200">
                      Provisioned
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your tenant <strong className="text-slate-700 dark:text-slate-300">{orgName || 'AegisOne'}</strong> is fully operational. Form inputs are locked to preserve data integrity.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditingSetup(true)}
                className="px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs shadow-sm flex items-center gap-2 transition-all"
              >
                <Lock className="w-3.5 h-3.5 text-amber-500" /> Re-Configure / Unlock Fields
              </button>
            </div>
          )}

          {/* Stepper Header with Horizontal Progress Bar */}
          <div className="bg-white dark:bg-[#141A29] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white">Organization Setup Engine</h3>
                <p className="text-xs text-slate-500">Step {Math.min(5, step)} of 5 — Completed ({progressPercentage}%)</p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {STEPS.map((s) => {
                  const isActive = step === s.num;
                  let isCompleted = step > s.num;

                  return (
                    <button
                      key={s.num}
                      type="button"
                      onClick={() => {
                        if (!canNavigateToStep(s.num)) {
                          showToast(`Please complete required fields before opening Step ${s.num}`, 'error');
                          return;
                        }
                        setStep(s.num);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${isActive ? 'bg-[#0A5ED6] text-white shadow-sm' : isCompleted ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                    >
                      {isCompleted ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <span>{s.num}.</span>}
                      <span>{s.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Top Horizontal Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#0A5ED6] dark:bg-[#4F84F8] h-full transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* STEP 1: ORGANIZATION PROFILE */}
          {step === 1 && (
            <div className="space-y-8 animate-fadeIn">
              <div>
                <h2 className="text-3xl font-extrabold text-[#0F172A] dark:text-white mb-2 font-display tracking-tight">Organization Profile & Environment</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Verify your company profile and deployment environment parameters before structuring your departments.</p>
              </div>

              {/* 3 Header Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-200/60 dark:border-blue-800/40 rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#0A5ED6] dark:bg-[#4F84F8] text-white flex items-center justify-center shrink-0 shadow-md">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Organization</p>
                    <p className="text-lg font-extrabold text-[#0F172A] dark:text-white truncate">{orgName || "INARA"}</p>
                    <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">{industry || "Cybersecurity"}</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deployment Engine</p>
                    <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">Docker Isolated</p>
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">v2.4.0 • Enterprise Edition</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-200/60 dark:border-indigo-800/40 rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Key className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admin Account</p>
                    <p className="text-sm font-bold text-[#0F172A] dark:text-white truncate">{employees.find(e => e.role === 'Admin')?.email || 'araza2125012.pgc@gmail.com'}</p>
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5"><CheckCircle2 className="w-3 h-3" /> Credentials Provisioned</span>
                  </div>
                </div>
              </div>

              {/* Form Card */}
              <div className="bg-white dark:bg-[#141A29] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-4">
                  <div>
                    <h3 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-[#0A5ED6] dark:text-[#4F84F8]" /> Company Identity Details
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">These parameters establish your organization's tenant configuration across all security modules.</p>
                  </div>
                  <span className="text-[11px] font-bold px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800">
                    Active Tenant
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Organization Name <span className="text-blue-600">*</span></label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={e => setOrgName(e.target.value)}
                      placeholder="INARA"
                      className="w-full bg-slate-50 dark:bg-[#0F1423] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#0F172A] dark:text-white font-semibold outline-none focus:border-[#0A5ED6]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Industry / Sector <span className="text-blue-600">*</span></label>
                    <input
                      type="text"
                      value={industry}
                      onChange={e => setIndustry(e.target.value)}
                      placeholder="e.g. Technology / Information Systems"
                      className="w-full bg-slate-50 dark:bg-[#0F1423] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#0F172A] dark:text-white font-semibold outline-none focus:border-[#0A5ED6]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Primary Timezone</label>
                    <select
                      value={timezone}
                      onChange={e => setTimezone(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0F1423] border border-slate-200 dark:border-white/[0.08] text-[#0F172A] dark:text-white rounded-xl px-4 py-3 text-sm font-semibold outline-none cursor-pointer"
                    >
                      <option value="UTC+00:00 (GMT - Universal Time)">UTC+00:00 (GMT - Universal Time)</option>
                      <option value="UTC+05:00 (PKT - Pakistan Standard Time)">UTC+05:00 (PKT - Pakistan Standard Time)</option>
                      <option value="UTC-05:00 (EST - Eastern Standard Time)">UTC-05:00 (EST - Eastern Standard Time)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Default Security Policy</label>
                    <div className="bg-slate-50 dark:bg-[#0F1423] border border-slate-200 dark:border-white/[0.08] rounded-xl p-3 flex items-center justify-between text-xs font-semibold">
                      <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Strict Real-time Scanning
                      </span>
                      <span className="text-slate-400 text-[11px]">Standard Policy</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/[0.08]">
                  <span className="text-xs text-slate-400 font-medium">Changes are automatically saved as you configure your organization.</span>
                  <button
                    disabled={!isStep1Valid}
                    onClick={() => setStep(2)}
                    className="px-8 py-3.5 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold rounded-xl text-sm transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    Verify & Continue <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW & EDIT STRUCTURE */}
          {step === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white dark:bg-[#141A29] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white shrink-0">Organization Hierarchy</h3>
                  <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full border border-blue-200 dark:border-blue-800 shrink-0">
                    {departments.length} Departments • {employees.length} Members
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* View Mode Switcher */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 mr-2">
                    <button
                      type="button"
                      onClick={() => setStructureViewMode('visual')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        structureViewMode === 'visual'
                          ? 'bg-white dark:bg-[#141A29] text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <ListFilter className="w-3.5 h-3.5" /> Visual Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setStructureViewMode('table')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        structureViewMode === 'table'
                          ? 'bg-white dark:bg-[#141A29] text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Table className="w-3.5 h-3.5" /> Editable Table
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const csvContent = "Employee ID,First Name,Last Name,Email,Department Code,Role\nEMP001,Ahmed,Raza,ahmed@company.local,IT,Manager\nEMP002,Ali,Khan,ali@company.local,HR,Employee";
                      const blob = new Blob([csvContent], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'Employee_Template.csv';
                      a.click();
                    }}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-xs flex items-center gap-1.5 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5" /> Template
                  </button>

                  <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm">
                    <Upload className="w-3.5 h-3.5" /> Upload CSV
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleCsvFile(file);
                        }
                      }}
                    />
                  </label>

                  <button onClick={() => setIsAddEmpModalOpen(true)} className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-bold rounded-lg text-xs flex items-center gap-1.5 hover:bg-emerald-100">
                    <UserPlus className="w-3.5 h-3.5" /> Add Employee
                  </button>

                  <button onClick={() => setIsAddDeptModalOpen(true)} className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-bold rounded-lg text-xs flex items-center gap-1.5 hover:bg-indigo-100">
                    <Plus className="w-3.5 h-3.5" /> Add Dept
                  </button>
                </div>
              </div>

              {/* Search filter row */}
              <div className="relative group">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 transition-transform duration-300 group-focus-within:scale-110 group-focus-within:text-blue-500" />
                <input
                  type="text"
                  value={visualSearch}
                  onChange={e => setVisualSearch(e.target.value)}
                  placeholder="Filter by name, email, department, or role..."
                  className="w-full bg-white dark:bg-[#141A29] border border-slate-200 dark:border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm font-medium transition-all duration-300"
                />
              </div>

              {/* VIEW 1: VISUAL CARDS & DRAG-DROP */}
              {structureViewMode === 'visual' && (
                <>
                  {/* Unassigned Employees Dock */}
                  {employees.filter(e => e.departmentCode === 'NONE' && e.role.toLowerCase() !== 'admin').length > 0 && (
                    <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-2">
                          <Users className="w-4 h-4 text-amber-600" /> Unassigned Employees ({employees.filter(e => e.departmentCode === 'NONE' && e.role.toLowerCase() !== 'admin').length})
                        </span>
                        <span className="text-[10px] text-amber-600 font-bold">Drag employees into a department below</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {employees.filter(e => e.departmentCode === 'NONE' && e.role.toLowerCase() !== 'admin').map(emp => (
                          <div
                            key={emp.id}
                            draggable
                            onDragStart={() => setDraggedEmployeeId(emp.id)}
                            className="flex items-center gap-2 bg-white dark:bg-[#141A29] border border-amber-300 dark:border-amber-800 rounded-xl px-3 py-1.5 shadow-sm cursor-grab active:cursor-grabbing text-xs font-bold text-slate-800 dark:text-white hover:border-amber-500"
                          >
                            <span>{emp.firstName} {emp.lastName}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 font-bold uppercase">{emp.role}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Department Nodes Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {departments.map(dept => {
                      const members = employees.filter(e => e.departmentCode === dept.code && e.role.toLowerCase() !== 'manager' && e.role.toLowerCase() !== 'admin');
                      const manager = employees.find(e => e.id === dept.leadId || (e.departmentCode === dept.code && e.role.toLowerCase() === 'manager'));

                      return (
                        <div
                          key={dept.id}
                          className="bg-white dark:bg-[#141A29] border-2 border-slate-200 dark:border-white/[0.08] rounded-2xl p-5 shadow-sm hover:border-blue-400 transition-all flex flex-col justify-between"
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => {
                            if (draggedEmployeeId) {
                              moveEmployeeToDept(draggedEmployeeId, dept.code);
                              setDraggedEmployeeId(null);
                            }
                          }}
                        >
                          <div>
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3 mb-4">
                              <input
                                value={dept.name}
                                onChange={e => {
                                  const newName = e.target.value;
                                  setDepartments(prev => prev.map(d => d.id === dept.id ? { ...d, name: newName } : d));
                                }}
                                className="w-full bg-transparent text-[#0F172A] dark:text-white text-base font-extrabold outline-none focus:bg-slate-50 dark:focus:bg-slate-800 rounded px-1"
                              />
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-mono text-xs font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-lg border border-blue-200">
                                  {dept.code}
                                </span>
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to delete ${dept.name}?`)) {
                                      handleDeleteDepartment(dept.id, dept.code);
                                    }
                                  }}
                                  className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Manager Slot */}
                            <div className="space-y-3 relative pl-3 border-l-2 border-blue-400/40 ml-2 py-1">
                              {manager ? (
                                <div
                                  draggable
                                  onDragStart={() => setDraggedEmployeeId(manager.id)}
                                  className="relative flex items-center justify-between gap-2 bg-gradient-to-r from-blue-50 to-indigo-50/30 dark:from-blue-950/40 dark:to-[#141A29] border border-blue-200 dark:border-blue-800 rounded-xl p-2.5 shadow-sm cursor-grab active:cursor-grabbing"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-extrabold text-blue-950 dark:text-blue-100 truncate">{manager.firstName} {manager.lastName}</span>
                                      <span className="text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.2 rounded uppercase">Manager</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 truncate">{manager.email}</p>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  onDragOver={e => e.preventDefault()}
                                  onDrop={() => {
                                    if (draggedEmployeeId) {
                                      setEmployees(prev => prev.map(e => e.id === draggedEmployeeId ? { ...e, role: 'Manager', departmentCode: dept.code } : e));
                                      setDepartments(prev => prev.map(d => d.id === dept.id ? { ...d, leadId: draggedEmployeeId } : d));
                                      setDraggedEmployeeId(null);
                                    }
                                  }}
                                  className="p-2.5 bg-amber-50/60 dark:bg-amber-950/20 border border-dashed border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300 font-semibold flex items-center justify-between gap-2"
                                >
                                  <span className="flex items-center gap-1.5 text-xs font-bold">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" /> Drag Manager Here
                                  </span>
                                </div>
                              )}

                              {/* Members Sub-list */}
                              <div className="space-y-2 pt-1">
                                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Department Members ({members.length})</p>
                                <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                                  {members.map(emp => (
                                    <div
                                      key={emp.id}
                                      draggable
                                      onDragStart={() => setDraggedEmployeeId(emp.id)}
                                      className="flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing bg-slate-50 dark:bg-[#141A29] border border-slate-200 dark:border-white/[0.08] rounded-xl p-2"
                                    >
                                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{emp.firstName} {emp.lastName}</span>
                                      <select
                                        value={emp.role.toLowerCase()}
                                        onChange={e => {
                                          const newRole = e.target.value === 'manager' ? 'Manager' : 'Employee';
                                          setEmployees(prev => prev.map(item => item.id === emp.id ? { ...item, role: newRole } : item));
                                        }}
                                        className="text-[10px] font-bold bg-white dark:bg-[#0F1423] border border-slate-200 rounded px-1.5 py-0.5 outline-none cursor-pointer"
                                      >
                                        <option value="employee">Employee</option>
                                        <option value="manager">Manager</option>
                                      </select>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* VIEW 2: HIGH-CAPACITY EDITABLE TABULAR VIEW */}
              {structureViewMode === 'table' && (
                <div className="bg-white dark:bg-[#141A29] border border-slate-200 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto max-h-[520px] custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-100 dark:bg-[#0F1423] border-b border-slate-200 dark:border-white/[0.08] text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-4">EMPLOYEE NUMBER / ID</th>
                          <th className="py-3 px-4">NAME</th>
                          <th className="py-3 px-4">EMAIL</th>
                          <th className="py-3 px-4">DEPARTMENT</th>
                          <th className="py-3 px-4">ROLE</th>
                          <th className="py-3 px-4 text-right">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {employees
                          .filter(emp => {
                            if (!visualSearch.trim()) return true;
                            const query = visualSearch.toLowerCase();
                            return (
                              emp.firstName.toLowerCase().includes(query) ||
                              emp.lastName.toLowerCase().includes(query) ||
                              emp.email.toLowerCase().includes(query) ||
                              (emp.employeeId && emp.employeeId.toLowerCase().includes(query)) ||
                              emp.departmentCode.toLowerCase().includes(query) ||
                              emp.role.toLowerCase().includes(query)
                            );
                          })
                          .map((emp) => (
                            <tr key={emp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="py-2.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                                <div className="flex items-center gap-1 group/cell">
                                  <input
                                    type="text"
                                    value={emp.employeeId || ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setEmployees(prev => prev.map(item => item.id === emp.id ? { ...item, employeeId: val } : item));
                                    }}
                                    className="w-24 bg-transparent outline-none border-b border-transparent focus:border-blue-500 font-mono font-bold"
                                  />
                                  <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                                </div>
                              </td>
                              <td className="py-2.5 px-4">
                                <div className="flex gap-1.5 items-center group/cell">
                                  <input
                                    type="text"
                                    value={emp.firstName}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setEmployees(prev => prev.map(item => item.id === emp.id ? { ...item, firstName: val } : item));
                                    }}
                                    className="w-24 bg-transparent outline-none font-bold text-slate-900 dark:text-white border-b border-transparent focus:border-blue-500"
                                  />
                                  <input
                                    type="text"
                                    value={emp.lastName}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setEmployees(prev => prev.map(item => item.id === emp.id ? { ...item, lastName: val } : item));
                                    }}
                                    className="w-24 bg-transparent outline-none text-slate-700 dark:text-slate-300 border-b border-transparent focus:border-blue-500"
                                  />
                                  <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                                </div>
                              </td>
                              <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                                <div className="flex items-center gap-1 group/cell">
                                  <input
                                    type="email"
                                    value={emp.email}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setEmployees(prev => prev.map(item => item.id === emp.id ? { ...item, email: val } : item));
                                    }}
                                    className="w-56 bg-transparent outline-none border-b border-transparent focus:border-blue-500 font-mono"
                                  />
                                  <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                                </div>
                              </td>
                              <td className="py-2.5 px-4">
                                {emp.role.toLowerCase() === 'admin' ? (
                                  <span className="px-2 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded font-bold text-[11px]">Organization</span>
                                ) : (
                                  <select
                                    value={emp.departmentCode}
                                    onChange={e => {
                                      const newDept = e.target.value;
                                      setEmployees(prev => prev.map(item => item.id === emp.id ? { ...item, departmentCode: newDept } : item));
                                    }}
                                    className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                                  >
                                    <option value="NONE">Unassigned</option>
                                    {departments.map(d => (
                                      <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
                                    ))}
                                  </select>
                                )}
                              </td>
                              <td className="py-2.5 px-4">
                                {emp.role.toLowerCase() === 'admin' ? (
                                  <span className="px-2 py-1 bg-purple-600 text-white rounded font-bold text-[10px] uppercase">Admin</span>
                                ) : (
                                  <select
                                    value={emp.role.toLowerCase()}
                                    onChange={e => {
                                      const newRole = e.target.value === 'manager' ? 'Manager' : 'Employee';
                                      setEmployees(prev => prev.map(item => item.id === emp.id ? { ...item, role: newRole } : item));
                                    }}
                                    className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                                  >
                                    <option value="employee">Employee</option>
                                    <option value="manager">Manager</option>
                                  </select>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                {emp.role.toLowerCase() !== 'admin' && (
                                  <button
                                    onClick={() => {
                                      setEmployees(prev => prev.filter(item => item.id !== emp.id));
                                      showToast(`Removed employee ${emp.firstName}`);
                                    }}
                                    className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                                    title="Delete Employee"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-6 border-t border-slate-200 dark:border-white/[0.08]">
                <button onClick={() => setStep(1)} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm">Back</button>
                <button onClick={() => setStep(3)} className="px-8 py-3.5 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold rounded-xl text-sm shadow-lg flex items-center gap-2">Verify & Continue <ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {/* STEP 3: VALIDATION */}
          {step === 3 && (() => {
            const seenIds = new Set<string>();
            const dupIds = new Set<string>();
            const seenEmails = new Set<string>();
            const dupEmails = new Set<string>();

            employees.forEach(e => {
              const cleanId = (e.employeeId || '').trim().toUpperCase();
              const cleanEmail = (e.email || '').trim().toLowerCase();

              if (cleanId) {
                if (seenIds.has(cleanId)) dupIds.add(cleanId);
                else seenIds.add(cleanId);
              }

              if (cleanEmail) {
                if (seenEmails.has(cleanEmail)) dupEmails.add(cleanEmail);
                else seenEmails.add(cleanEmail);
              }
            });

            const errorCount = employees.filter(e => {
              const cleanId = (e.employeeId || '').trim().toUpperCase();
              const cleanEmail = (e.email || '').trim().toLowerCase();
              return (cleanId && dupIds.has(cleanId)) || (cleanEmail && dupEmails.has(cleanEmail)) || e.departmentCode === 'NONE';
            }).length;

            const validCount = employees.length - errorCount;

            return (
              <div className="space-y-6 animate-fadeIn">
                <div className="bg-white dark:bg-[#141A29] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-[#0F172A] dark:text-white mb-1">Preview Import & Verification</h2>
                    <p className="text-xs text-slate-500">Review data integrity and department manager assignments before writing to PostgreSQL.</p>
                  </div>
                  <div className="flex items-center gap-4 text-center">
                    <div className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200">
                      <span className="text-xs font-bold text-slate-400 uppercase block">Total Parsed</span>
                      <span className="text-lg font-black text-blue-600 dark:text-blue-400">{employees.length}</span>
                    </div>
                    <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl border border-emerald-200">
                      <span className="text-xs font-bold text-slate-400 uppercase block">Valid</span>
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{validCount}</span>
                    </div>
                    <div className={`px-3 py-1 rounded-xl border ${errorCount > 0 ? 'bg-red-50 dark:bg-red-950/40 border-red-200 text-red-600 dark:text-red-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 text-slate-400'}`}>
                      <span className="text-xs font-bold uppercase block">Errors</span>
                      <span className="text-lg font-black">{errorCount}</span>
                    </div>
                  </div>
                </div>

                {/* Data Verification Table (Scrollable after 10 items) */}
                <div className="bg-white dark:bg-[#141A29] border border-slate-200 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto max-h-[480px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-50 dark:bg-[#0F1423] border-b border-slate-200 dark:border-white/[0.08] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-4">EMPLOYEE NUMBER / ID</th>
                          <th className="py-3 px-4">NAME</th>
                          <th className="py-3 px-4">EMAIL</th>
                          <th className="py-3 px-4">DEPT</th>
                          <th className="py-3 px-4">ROLE</th>
                          <th className="py-3 px-4 text-right">STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {employees.map((emp) => {
                          const cleanId = (emp.employeeId || '').trim().toUpperCase();
                          const cleanEmail = (emp.email || '').trim().toLowerCase();

                          const isDupId = Boolean(cleanId && dupIds.has(cleanId));
                          const isDupEmail = Boolean(cleanEmail && dupEmails.has(cleanEmail));
                          const isUnassigned = emp.departmentCode === 'NONE';

                          const isRowInvalid = isDupId || isDupEmail || isUnassigned;
                          const errorLabel = isDupId ? 'DUPLICATE ID' : isDupEmail ? 'DUPLICATE EMAIL' : 'NO DEPT';

                          return (
                            <tr key={emp.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${isRowInvalid ? 'bg-red-50/20 dark:bg-red-950/20' : ''}`}>
                              <td className="py-3 px-4 font-mono font-bold text-slate-500">{emp.employeeId || 'N/A'}</td>
                              <td className="py-3 px-4 font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                                {emp.firstName} {emp.lastName}
                                {emp.role.toLowerCase() === 'admin' && (
                                  <span className="px-1.5 py-0.2 bg-purple-600 text-white rounded text-[9px] font-bold uppercase">Admin</span>
                                )}
                                {emp.role.toLowerCase() === 'manager' && (
                                  <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded text-[9px] font-bold uppercase">Manager</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono">{emp.email}</td>
                              <td className="py-3 px-4 font-bold text-blue-600 dark:text-blue-400">{emp.departmentCode}</td>
                              <td className="py-3 px-4 text-slate-500 capitalize">{emp.role}</td>
                              <td className="py-3 px-4 text-right">
                                {isRowInvalid ? (
                                  <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 rounded-full font-bold text-[10px] uppercase">
                                    {errorLabel}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-full font-bold text-[10px] uppercase">
                                    VALID
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-between pt-6 border-t border-slate-200 dark:border-white/[0.08]">
                  <button onClick={() => setStep(2)} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm">Back</button>
                  <button
                    onClick={() => {
                      if (errorCount > 0) {
                        showToast(`Cannot proceed: ${errorCount} employee(s) have duplicate IDs or unassigned departments! Please fix them in Step 2.`, 'error');
                        return;
                      }
                      setStep(4);
                    }}
                    disabled={errorCount > 0}
                    className={`px-8 py-3.5 font-bold rounded-xl text-sm shadow-lg flex items-center gap-2 transition-all ${errorCount > 0 ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-[#0A5ED6] hover:bg-[#0B63E0] text-white'}`}
                  >
                    Import {validCount} Valid Employees <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* STEP 4: SECURITY CREDENTIALS (SMTP) */}
          {step === 4 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white mb-1">Security & SMTP Credentials</h2>
                  <p className="text-sm text-slate-500">Configure outbound SMTP credentials to dispatch user welcome packages.</p>
                </div>
                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={testingSmtp}
                  className="px-5 py-2.5 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-lg disabled:opacity-50 shrink-0"
                >
                  {testingSmtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4 text-white" />}
                  {testingSmtp ? "Testing Connection..." : "Test SMTP Connection"}
                </button>
              </div>

              <div className="bg-white dark:bg-[#141A29] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">SMTP Host</label>
                    <input type="text" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0F1423] border rounded-xl text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">SMTP Port</label>
                    <input type="number" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0F1423] border rounded-xl text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Sender Email / Username</label>
                    <input type="email" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="e.g. admin@company.com" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0F1423] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm font-medium mt-1 outline-none focus:border-[#0A5ED6]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">SMTP App Password</label>
                    <div className="relative mt-1">
                      <input
                        type={showSmtpPass ? "text" : "password"}
                        value={smtpPass}
                        onChange={e => setSmtpPass(e.target.value)}
                        placeholder="Enter 16-character App Password"
                        className="w-full px-4 py-2.5 pr-11 bg-slate-50 dark:bg-[#0F1423] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm font-semibold outline-none focus:border-[#0A5ED6]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmtpPass(!showSmtpPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                      >
                        {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {smtpTestStatus && (
                  <div className={`mt-4 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                    smtpTestStatus.success 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                      : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                  }`}>
                    {smtpTestStatus.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
                    <span>{smtpTestStatus.message}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-6 border-t border-slate-200 dark:border-white/[0.08]">
                <button onClick={() => setStep(3)} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm">Back</button>
                <button onClick={() => setStep(6)} className="px-8 py-3.5 bg-[#0A5ED6] text-white font-bold rounded-xl text-sm shadow-lg flex items-center gap-2">Continue to Rollout <ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {/* STEP 6: ROLLOUT & DISPATCH */}
          {step === 6 && (
            <div className="space-y-6 text-center py-8 animate-fadeIn">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-extrabold text-[#0F172A] dark:text-white">Send Credentials to All Employees</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">Send credentials to all employees and activate browser extension protection policy for your organization.</p>

              <div className="pt-6">
                {dispatchDone ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-700 font-bold rounded-xl max-w-md mx-auto">
                      Email Dispatch Completed Successfully!
                    </div>
                    <button
                      onClick={() => router.push('/dashboard/admin')}
                      className="px-8 py-4 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold rounded-xl text-sm shadow-xl"
                    >
                      Go to Admin Dashboard
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-center gap-4">
                    <button
                      disabled={executing}
                      onClick={() => setStep(4)}
                      className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      disabled={executing}
                      onClick={handleExecuteDispatch}
                      className="px-10 py-4 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold rounded-xl text-base transition-all shadow-xl flex items-center gap-2 disabled:opacity-50"
                    >
                      {executing ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                      {executing ? 'Executing Dispatch...' : 'Start Dispatch & Provision Accounts'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Add Dept Modal */}
      {isAddDeptModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={{ zIndex: 9999 }}>
            <div className="bg-white dark:bg-[#141A29] p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
              <h4 className="text-base font-bold text-[#0F172A] dark:text-white">Add New Department</h4>
              <input
                type="text"
                value={newDeptNameInput}
                onChange={e => setNewDeptNameInput(e.target.value)}
                placeholder="Department Name"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0F1423] border border-slate-200 rounded-xl text-sm"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsAddDeptModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500">Cancel</button>
                <button onClick={() => addDepartment(newDeptNameInput)} className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg">Add Department</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Add Employee Modal */}
      {isAddEmpModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={{ zIndex: 9999 }}>
            <div className="bg-white dark:bg-[#141A29] p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl">
              <h4 className="text-base font-bold text-[#0F172A] dark:text-white">Add New Employee</h4>

              <input
                type="text"
                placeholder="Employee ID (Optional, e.g. EMP102)"
                value={newEmpCustomId}
                onChange={e => setNewEmpCustomId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0F1423] border border-slate-200 dark:border-white/[0.08] rounded-lg text-sm font-semibold"
              />

              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="First Name *" value={newEmpFirstName} onChange={e => setNewEmpFirstName(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-[#0F1423] border border-slate-200 dark:border-white/[0.08] rounded-lg text-sm" />
                <input type="text" placeholder="Last Name" value={newEmpLastName} onChange={e => setNewEmpLastName(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-[#0F1423] border border-slate-200 dark:border-white/[0.08] rounded-lg text-sm" />
              </div>

              <input type="email" placeholder="Email Address *" value={newEmpEmail} onChange={e => setNewEmpEmail(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0F1423] border border-slate-200 dark:border-white/[0.08] rounded-lg text-sm font-mono" />

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Role Assignment</label>
                  <select value={newEmpRole} onChange={e => setNewEmpRole(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0F1423] border border-slate-200 dark:border-white/[0.08] rounded-lg text-sm font-bold text-slate-800 dark:text-white">
                    <option value="Employee">Employee Role</option>
                    <option value="Manager">Manager Role</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Department Assignment</label>
                  <select value={newEmpDeptCode} onChange={e => setNewEmpDeptCode(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0F1423] border border-slate-200 dark:border-white/[0.08] rounded-lg text-sm font-semibold truncate">
                    <option value="">Unassigned (Select Department Later)</option>
                    {departments.map(d => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.08]">
                <button onClick={() => setIsAddEmpModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                <button onClick={addEmployee} className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all shadow-sm">Add Member</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Welcome Setup Popup Modal */}
      {showWelcomeModal && (
        <ModalPortal>
          <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" style={{ zIndex: 9999 }}>
            <div className="bg-white dark:bg-[#141A29] border border-slate-200 dark:border-white/[0.08] p-8 rounded-3xl max-w-lg w-full space-y-6 shadow-2xl relative text-center">
              <button
                onClick={() => setShowWelcomeModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
                <Sparkles className="w-8 h-8 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-extrabold text-[#0F172A] dark:text-white font-display">
                  Welcome to AegisOne!
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Let's set up <strong className="text-blue-600 dark:text-blue-400 font-bold">{orgName || 'your organization'}</strong> in a few simple steps. Your profile parameters from registration have been automatically synchronized.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-[#0F1423]/60 rounded-2xl p-4 text-left border border-slate-100 dark:border-white/[0.08] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Target Organization</span>
                  <span className="font-bold text-slate-800 dark:text-white">{orgName || 'Not specified'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Industry Sector</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{industry || 'Not specified'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Admin Account</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{employees.find(e => e.role === 'Admin')?.email}</span>
                </div>
              </div>

              <button
                onClick={() => setShowWelcomeModal(false)}
                className="w-full py-4 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold rounded-2xl text-sm transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-2"
              >
                Start Setup Engine Now <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
