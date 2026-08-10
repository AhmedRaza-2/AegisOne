import React, { useState, useEffect } from 'react';
import {
  Building2, Users, Download, Upload, CheckCircle2, AlertCircle, Key, Mail,
  ShieldCheck, Activity, ArrowRight, ChevronRight, Loader2, Sparkles, UserPlus,
  Shield, Network, HardDrive, FileSpreadsheet, Lock, Check, Search, Laptop, Globe, X,
  Eye, EyeOff, Moon, Bell, Sun, Plus, Trash2, ListFilter, Table, Undo2
} from 'lucide-react';
import { useSetupStore, Department, Employee, SetupStep } from './store/setupStore';
import { TableMode } from './components/TableMode';

interface ActivationStatus {
  emailSent: boolean;
  firstLogin: boolean;
  extensionInstalled: boolean;
  deviceRegistered: boolean;
  status: 'Active' | 'Pending' | 'Install Extension';
}

export default function App() {
  const { 
    step, setStep, 
    departments, setDepartments, 
    employees, setEmployees, 
    undoStack, redoStack, undo, redo, pushHistory,
    toast, hideToast, showToast,
    sessionId, setSessionId
  } = useSetupStore();
  const [loading, setLoading] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const API_BASE = 'http://localhost:8000';

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Step 1: Org Info (Pre-filled from Docker Environment Variables)
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('');
  const [timezone, setTimezone] = useState('UTC+00:00');
  const [configLoaded, setConfigLoaded] = useState(false);

  // Step 2+: Departments are inferred from the uploaded employee CSV
  const [draggedEmployeeId, setDraggedEmployeeId] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editingEmployeeName, setEditingEmployeeName] = useState('');
  const [editingDraft, setEditingDraft] = useState<Partial<Employee> | null>(null);

  // Step 3 & 4: Employees
  const [fileUploaded, setFileUploaded] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  
  // Adaptive Density & History
  const [structureViewMode, setStructureViewMode] = useState<'visual' | 'table'>('visual');

  // Merge Departments State
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSourceCode, setMergeSourceCode] = useState('');
  const [mergeTargetCode, setMergeTargetCode] = useState('');

  // Push state to undo stack is handled by zustand now

  // Fast lookup maps for Visual Mode
  const [visualSearch, setVisualSearch] = useState('');
  
  const visualEmployeesByDept = React.useMemo(() => {
    const map = new Map<string, Employee[]>();
    map.set('NONE', []);
    departments.forEach(d => map.set(d.code, []));
    
    const query = visualSearch.toLowerCase().trim();
    
    employees.forEach(emp => {
      if (emp.role.toLowerCase() === 'admin') return;
      
      if (query) {
        const searchable = `${emp.firstName} ${emp.lastName} ${emp.email}`.toLowerCase();
        if (!searchable.includes(query)) return;
      }
      
      const deptList = map.get(emp.departmentCode);
      if (deptList) {
        deptList.push(emp);
      } else {
        const unassignedList = map.get('NONE');
        if (unassignedList) unassignedList.push(emp);
      }
    });
    return map;
  }, [employees, departments, visualSearch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, departments, employees]);


  // Read URL parameters from Onboarding Landing Portal
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const orgNameParam = searchParams.get('orgName');
    const industryParam = searchParams.get('industry');
    const adminEmailParam = searchParams.get('adminEmail');
    const adminNameParam = searchParams.get('adminName') || 'Administrator';

    if (orgNameParam) setOrgName(orgNameParam);
    if (industryParam) setIndustry(industryParam);

    if (adminEmailParam) {
      const nameParts = adminNameParam.split(' ');
      const fName = nameParts[0] || 'Admin';
      const lName = nameParts.slice(1).join(' ') || 'User';
      const adminPasswordParam = searchParams.get('adminPassword');
      const pass = adminPasswordParam || Math.random().toString(36).slice(-8) + 'X#1';

      setEmployees([
        {
          id: 'admin_initial',
          employeeId: 'ADM001',
          firstName: fName,
          lastName: lName,
          email: adminEmailParam,
          phone: '03000000000',
          departmentCode: 'IT',
          role: 'Admin',
          designation: 'System Administrator',
          status: 'valid',
          generatedPassword: pass,
        }
      ]);
      setFileUploaded(true);
    }

    fetch(`${API_BASE}/setup/session/org_default`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !data.state) return;
        const state = data.state;
        
        if (state.orgName) setOrgName(state.orgName);
        if (state.departments && Array.isArray(state.departments)) {
          setDepartments(state.departments);
        }
        if (state.employees && Array.isArray(state.employees) && state.employees.length > 0) {
          if (!adminEmailParam) {
            setEmployees(state.employees);
          } else {
            // Keep the admin but restore others
            setEmployees(prev => {
              const admin = prev.find(e => e.role === 'admin');
              return admin ? [admin, ...state.employees.filter((e: any) => e.role !== 'admin')] : state.employees;
            });
          }
          setFileUploaded(true);
        }
        if (state.step && !adminEmailParam) {
           setStep(state.step);
        }
      })
      .catch((err) => console.error('Failed to load persisted session', err))
      .finally(() => setConfigLoaded(true));
  }, []);

  // Step 7: Rollout Status
  const [rolloutActive, setRolloutActive] = useState(false);
  const [dispatchDone, setDispatchDone] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [emailResults, setEmailResults] = useState<Record<string, { sent: boolean; error?: string }>>({});

  // SMTP credentials (filled in by the admin before dispatching welcome emails)
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    try {
      const response = await fetch(`${API_BASE}/setup/smtp/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost: smtpHost,
          smtpPort: parseInt(smtpPort, 10),
          smtpUser: smtpUser,
          smtpPass: smtpPass
        })
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        showToast('SMTP Connection Successful', 'success');
      } else {
        showToast(data.detail || 'SMTP Connection Failed', 'error');
      }
    } catch (e) {
      showToast('Network error during SMTP test', 'error');
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const pollEmailStatus = (runId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`http://localhost:8000/setup/email-status/${runId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.done) {
            const byEmail: Record<string, { sent: boolean; error?: string }> = {};
            for (const r of data.results || []) {
              byEmail[r.email] = { sent: r.sent, error: r.error };
            }
            setEmailResults(byEmail);
            setDispatchDone(true);
            return;
          }
        }
      } catch (err) {
        console.error('Failed to poll email status', err);
      }
      setTimeout(() => poll(), 2000);
    };
    poll();
  };

  // Debounced Autosave Ref variables
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const saveStructure = (nextDepartments = departments, nextEmployees = employees) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setIsSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`${API_BASE}/setup/structure/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId: 'org_default',
            orgName,
            departments: nextDepartments.map(d => ({
              id: d.id,
              name: d.name,
              code: d.code,
              managerEmail: nextEmployees.find(e => e.id === d.leadId)?.email || null,
            })),
            employees: nextEmployees,
          }),
        });

        if (sessionId) {
          await fetch(`${API_BASE}/setup/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              state: {
                step,
                orgName,
                departments: nextDepartments,
                employees: nextEmployees
              }
            }),
          });
        }
      } catch (err) {
        console.error('Failed to save structure', err);
      } finally {
        setIsSaving(false);
      }
    }, 800);
  };

  const handleNextStep = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 800)); // Fake network delay
    setStep((s) => Math.min(s + 1, 8) as SetupStep);
    setLoading(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const codeToName = (code: string) => {
    const normalized = code.toUpperCase().trim();
    const map: Record<string, string> = {
      IT: 'Information Technology',
      HR: 'Human Resources',
      FIN: 'Finance',
      OPS: 'Operations',
      SALES: 'Sales',
      LEGAL: 'Legal',
      ADMIN: 'Administration',
    };
    return map[normalized] || normalized || 'General';
  };

  const handleBulkReassign = async (empIds: string[], deptCode: string) => {
    setEmployees(empPrev => {
      pushHistory(departments, empPrev);
      const nextEmps = empPrev.map(e => empIds.includes(e.id) ? { ...e, departmentCode: deptCode } : e);
      saveStructure(departments, nextEmps);
      return nextEmps;
    });
    
    showToast(`Moved ${empIds.length} employees to ${deptCode}`, 'success', undo);

    try {
      await fetch(`${API_BASE}/setup/structure/bulk-reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeIds: empIds, targetDepartmentCode: deptCode })
      });
    } catch (e) {
      console.error("Bulk reassign delta failed", e);
    }
  };

  const handleMergeDepartments = async () => {
    if (!mergeSourceCode || !mergeTargetCode || mergeSourceCode === mergeTargetCode) return;
    
    setDepartments(prev => {
      setEmployees(empPrev => {
        pushHistory(prev, empPrev);
        const nextEmps = empPrev.map(e => e.departmentCode === mergeSourceCode ? { ...e, departmentCode: mergeTargetCode } : e);
        const nextDepts = prev.filter(d => d.code !== mergeSourceCode);
        saveStructure(nextDepts, nextEmps);
        return nextEmps;
      });
      return prev.filter(d => d.code !== mergeSourceCode);
    });

    setIsMergeModalOpen(false);
    setMergeSourceCode('');
    setMergeTargetCode('');

    try {
      await fetch(`${API_BASE}/setup/structure/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDeptCode: mergeSourceCode, targetDeptCode: mergeTargetCode })
      });
    } catch (e) {
      console.error("Merge delta failed", e);
    }
  };

  const rebuildDepartmentsFromEmployees = (rows: Employee[]) => {
    const seen = new Map<string, Department>();
    rows.forEach((row, index) => {
      const rawName = (row.departmentCode || 'General').trim();
      const code = rawName.toUpperCase();
      if (!seen.has(code)) {
        seen.set(code, {
          id: `dept_${code.replace(/[^A-Z0-9]+/g, '_')}_${index}`,
          name: rawName || codeToName(code),
          code,
        });
      }
    });
    const next = Array.from(seen.values());
    setDepartments(next);
    
    // Auto-switch to table mode if large dataset
    if (rows.length >= 40) {
      setStructureViewMode('table');
    }
    
    saveStructure(next, rows.filter(row => row.status === 'valid' && row.email.includes('@')));
  };

  const renameDepartment = (deptId: string, name: string) => {
    setDepartments(prev => {
      let oldCode = '';
      let newCode = '';

      const nextDepts = prev.map(dept => {
        if (dept.id === deptId) {
          oldCode = dept.code;
          
          // Generate a base code from the new name
          const tokens = name.replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
          let baseCode = 'GEN';
          if (tokens.length === 1) baseCode = tokens[0].substring(0, 4).toUpperCase();
          else if (tokens.length > 1) baseCode = tokens.slice(0, 4).map(t => t[0]).join('').toUpperCase();
          if (!baseCode) baseCode = `DPT`;

          newCode = baseCode;
          
          // Ensure uniqueness
          let counter = 1;
          while (prev.some(d => d.id !== deptId && d.code === newCode)) {
            newCode = `${baseCode}${counter}`;
            counter++;
          }

          return { ...dept, name, code: newCode };
        }
        return dept;
      });

      if (oldCode && newCode && oldCode !== newCode) {
        setEmployees(empPrev => {
          pushHistory(prev, empPrev);
          const nextEmps = empPrev.map(e => e.departmentCode === oldCode ? { ...e, departmentCode: newCode } : e);
          saveStructure(nextDepts, nextEmps);
          return nextEmps;
        });
      } else {
        pushHistory(prev, employees);
        saveStructure(nextDepts, employees);
      }
      
      return nextDepts;
    });
  };

  const handleAddDepartment = () => {
    const id = crypto.randomUUID();
    const newDept: Department = {
      id,
      name: 'New Department',
      code: `DPT_${Math.floor(Math.random() * 1000)}`
    };
    setDepartments(prev => {
      const next = [newDept, ...prev];
      void saveStructure(next, employees);
      return next;
    });
  };

  const handleDeleteDepartment = (deptId: string, deptCode: string) => {
    const nextEmps = employees.map(emp => emp.departmentCode === deptCode ? { ...emp, departmentCode: 'NONE' } : emp);
    const nextDepts = departments.filter(d => d.id !== deptId);
    setEmployees(nextEmps);
    setDepartments(nextDepts);
    void saveStructure(nextDepts, nextEmps);
  };

  const updateEmployee = (employeeId: string, updates: Partial<Employee>) => {
    setEmployees(prev => {
      const next = prev.map(emp => emp.id === employeeId ? { ...emp, ...updates } : emp);
      void saveStructure(undefined, next);
      return next;
    });
  };

  const moveEmployeeToDept = (employeeId: string, deptCode: string) => {
    updateEmployee(employeeId, { departmentCode: deptCode });
  };

  const assignManager = (deptId: string, employeeId: string) => {
    setDepartments(prev => {
      const next = prev.map(dept => dept.id === deptId ? { ...dept, leadId: employeeId } : dept);
      void saveStructure(next, employees);
      return next;
    });
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    let csvContent = "Employee ID,First Name,Last Name,Email,Phone Number,Department Code,Role,Designation\n";

    if (departments.length > 0) {
      csvContent += departments.map((dept, idx) => {
        const id = `EMP00${idx + 1}`;
        const fName = `Sample`;
        const lName = `User${idx + 1}`;
        const role = idx === 0 ? 'Manager' : 'Employee';
        return `${id},${fName},${lName},user${idx + 1}@company.local,0300123456${idx},${dept.code},${role},Staff Member`;
      }).join('\n');
    } else {
      csvContent += "EMP001,Ahmed,Raza,ahmed@company.local,03001234567,IT,Employee,Software Engineer\nEMP002,Ali,Khan,ali@company.local,03001234568,HR,Manager,HR Lead";
    }
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Employee_Template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');

      if (lines.length < 2) {
        setLoading(false);
        return; // Empty or just headers
      }

      const parsedEmployees: Employee[] = [];
      const seenEmails = new Set<string>();
      const seenEmployeeIds = new Set<string>();
      let adminCount = 0;

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        // Parse CSV handling potential quotes
        const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) || [];

        if (cols.length < 6) continue;

        const [employeeId, firstName, lastName, email, phone, departmentCode, role, designation] = cols;

        const departmentValue = (departmentCode || '').trim();
        const departmentKey = departmentValue.toUpperCase();

        let status: 'valid' | 'invalid' = 'valid';
        let error = '';

        const allowedRoles = ['employee', 'manager', 'admin'];
        const normalizedRole = (role || '').toLowerCase().trim();

        if (normalizedRole === 'admin') {
          adminCount++;
        }

        if (!email) {
          status = 'invalid';
          error = 'Email not populated';
        } else if (!email.includes('@')) {
          status = 'invalid';
          error = 'Invalid Email Format';
        } else if (seenEmails.has(email)) {
          status = 'invalid';
          error = 'Duplicate Email';
        } else if (employeeId && seenEmployeeIds.has(employeeId)) {
          status = 'invalid';
          error = 'Duplicate Employee ID';
        } else if (!departmentKey && normalizedRole !== 'admin') {
          status = 'invalid';
          error = 'Department is required';
        } else if (!allowedRoles.includes(normalizedRole)) {
          status = 'invalid';
          error = `Invalid Role: Must be Employee, Manager, or Admin`;
        } else if (normalizedRole === 'admin' && adminCount > 1) {
          status = 'invalid';
          error = `Only 1 Admin allowed in the organization`;
        }

        if (email) seenEmails.add(email);
        if (employeeId) seenEmployeeIds.add(employeeId);

        parsedEmployees.push({
          id: Math.random().toString(),
          employeeId: employeeId || `EMP${i}`,
          firstName: firstName || 'Unknown',
          lastName: lastName || 'User',
          email: email || '',
          phone: phone || '',
          departmentCode: departmentKey || 'NONE',
          role: role || 'Employee',
          designation: designation || '',
          status,
          error
        });
      }

      setTimeout(() => {
        setEmployees(prev => {
          const existingAdmin = prev.find(e => e.id === 'admin_initial');
          if (existingAdmin && !parsedEmployees.some(e => e.role.toLowerCase() === 'admin')) {
            const merged = [existingAdmin, ...parsedEmployees];
            rebuildDepartmentsFromEmployees(merged.filter(e => e.role.toLowerCase() !== 'admin'));
            return merged;
          }
          rebuildDepartmentsFromEmployees(parsedEmployees.filter(e => e.role.toLowerCase() !== 'admin'));
          return parsedEmployees;
        });
        setFileUploaded(true);
        setLoading(false);
      }, 800);
    };
    reader.readAsText(file);
    // reset input so same file can be uploaded again if needed
    e.target.value = '';
  };

  const validEmployees = employees.filter(e => e.status === 'valid');
  const invalidEmployees = employees.filter(e => e.status === 'invalid');

  const generatePasswordsAndMails = () => {
    setLoading(true);
    setTimeout(() => {
      setEmployees(prev => prev.map(e => ({
        ...e,
        generatedPassword: e.generatedPassword || (e.status === 'valid' ? Math.random().toString(36).slice(-10) + 'X#' : undefined)
      })));
      setStep(6);
      setLoading(false);
    }, 2000);
  };

  const STEPS = [
    { num: 1, title: 'Organization' },
    { num: 2, title: 'Import Employees' },
    { num: 3, title: 'Review Structure' },
    { num: 4, title: 'Validation' },
    { num: 5, title: 'Assign Managers' },
    { num: 6, title: 'Security' },
    { num: 7, title: 'Rollout' },
  ];

  return (
    <div className={`flex h-screen overflow-hidden bg-[#F8FAFC] dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 font-sans selection:bg-blue-100 selection:text-blue-900 ${isDark ? 'dark' : ''}`}>

      {toast.visible && (
        <div className="fixed bottom-4 right-4 z-[999] animate-in slide-in-from-bottom-2 fade-in duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
            toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300' :
            toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300' :
            'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
          }`}>
            <span className="text-sm font-semibold">{toast.message}</span>
            {toast.action && (
              <button 
                onClick={() => {
                  toast.action!();
                  hideToast();
                }}
                className="font-bold underline text-sm hover:opacity-80 transition-opacity ml-2 flex items-center gap-1"
              >
                <Undo2 className="w-4 h-4" /> Undo
              </button>
            )}
            <button onClick={hideToast} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}


      {/* Sidebar (Left) */}
      <aside className="w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex-col hidden lg:flex shrink-0 z-10 transition-colors">
        <div className="h-20 flex flex-col justify-center px-6 shrink-0 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-[#0A5ED6] dark:text-[#4F84F8]">AegisOne</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Setup Engine</span>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Progress</span>
            <span className="text-xs font-bold text-[#0A5ED6] dark:text-[#4F84F8]">{Math.round((step / 7) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#0A5ED6] dark:bg-[#4F84F8] transition-all duration-500 ease-out"
              style={{ width: `${Math.round((step / 7) * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar py-4">
          <h3 className="px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Setup Steps</h3>
          <nav className="space-y-1">
            {STEPS.map((s) => {
              const isActive = step === s.num;
              const isPast = step > s.num;
              return (
                <div
                  key={s.num}
                  className={`w-full flex items-center gap-3 px-6 py-3 text-[13px] font-medium transition-all ${isActive
                    ? "bg-slate-100 dark:bg-slate-800/50 text-[#0F172A] dark:text-white border-l-2 border-[#0A5ED6] dark:border-[#4F84F8]"
                    : isPast
                      ? "text-[#0F172A] dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 border-l-2 border-transparent"
                      : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/30 border-l-2 border-transparent"
                    }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${isPast ? 'bg-emerald-500 text-white' :
                    isActive ? 'bg-[#0A5ED6] dark:bg-[#4F84F8] text-white' :
                      'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}>
                    {isPast ? <Check className="w-3 h-3" /> : s.num}
                  </div>
                  <span>{s.title}</span>
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="h-20 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-end px-6 shrink-0 z-10 transition-colors">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDark(!isDark)}
              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2 hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 hidden sm:inline">System Status:</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Docker Connected
              </span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto w-full transition-colors pb-12">

            {/* STEP 1: ORGANIZATION INFO */}
            {step === 1 && (
              <div className="animate-fadeIn grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-16">
                <div className="lg:col-span-1">
                  <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white mb-2">Organization Information</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Let's verify your company's core identity imported from your Docker deployment command.</p>
                </div>

                <div className="lg:col-span-2">
                  {!configLoaded ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <Loader2 className="w-8 h-8 text-[#0A5ED6] animate-spin" />
                      <p className="text-sm text-slate-500 font-semibold animate-pulse">Reading environment variables from Docker container...</p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 relative">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                            Organization Name
                          </label>
                          <input type="text" value={orgName} readOnly className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-700 dark:text-slate-300 font-semibold outline-none cursor-not-allowed" />
                        </div>
                        <div className="space-y-2 relative">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                            Industry
                          </label>
                          <input type="text" value={industry} readOnly className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-700 dark:text-slate-300 font-semibold outline-none cursor-not-allowed" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Timezone</label>
                          <select value={timezone} onChange={e => setTimezone(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:text-slate-200 rounded-xl px-4 py-3 text-sm focus:border-[#0A5ED6] dark:focus:border-[#4F84F8] outline-none">
                            <option>UTC+00:00 (GMT)</option>
                            <option>UTC+05:00 (PKT)</option>
                            <option>UTC-05:00 (EST)</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                        <button onClick={handleNextStep} disabled={loading} className="flex items-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md">
                          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verify & Continue <ArrowRight className="w-4 h-4" /></>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: IMPORT EMPLOYEES */}
            {step === 2 && (
              <div className="animate-fadeIn grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-16">
                <div className="lg:col-span-1">
                  <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white mb-2">Import Employees First</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Upload employee.csv and the setup will infer departments automatically, so you can edit structure after the import instead of building it twice.</p>
                </div>

                <div className="lg:col-span-2 flex flex-col justify-center">
                  <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <button onClick={() => setStep(1)} className="text-slate-500 dark:text-slate-400 font-semibold hover:text-[#0F172A] dark:hover:text-white text-sm">Back</button>
                    <button onClick={handleNextStep} disabled={loading || employees.length === 0} className="flex items-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md disabled:opacity-50">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Review Structure <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: REVIEW STRUCTURE */}
            {step === 3 && (
              <div className="animate-fadeIn space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white mb-2">Review and Edit Structure</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Drag employees into departments and rename departments inline.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1 bg-blue-50 dark:bg-slate-900 border border-blue-100 dark:border-slate-800 rounded-2xl p-6">
                    <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-4">
                      <FileSpreadsheet className="w-7 h-7 text-blue-600 dark:text-[#4F84F8]" />
                    </div>
                    <h3 className="font-bold text-[#0F172A] dark:text-white mb-2">1. Upload employee.csv</h3>
                    <p className="text-sm text-blue-800 dark:text-slate-300 mb-5">The upload step infers departments automatically, so you only edit what the CSV actually contains.</p>
                    <button onClick={handleDownloadTemplate} className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-blue-200 dark:border-slate-700 text-blue-700 dark:text-slate-200 font-bold px-4 py-2.5 rounded-lg hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors text-sm w-full cursor-pointer shadow-sm mb-4">
                      <Download className="w-4 h-4" /> Download Template
                    </button>
                    <input
                      type="file"
                      accept=".csv"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-900 dark:bg-[#0A5ED6] text-white font-bold px-4 py-2.5 rounded-lg hover:bg-black dark:hover:bg-[#0B63E0] transition-colors text-sm">
                      {employees.length > 0 ? 'Replace CSV File' : 'Select CSV File'}
                    </button>
                  </div>

                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-[#0F172A] dark:text-white">Departments</h3>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 dark:text-slate-400">{departments.length} inferred departments</span>
                          <button onClick={() => setIsMergeModalOpen(true)} className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2.5 py-1.5 rounded-md transition-colors" disabled={departments.length < 2}>
                            Merge
                          </button>
                          <button onClick={handleAddDepartment} className="flex items-center gap-1 text-xs font-bold text-[#0A5ED6] dark:text-[#4F84F8] hover:text-[#0B63E0] dark:hover:text-[#6A96F9] bg-[#0A5ED6]/10 dark:bg-[#4F84F8]/10 hover:bg-[#0A5ED6]/20 dark:hover:bg-[#4F84F8]/20 px-2.5 py-1.5 rounded-md transition-colors">
                            <Plus className="w-3.5 h-3.5" /> Add Dept
                          </button>
                          <button
                            onClick={() => {
                              const headers = ['Employee ID', 'First Name', 'Last Name', 'Email', 'Department Code', 'Role', 'Status'];
                              const rows = employees.map(e => [e.employeeId, e.firstName, e.lastName, e.email, e.departmentCode, e.role, e.status].join(','));
                              const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join("\n");
                              const encodedUri = encodeURI(csvContent);
                              const link = document.createElement("a");
                              link.setAttribute("href", encodedUri);
                              link.setAttribute("download", "aegisone_structure.csv");
                              document.body.appendChild(link);
                              link.click();
                              link.remove();
                            }}
                            className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2.5 py-1.5 rounded-md transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> Export CSV
                          </button>
                        </div>
                      </div>
                      
                      {/* Structure View Mode Toggle */}
                      <div className="flex justify-between items-center bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 mb-4">
                        <button
                          onClick={() => setStructureViewMode('visual')}
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${structureViewMode === 'visual' ? 'bg-[#0A5ED6] text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                          <ListFilter className="w-4 h-4" /> Visual Mode
                        </button>
                        <button
                          onClick={() => setStructureViewMode('table')}
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${structureViewMode === 'table' ? 'bg-[#0A5ED6] text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                          <Table className="w-4 h-4" /> Table Mode
                        </button>
                      </div>

                      {structureViewMode === 'visual' && (
                        <div className="space-y-4">
                          <div className="relative mb-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                              type="text" 
                              placeholder="Search employees..." 
                              value={visualSearch}
                              onChange={e => setVisualSearch(e.target.value)}
                              className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-[#0A5ED6] dark:text-white transition-colors"
                            />
                          </div>
                          
                        {(() => {
                          const unassigned = visualEmployeesByDept.get('NONE') || [];
                          if (unassigned.length === 0) return null;
                          return (
                            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 rounded-xl p-3 mb-4">
                              <h4 className="text-xs font-bold text-red-600 dark:text-red-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" /> Unassigned Employees ({unassigned.length})
                              </h4>
                              <div className="flex flex-wrap gap-2 min-h-12"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => {
                                  if (draggedEmployeeId) {
                                    moveEmployeeToDept(draggedEmployeeId, 'NONE');
                                    setDraggedEmployeeId(null);
                                  }
                                }}
                              >
                                {unassigned.map(emp => (
                                  <div
                                    key={emp.id}
                                    draggable={editingEmployeeId !== emp.id}
                                    onDragStart={() => {
                                      if (editingEmployeeId !== emp.id) setDraggedEmployeeId(emp.id);
                                    }}
                                    onDoubleClick={() => {
                                      setEditingEmployeeId(emp.id);
                                      setEditingEmployeeName(`${emp.firstName} ${emp.lastName}`.trim());
                                    }}
                                    className="flex items-center gap-2 cursor-grab rounded-full border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 p-1 pr-3 shadow-sm hover:shadow-md transition-shadow select-none"
                                  >
                                    <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                                      {(emp.firstName?.[0] || 'U')}{(emp.lastName?.[0] || '')}
                                    </div>
                                    {editingEmployeeId === emp.id ? (
                                      <input
                                        autoFocus
                                        value={editingEmployeeName}
                                        onChange={(e) => setEditingEmployeeName(e.target.value)}
                                        onBlur={() => {
                                          const parts = editingEmployeeName.trim().split(' ');
                                          updateEmployee(emp.id, {
                                            firstName: parts[0] || 'User',
                                            lastName: parts.slice(1).join(' ') || ''
                                          });
                                          setEditingEmployeeId(null);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            const parts = editingEmployeeName.trim().split(' ');
                                            updateEmployee(emp.id, {
                                              firstName: parts[0] || 'User',
                                              lastName: parts.slice(1).join(' ') || ''
                                            });
                                            setEditingEmployeeId(null);
                                          } else if (e.key === 'Escape') {
                                            setEditingEmployeeId(null);
                                          }
                                        }}
                                        className="text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none rounded px-1 w-24"
                                      />
                                    ) : (
                                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                        {emp.firstName} {emp.lastName}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        {departments.map(dept => (
                          <div
                            key={dept.id}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (draggedEmployeeId) {
                                moveEmployeeToDept(draggedEmployeeId, dept.code);
                                setDraggedEmployeeId(null);
                              }
                            }}
                          >
                            <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-700/50 pb-2">
                              <div className="flex items-center gap-3">
                                <input
                                  value={dept.name}
                                  onChange={(e) => renameDepartment(dept.id, e.target.value)}
                                  className="w-64 max-w-[200px] sm:max-w-xs bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-[#0F172A] dark:text-white rounded-lg px-2 py-1 text-sm font-bold outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#0A5ED6] dark:focus:border-[#4F84F8] transition-all"
                                  placeholder="Department Name"
                                />
                                <span className="font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-md">{dept.code}</span>
                              </div>
                              <button onClick={() => handleDeleteDepartment(dept.id, dept.code)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-1.5 rounded-md transition-colors" title="Delete Department">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2 min-h-12">
                              {(visualEmployeesByDept.get(dept.code) || []).map(emp => (
                                <div
                                  key={emp.id}
                                  draggable={editingEmployeeId !== emp.id}
                                  onDragStart={() => {
                                    if (editingEmployeeId !== emp.id) setDraggedEmployeeId(emp.id);
                                  }}
                                  onDoubleClick={() => {
                                    setEditingEmployeeId(emp.id);
                                    setEditingEmployeeName(`${emp.firstName} ${emp.lastName}`.trim());
                                  }}
                                  className="flex items-center gap-2 cursor-grab rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 pr-3 shadow-sm hover:shadow-md transition-shadow select-none"
                                >
                                  <div className="w-6 h-6 rounded-full bg-[#0A5ED6]/10 text-[#0A5ED6] dark:bg-[#4F84F8]/20 dark:text-[#4F84F8] flex items-center justify-center text-[10px] font-bold shrink-0">
                                    {(emp.firstName?.[0] || 'U')}{(emp.lastName?.[0] || '')}
                                  </div>
                                  {editingEmployeeId === emp.id ? (
                                    <input
                                      autoFocus
                                      value={editingEmployeeName}
                                      onChange={(e) => setEditingEmployeeName(e.target.value)}
                                      onBlur={() => {
                                        const parts = editingEmployeeName.trim().split(' ');
                                        updateEmployee(emp.id, {
                                          firstName: parts[0] || 'User',
                                          lastName: parts.slice(1).join(' ') || ''
                                        });
                                        setEditingEmployeeId(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const parts = editingEmployeeName.trim().split(' ');
                                          updateEmployee(emp.id, {
                                            firstName: parts[0] || 'User',
                                            lastName: parts.slice(1).join(' ') || ''
                                          });
                                          setEditingEmployeeId(null);
                                        } else if (e.key === 'Escape') {
                                          setEditingEmployeeId(null);
                                        }
                                      }}
                                      className="text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none rounded px-1 w-24"
                                    />
                                  ) : (
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                      {emp.firstName} {emp.lastName}
                                    </span>
                                  )}
                                </div>
                              ))}
                              {(visualEmployeesByDept.get(dept.code) || []).length === 0 && (
                                <div className="text-xs text-slate-400 dark:text-slate-500">Drop employees here</div>
                              )}
                            </div>
                          </div>
                        ))}
                        {departments.length === 0 && (
                          <div className="flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                            <div className="w-12 h-12 bg-blue-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-3">
                              <FileSpreadsheet className="w-6 h-6 text-[#0A5ED6] dark:text-[#4F84F8]" />
                            </div>
                            <h4 className="font-bold text-[#0F172A] dark:text-white mb-1">No Departments Yet</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Upload your employee CSV file, and we will automatically create and map your departments.</p>
                          </div>
                        )}
                      </div>
                      )}
                    </div>


                    {structureViewMode === 'table' ? (
                      <TableMode 
                        employees={employees} 
                        departments={departments}
                        onMoveEmployee={moveEmployeeToDept}
                        onBulkMove={handleBulkReassign}
                      />
                    ) : (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                        <h3 className="font-bold text-[#0F172A] dark:text-white mb-3">Employees</h3>
                        <div className="max-h-[260px] overflow-auto space-y-2">
                          {employees.map(emp => (
                            <div key={emp.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-950">
                              <div>
                                <p className="font-semibold text-sm text-[#0F172A] dark:text-slate-200">{emp.firstName} {emp.lastName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{emp.email} • {emp.role}</p>
                              </div>
                              {emp.role.toLowerCase() === 'admin' ? (
                                <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg">Global</span>
                              ) : (
                                <select
                                  value={emp.departmentCode}
                                  onChange={(e) => moveEmployeeToDept(emp.id, e.target.value)}
                                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 text-xs outline-none"
                                >
                                  <option value="NONE">No Department</option>
                                  {departments.map(dept => <option key={dept.id} value={dept.code}>{dept.code}</option>)}
                                </select>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Validation Summary & Continue Button */}
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center sticky bottom-0 bg-[#f8fafc] dark:bg-[#0f172a] pb-6 z-20">
                  <button onClick={() => setStep(2)} className="text-slate-500 dark:text-slate-400 font-semibold hover:text-[#0F172A] dark:hover:text-white text-sm">Back</button>
                  <div className="flex items-center gap-6">
                    {(() => {
                      const unassigned = employees.filter(e => e.departmentCode === 'NONE' && e.role.toLowerCase() !== 'admin').length;
                      const assigned = employees.length - unassigned;
                      const emptyDepts = departments.filter(d => employees.filter(e => e.departmentCode === d.code).length === 0).length;
                      
                      return (
                        <div className="hidden lg:flex items-center gap-4 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-1.5 shadow-sm">
                          <div className={`flex items-center gap-1.5 ${unassigned > 0 ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                            <span className={`w-2 h-2 rounded-full ${unassigned > 0 ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                            {unassigned} unassigned
                          </div>
                          <div className="w-px h-3 bg-slate-200 dark:bg-slate-700"></div>
                          <div className={`flex items-center gap-1.5 ${emptyDepts > 0 ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'}`}>
                            <span className={`w-2 h-2 rounded-full ${emptyDepts > 0 ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                            {emptyDepts} empty {emptyDepts === 1 ? 'dept' : 'depts'}
                          </div>
                          <div className="w-px h-3 bg-slate-200 dark:bg-slate-700"></div>
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            {assigned} assigned
                          </div>
                        </div>
                      );
                    })()}
                    
                    <button 
                      onClick={() => setStep(4)} 
                      disabled={employees.filter(e => e.departmentCode === 'NONE' && e.role.toLowerCase() !== 'admin').length > 0}
                      className="flex items-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continue to Validation <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Merge Departments Modal */}
                {isMergeModalOpen && (
                  <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl w-full max-w-md animate-in slide-in-from-bottom-4">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-[#0F172A] dark:text-white">Merge Departments</h3>
                        <button onClick={() => setIsMergeModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div className="space-y-4 mb-6">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Source Department</label>
                          <select 
                            value={mergeSourceCode} 
                            onChange={e => setMergeSourceCode(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none dark:text-white"
                          >
                            <option value="">Select source...</option>
                            {departments.map(d => <option key={d.code} value={d.code} disabled={d.code === mergeTargetCode}>{d.name} ({d.code})</option>)}
                          </select>
                          <p className="text-xs text-slate-500 mt-1">This department will be deleted.</p>
                        </div>
                        
                        <div className="flex justify-center text-slate-400">
                          <ArrowRight className="w-5 h-5 rotate-90" />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Department</label>
                          <select 
                            value={mergeTargetCode} 
                            onChange={e => setMergeTargetCode(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none dark:text-white"
                          >
                            <option value="">Select target...</option>
                            {departments.map(d => <option key={d.code} value={d.code} disabled={d.code === mergeSourceCode}>{d.name} ({d.code})</option>)}
                          </select>
                          <p className="text-xs text-slate-500 mt-1">All employees will be moved here.</p>
                        </div>
                      </div>
                      
                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button 
                          onClick={() => setIsMergeModalOpen(false)}
                          className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleMergeDepartments}
                          disabled={!mergeSourceCode || !mergeTargetCode}
                          className="px-4 py-2 text-sm font-bold bg-[#0A5ED6] text-white rounded-lg hover:bg-[#0B63E0] disabled:opacity-50"
                        >
                          Merge
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: VALIDATION PREVIEW */}
            {step === 4 && (
              <div className="animate-fadeIn space-y-6">
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                  <div>
                    <h3 className="text-lg font-bold text-[#0F172A] dark:text-white">Preview Import</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Review data integrity before writing to PostgreSQL.</p>
                  </div>
                  <div className="flex gap-6 text-center">
                    <div>
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{employees.length}</p>
                      <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Total Parsed</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-emerald-500 dark:text-emerald-400">{validEmployees.length}</p>
                      <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Valid</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-red-500 dark:text-red-400">{invalidEmployees.length}</p>
                      <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Errors</p>
                    </div>
                  </div>
                </div>

                {invalidEmployees.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-red-800 dark:text-red-300 flex items-center gap-2 mb-3"><AlertCircle className="w-4 h-4" /> Validation Errors Found</h4>
                    <ul className="space-y-2">
                      {invalidEmployees.map(emp => (
                        <li key={emp.id} className="text-xs text-red-700 dark:text-red-200 bg-white dark:bg-red-900/50 px-3 py-2 rounded border border-red-100 dark:border-red-800 flex justify-between">
                          <span><strong>{emp.firstName} {emp.lastName}</strong> ({emp.email})</span>
                          <span className="font-bold uppercase tracking-wider">{emp.error}</span>
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => { setPreviewMode(false); setStep(3); }} className="mt-4 text-xs font-bold text-red-700 dark:text-red-400 underline hover:text-red-900 dark:hover:text-red-300">Upload corrected file</button>
                  </div>
                )}

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-sm relative">
                      <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">ID</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Name</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Email</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Dept</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Role</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {employees.map(emp => {
                          const isEditing = editingEmployeeId === emp.id;
                          return (
                            <tr 
                              key={emp.id} 
                              onDoubleClick={() => {
                                setEditingEmployeeId(emp.id);
                                setEditingDraft(emp);
                              }}
                              className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${emp.status === 'invalid' ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
                            >
                              <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400 text-xs">
                                {isEditing ? (
                                  <input 
                                    className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-1"
                                    value={editingDraft?.employeeId || ''}
                                    onChange={e => setEditingDraft(prev => ({ ...prev, employeeId: e.target.value }))}
                                  />
                                ) : emp.employeeId}
                              </td>
                              <td className="px-4 py-3 font-semibold text-[#0F172A] dark:text-slate-200">
                                {isEditing ? (
                                  <div className="flex gap-1">
                                    <input 
                                      className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-1"
                                      value={editingDraft?.firstName || ''}
                                      onChange={e => setEditingDraft(prev => ({ ...prev, firstName: e.target.value }))}
                                      placeholder="First"
                                    />
                                    <input 
                                      className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-1"
                                      value={editingDraft?.lastName || ''}
                                      onChange={e => setEditingDraft(prev => ({ ...prev, lastName: e.target.value }))}
                                      placeholder="Last"
                                    />
                                  </div>
                                ) : `${emp.firstName} ${emp.lastName}`}
                              </td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                {isEditing ? (
                                  <input 
                                    className="w-32 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-1"
                                    value={editingDraft?.email || ''}
                                    onChange={e => setEditingDraft(prev => ({ ...prev, email: e.target.value }))}
                                  />
                                ) : emp.email}
                              </td>
                              <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400 font-bold">
                                {isEditing ? (
                                  <select
                                    className="w-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-1"
                                    value={editingDraft?.departmentCode || 'NONE'}
                                    onChange={e => setEditingDraft(prev => ({ ...prev, departmentCode: e.target.value }))}
                                  >
                                    <option value="NONE">NONE</option>
                                    {departments.map(d => <option key={d.code} value={d.code}>{d.code}</option>)}
                                  </select>
                                ) : (
                                  emp.role.toLowerCase() === 'admin' ? <span className="uppercase">GLOBAL</span> : emp.departmentCode
                                )}
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 capitalize">
                                {isEditing ? (
                                  <select
                                    className="w-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-1"
                                    value={editingDraft?.role?.toLowerCase() || 'employee'}
                                    onChange={e => setEditingDraft(prev => ({ ...prev, role: e.target.value }))}
                                  >
                                    <option value="employee">Employee</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                ) : emp.role}
                              </td>
                              <td className="px-4 py-3">
                                {isEditing ? (
                                  <div className="flex gap-2 items-center">
                                    <button 
                                      onClick={() => {
                                        updateEmployee(emp.id, editingDraft || {});
                                        // Auto-revalidate the employee
                                        setEmployees(prev => prev.map(e => {
                                          if (e.id === emp.id) {
                                            const updated = { ...e, ...editingDraft };
                                            const allowedRoles = ['employee', 'manager', 'admin'];
                                            let err = undefined;
                                            let st: 'valid' | 'invalid' = 'valid';
                                            if (!updated.email || !updated.email.includes('@')) { st = 'invalid'; err = 'Invalid Email Format'; }
                                            else if (!updated.departmentCode || updated.departmentCode === 'NONE') { st = 'invalid'; err = 'Department is required'; }
                                            return { ...updated, status: st, error: err };
                                          }
                                          return e;
                                        }));
                                        setEditingEmployeeId(null);
                                      }}
                                      className="bg-emerald-500 hover:bg-emerald-600 text-white rounded px-2 py-0.5 text-[10px] font-bold"
                                    >
                                      SAVE
                                    </button>
                                    <button 
                                      onClick={() => setEditingEmployeeId(null)}
                                      className="text-slate-400 hover:text-slate-600"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  emp.status === 'valid' ? 
                                    <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase"><CheckCircle2 className="w-3 h-3" /> Valid</span> :
                                    <span className="inline-flex items-center gap-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase" title={emp.error}><AlertCircle className="w-3 h-3" /> Error</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <button onClick={() => { setPreviewMode(false); setStep(3); }} className="text-slate-500 dark:text-slate-400 font-semibold hover:text-[#0F172A] dark:hover:text-white text-sm">Back</button>
                  <button
                    onClick={handleNextStep}
                    disabled={invalidEmployees.length > 0 || validEmployees.length === 0 || loading}
                    className="flex items-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Import {validEmployees.length} Valid Employees <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: ASSIGN MANAGERS */}
            {step === 5 && (
              <div className="animate-fadeIn space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white mb-2">Review Department Managers</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">We have automatically selected managers based on your imported data. Review them below and click Save. Managers have access to department-level threat reports.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {departments.map(dept => {
                    const deptEmployees = validEmployees.filter(e => e.departmentCode === dept.code);
                    const potentialManagers = deptEmployees.filter(e => e.role.toLowerCase() === 'manager');
                    const defaultManager = potentialManagers[0];

                    return (
                      <div key={dept.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-[#0F172A] dark:text-white">{dept.name}</h4>
                          <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500 dark:text-slate-300">{dept.code}</span>
                        </div>
                        {potentialManagers.length > 0 ? (
                          <select
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:border-[#0A5ED6] dark:focus:border-[#4F84F8] outline-none cursor-pointer"
                            value={dept.leadId || defaultManager?.id || ""}
                            onChange={(e) => {
                              setDepartments(departments.map(d => d.id === dept.id ? { ...d, leadId: e.target.value } : d));
                            }}
                          >
                            <option value="">Select Manager...</option>
                            <option value="SKIP">Skip — assign later</option>
                            {potentialManagers.map(e => (
                              <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.designation})</option>
                            ))}
                          </select>
                        ) : (
                          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col items-center text-center">
                            {dept.leadId === 'SKIP' ? (
                              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Skipped</span>
                            ) : (
                              <>
                                <span className="text-slate-400 dark:text-slate-500 text-xs mb-2">No managers found in this department.</span>
                                <button
                                  onClick={() => setDepartments(departments.map(d => d.id === dept.id ? { ...d, leadId: 'SKIP' } : d))}
                                  className="text-xs font-bold text-[#0A5ED6] dark:text-[#4F84F8] hover:underline"
                                >
                                  Skip — assign later
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <button onClick={() => setStep(4)} className="text-slate-500 dark:text-slate-400 font-semibold hover:text-[#0F172A] dark:hover:text-white text-sm">Back</button>
                  <button 
                    onClick={() => {
                      // Commit any auto-selected managers to state before proceeding
                      const nextDepts = departments.map(dept => {
                        if (!dept.leadId) {
                          const deptEmployees = validEmployees.filter(e => e.departmentCode === dept.code);
                          const defaultManager = deptEmployees.find(e => e.role.toLowerCase() === 'manager');
                          if (defaultManager) {
                            return { ...dept, leadId: defaultManager.id };
                          }
                        }
                        return dept;
                      });
                      setDepartments(nextDepts);
                      saveStructure(nextDepts, employees);
                      generatePasswordsAndMails();
                    }} 
                    disabled={loading} 
                    className="flex items-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Save Assignments <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 6: ACCOUNT GENERATION & SECURITY */}
            {step === 6 && (
              <div className="animate-fadeIn space-y-8 text-center py-4">
                <h2 className="text-3xl font-bold text-[#0F172A] dark:text-white mb-4">Generate Secure Accounts</h2>
                <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed mb-8">
                  AegisOne will generate secure 14-character passwords for {validEmployees.length} employees and dispatch welcome emails containing temporary credentials.
                </p>

                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-lg mx-auto text-left space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Automated Actions Queue</h4>
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400"><div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 ml-1.5 mr-1" /> Hash & Store secure passwords to local DB</div>
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400"><div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 ml-1.5 mr-1" /> Generate Temporary Login Tokens</div>
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400"><div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 ml-1.5 mr-1" /> Dispatch {validEmployees.length} Email Invitations</div>
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400"><div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 ml-1.5 mr-1" /> Enable Force-Password-Change policy</div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-lg mx-auto text-left">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-2"><Mail className="w-4 h-4" /> SMTP Sender Credentials</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Required to dispatch welcome emails with temporary credentials to your employees.</p>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">SMTP User (sender email) <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        placeholder="youremail@gmail.com"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0A5ED6] dark:focus:border-[#4F84F8]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">SMTP Password / App Password <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input
                          type={showSmtpPass ? 'text' : 'password'}
                          value={smtpPass}
                          onChange={(e) => setSmtpPass(e.target.value)}
                          placeholder="••••••••••••••••"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-lg px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#0A5ED6] dark:focus:border-[#4F84F8]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSmtpPass((v) => !v)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          aria-label={showSmtpPass ? 'Hide password' : 'Show password'}
                        >
                          {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">SMTP Host <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                          placeholder="smtp.gmail.com"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0A5ED6] dark:focus:border-[#4F84F8]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Port <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(e.target.value)}
                          placeholder="587"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0A5ED6] dark:focus:border-[#4F84F8]"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400">For Gmail, use an App Password (requires 2-Step Verification enabled).</p>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <button onClick={() => setStep(5)} className="text-slate-500 dark:text-slate-400 font-semibold hover:text-[#0F172A] dark:hover:text-white text-sm">Back</button>
                  <div className="flex items-center gap-4">
                    {(!smtpUser || !smtpPass || !smtpHost || !smtpPort) && (
                      <span className="text-xs font-bold text-red-500 hidden sm:flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> SMTP credentials are required
                      </span>
                    )}
                    <button
                      onClick={handleTestSmtp}
                      disabled={!smtpUser || !smtpPass || isTestingSmtp}
                      className="px-4 py-2.5 rounded-lg text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                    >
                      {isTestingSmtp ? 'Testing...' : 'Test Connection'}
                    </button>
                    <button
                      onClick={async () => {
                        setLoading(true);
                        setDispatchDone(false);
                        setDispatchError(null);
                        try {
                          const response = await fetch('http://localhost:8000/setup/execute', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              employees: validEmployees,
                              smtpUser: smtpUser || undefined,
                              smtpPass: smtpPass || undefined,
                              smtpHost: smtpHost || undefined,
                              smtpPort: smtpPort ? parseInt(smtpPort, 10) : undefined,
                            })
                          });

                          if (response.ok) {
                            const data = await response.json();
                            if (data.run_id) {
                              pollEmailStatus(data.run_id);
                            } else {
                              setDispatchDone(true);
                            }
                            setRolloutActive(true);
                            setStep(7);
                          } else {
                            setDispatchError((await response.text()) || 'Failed to execute setup');
                            console.error('Failed to execute setup');
                          }
                        } catch (err) {
                          setDispatchError('Network error during setup execution. Check that the API is running.');
                          console.error('Network error during setup execution', err);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading || !smtpUser || !smtpPass || !smtpHost || !smtpPort}
                      className="inline-flex items-center gap-2 bg-[#0F172A] dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-700 text-white font-bold px-10 py-4 rounded-xl transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Executing Security Protocol...</> : <><ShieldCheck className="w-5 h-5" /> Execute & Send Welcome Emails</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 7: EMPLOYEE ACTIVATION STATUS (ROLLOUT) */}
            {step === 7 && (
              <div className="animate-fadeIn space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white mb-2 flex items-center gap-2">
                      <Activity className="w-6 h-6 text-emerald-500" /> Email Dispatch Status
                    </h2>
                    {dispatchDone ? (
                      <p className="text-slate-500 dark:text-slate-400 text-sm">Welcome email dispatch finished. Review the delivery results below.</p>
                    ) : (
                      <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500 dark:text-blue-400" /> Dispatching welcome emails in the background...
                      </p>
                    )}
                    {dispatchError && (
                      <p className="text-red-600 dark:text-red-400 text-sm font-semibold mt-2">Setup failed: {dispatchError}</p>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setStep(6)} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold px-6 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">
                      Back
                    </button>
                    <button onClick={() => window.location.href = 'http://localhost:3002/login'} className="flex items-center gap-2 bg-slate-900 dark:bg-blue-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-black dark:hover:bg-blue-700 transition-colors text-sm">
                      Go to Full Dashboard <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Employees</p>
                    <p className="text-2xl font-bold text-[#0F172A] dark:text-white">{validEmployees.length}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Emails Sent</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {dispatchDone ? Object.values(emailResults).filter(r => r.sent).length : '...'}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Emails Failed</p>
                    <p className="text-2xl font-bold text-red-500 dark:text-red-400">
                      {dispatchDone ? Object.values(emailResults).filter(r => !r.sent).length : '...'}
                    </p>
                  </div>
                </div>

                {/* Status Table */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-sm relative">
                      <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Employee</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-center">Email Sent</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {validEmployees.map(emp => {
                          const result = emailResults[emp.email];
                          const sent = result ? result.sent : undefined;
                          return (
                            <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="px-6 py-4">
                                <p className="font-semibold text-[#0F172A] dark:text-slate-200">{emp.firstName} {emp.lastName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{emp.email}</p>
                                {sent === false && result?.error && (
                                  <p className="text-[11px] text-red-500 mt-1 break-all">{result.error}</p>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                {sent === true ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                                ) : sent === false ? (
                                  <AlertCircle className="w-5 h-5 text-red-500 mx-auto" />
                                ) : (
                                  <Loader2 className="w-4 h-4 animate-spin text-slate-300 mx-auto" />
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {sent === true ? (
                                  <span className="inline-flex bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full text-xs font-bold uppercase">Dispatched</span>
                                ) : sent === false ? (
                                  <span className="inline-flex bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-3 py-1 rounded-full text-xs font-bold uppercase">Failed</span>
                                ) : (
                                  <span className="inline-flex bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold uppercase">Pending</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {dispatchDone && Object.values(emailResults).some(r => !r.sent) && (
                  <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-500" />
                    <div>
                      <p className="font-bold">Some welcome emails could not be delivered.</p>
                      <p className="text-amber-700 dark:text-amber-300/80 mt-1">
                        Verify the <span className="font-mono">SMTP_USER</span> / <span className="font-mono">SMTP_PASS</span> in the backend <span className="font-mono">.env</span> file. For Gmail, use a valid App Password (requires 2-Step Verification enabled on the account) and restart the API.
                      </p>
                    </div>
                  </div>
                )}


              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

