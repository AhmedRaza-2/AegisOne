import React, { useState, useEffect } from 'react';
import {
  Building2, Users, Download, Upload, CheckCircle2, AlertCircle, Key, Mail,
  ShieldCheck, Activity, ArrowRight, ChevronRight, Loader2, Sparkles, UserPlus,
  Shield, Network, HardDrive, FileSpreadsheet, Lock, Check, Search, Laptop, Globe, X,
  Eye, EyeOff, Moon, Bell, Sun, Plus, Trash2, ListFilter, Table, Undo2
} from 'lucide-react';
import { useSetupStore, Department, Employee, SetupStep } from './store/setupStore';
import { TableMode } from './components/TableMode';
import { markSetupCompleted } from './lib/firebase';

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
  // Dynamic API_BASE: use the same hostname as the setup wizard, but port 8000
  // This ensures it works on any machine when deployed via Docker
  const API_BASE = (() => {
    if (typeof window === 'undefined') return 'http://localhost:8000';
    const host = window.location.hostname;
    // If localhost or 127.0.0.1, use direct localhost connection
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8000';
    // On a networked machine, use the same IP but port 8000
    return `http://${host}:8000`;
  })();

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
  
  // Adaptive Density & History — persisted to localStorage so view survives reload
  const [structureViewMode, _setStructureViewMode] = useState<'visual' | 'table'>(() => {
    try { return (localStorage.getItem('aegis_view_mode') as 'visual' | 'table') || 'visual'; } catch { return 'visual'; }
  });
  const setStructureViewMode = (mode: 'visual' | 'table') => {
    try { localStorage.setItem('aegis_view_mode', mode); } catch {}
    _setStructureViewMode(mode);
  };

  // Modals for Add Employee & Add Dept
  const [isAddEmpModalOpen, setIsAddEmpModalOpen] = useState(false);
  const [newEmpIdInput, setNewEmpIdInput] = useState('');
  const [newEmpFirstName, setNewEmpFirstName] = useState('');
  const [newEmpLastName, setNewEmpLastName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpDeptCode, setNewEmpDeptCode] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('Employee');

  const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
  const [newDeptNameInput, setNewDeptNameInput] = useState('');

  // Merge Departments State
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSourceCode, setMergeSourceCode] = useState('');
  const [mergeTargetCode, setMergeTargetCode] = useState('');

  // Lead Swap Modal State
  const [isSwapLeadModalOpen, setIsSwapLeadModalOpen] = useState(false);
  const [swapDeptId, setSwapDeptId] = useState('');

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

        await fetch(`${API_BASE}/setup/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId || 'org_default',
            state: {
              step,
              orgName,
              departments: nextDepartments,
              employees: nextEmployees
            }
          }),
        });
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
    { num: 2, title: 'Review Structure' },
    { num: 3, title: 'Validation' },
    { num: 4, title: 'Assign Managers' },
    { num: 5, title: 'Security' },
    { num: 6, title: 'Rollout' },
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
        <div className="h-20 flex items-center gap-3 px-6 shrink-0 border-b border-slate-200 dark:border-slate-800">
          <img src="/logo.png" alt="AegisOne Logo" className="w-8 h-8 object-contain drop-shadow shrink-0" />
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-[#0A5ED6] dark:text-[#4F84F8]">AegisOne</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Setup Engine</span>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Progress</span>
            <span className="text-xs font-bold text-[#0A5ED6] dark:text-[#4F84F8]">{Math.round((step / 6) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#0A5ED6] dark:bg-[#4F84F8] transition-all duration-500 ease-out"
              style={{ width: `${Math.round((step / 6) * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar py-4">
          <h3 className="px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Setup Steps</h3>
          <nav className="space-y-1">
            {STEPS.map((s) => {
              const isActive = step === s.num;
              
              // Validate each step to ensure fields are actually filled
              const isStep1Valid = Boolean(orgName.trim() && industry.trim());
              const unassignedCount = employees.filter(e => e.departmentCode === 'NONE' && e.role.toLowerCase() !== 'admin').length;
              const isStep2Valid = isStep1Valid && departments.length > 0 && unassignedCount === 0;
              const isStep3Valid = isStep2Valid && invalidEmployees.length === 0 && employees.length > 0;
              const isStep4Valid = isStep3Valid && departments.every(d => Boolean(d.leadId || employees.some(e => e.departmentCode === d.code && e.role.toLowerCase() === 'manager')));
              const isStep5Valid = isStep4Valid && Boolean(smtpUser.trim() && smtpPass.trim());

              let isCompleted = false;
              if (s.num === 1) isCompleted = isStep1Valid && step > 1;
              else if (s.num === 2) isCompleted = isStep2Valid && step > 2;
              else if (s.num === 3) isCompleted = isStep3Valid && step > 3;
              else if (s.num === 4) isCompleted = isStep4Valid && step > 4;
              else if (s.num === 5) isCompleted = isStep5Valid && step > 5;
              else if (s.num === 6) isCompleted = dispatchDone;

              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    // Prevent jumping to future steps if current step is incomplete
                    if (s.num > step) {
                      if (step === 1 && !isStep1Valid) {
                        showToast('Please complete Organization Name and Industry first', 'error');
                        return;
                      }
                      if (step === 2 && !isStep2Valid) {
                        showToast('Please assign all employees to departments before continuing', 'error');
                        return;
                      }
                    }
                    setStep(s.num);
                  }}
                  className={`w-full flex items-center gap-3 px-6 py-3 text-[13px] font-medium transition-all text-left cursor-pointer ${isActive
                    ? "bg-slate-100 dark:bg-slate-800/50 text-[#0F172A] dark:text-white border-l-2 border-[#0A5ED6] dark:border-[#4F84F8]"
                    : isCompleted
                      ? "text-[#0F172A] dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 border-l-2 border-transparent"
                      : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/30 border-l-2 border-transparent"
                    }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${isCompleted ? 'bg-emerald-500 text-white' :
                    isActive ? 'bg-[#0A5ED6] dark:bg-[#4F84F8] text-white' :
                      'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}>
                    {isCompleted ? <Check className="w-3 h-3" /> : s.num}
                  </div>
                  <span>{s.title}</span>
                </button>
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
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto w-full transition-colors pb-12">

            {/* STEP 1: ORGANIZATION INFO */}
            {step === 1 && (
              <div className="animate-fadeIn max-w-5xl mx-auto space-y-8">
                <div>
                  <h2 className="text-3xl font-bold text-[#0F172A] dark:text-white mb-2 font-display tracking-tight">Organization Profile & Environment</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Verify your company profile and deployment environment parameters before structuring your departments.</p>
                </div>

                {!configLoaded ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
                    <Loader2 className="w-8 h-8 text-[#0A5ED6] dark:text-[#4F84F8] animate-spin" />
                    <p className="text-sm text-slate-500 font-semibold animate-pulse">Reading environment variables from Docker container...</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Visual Highlights & System Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-200/60 dark:border-blue-800/40 rounded-2xl p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[#0A5ED6] dark:bg-[#4F84F8] text-white flex items-center justify-center shrink-0 shadow-md">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Organization</p>
                          <p className="text-lg font-extrabold text-[#0F172A] dark:text-white truncate">{orgName || "INARA Security"}</p>
                          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">{industry || "Cybersecurity"}</span>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deployment Engine</p>
                          <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">Docker Isolated</p>
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">v2.4.0 • Enterprise Edition</span>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-200/60 dark:border-indigo-800/40 rounded-2xl p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md">
                          <Key className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admin Account</p>
                          <p className="text-sm font-bold text-[#0F172A] dark:text-white truncate">{employees.find(e => e.role === 'Admin')?.email || 'Administrator'}</p>
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5"><CheckCircle2 className="w-3 h-3" /> Credentials Provisioned</span>
                        </div>
                      </div>
                    </div>

                    {/* Main Organization Form Card */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
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
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Organization Name <span className="text-blue-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            placeholder="e.g. Acme Cybersecurity Corp"
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[#0F172A] dark:text-white font-semibold outline-none focus:border-[#0A5ED6] dark:focus:border-[#4F84F8] focus:ring-1 focus:ring-[#0A5ED6]/20 transition-all"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Industry / Sector <span className="text-blue-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={industry}
                            onChange={(e) => setIndustry(e.target.value)}
                            placeholder="e.g. Technology / Information Systems"
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[#0F172A] dark:text-white font-semibold outline-none focus:border-[#0A5ED6] dark:focus:border-[#4F84F8] focus:ring-1 focus:ring-[#0A5ED6]/20 transition-all"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Primary Timezone
                          </label>
                          <select
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[#0F172A] dark:text-white rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-[#0A5ED6] dark:focus:border-[#4F84F8] cursor-pointer"
                          >
                            <option value="UTC+00:00">UTC+00:00 (GMT - Universal Time)</option>
                            <option value="UTC+05:00">UTC+05:00 (PKT - Pakistan Standard Time)</option>
                            <option value="UTC-05:00">UTC-05:00 (EST - Eastern Standard Time)</option>
                            <option value="UTC+01:00">UTC+01:00 (CET - Central European Time)</option>
                            <option value="UTC+08:00">UTC+08:00 (SGT - Singapore Standard Time)</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Default Security Level
                          </label>
                          <div className="w-full bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-600 dark:text-slate-300 font-semibold flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                              Strict Real-time Scanning
                            </span>
                            <span className="text-[11px] text-slate-400">Standard Policy</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <p className="text-xs text-slate-400">Changes are automatically saved as you configure your organization.</p>
                        <button
                          onClick={handleNextStep}
                          disabled={loading || !orgName.trim()}
                          className="flex items-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md disabled:opacity-50"
                        >
                          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verify & Continue <ArrowRight className="w-4 h-4" /></>}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: REVIEW STRUCTURE */}
            {step === 2 && (
              <div className="animate-fadeIn space-y-4 max-w-full">
                {/* Single Row Integrated Toolbar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-extrabold text-[#0F172A] dark:text-white font-display">Organization Hierarchy</h2>
                    <span className="text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full">
                      {departments.length} Departments • {employees.length} Members
                    </span>
                  </div>
                  
                  {/* Single Row Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleDownloadTemplate}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                      title="Download sample CSV template"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Template
                    </button>
                    <input
                      type="file"
                      accept=".csv"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#0A5ED6] hover:bg-[#0B63E0] px-3.5 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> {employees.length > 0 ? 'Replace CSV' : 'Upload CSV'}
                    </button>
                    <button
                      onClick={() => setIsAddEmpModalOpen(true)}
                      className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Employee
                    </button>
                    <button
                      onClick={() => setIsAddDeptModalOpen(true)}
                      className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Dept
                    </button>

                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-950 rounded-xl p-1 border border-slate-200 dark:border-slate-800">
                      <button
                        onClick={() => setStructureViewMode('visual')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${structureViewMode === 'visual' ? 'bg-[#0A5ED6] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                      >
                        <ListFilter className="w-3.5 h-3.5" /> Node Graph
                      </button>
                      <button
                        onClick={() => setStructureViewMode('table')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${structureViewMode === 'table' ? 'bg-[#0A5ED6] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                      >
                        <Table className="w-3.5 h-3.5" /> Active Sheet
                      </button>
                    </div>
                  </div>
                </div>

                <div className="w-full space-y-4">
                  <div>

                      {structureViewMode === 'visual' && (
                        <div className="space-y-6">
                          <div className="relative mb-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                              type="text" 
                              placeholder="Filter nodes or employee names..." 
                              value={visualSearch}
                              onChange={e => setVisualSearch(e.target.value)}
                              className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#0A5ED6] dark:text-white transition-colors"
                            />
                          </div>
                          
                          {/* Top Level Unassigned Node */}
                          {(() => {
                            const unassigned = visualEmployeesByDept.get('NONE') || [];
                            if (unassigned.length === 0) return null;
                            return (
                              <div className="relative bg-red-50/70 dark:bg-red-950/20 border-2 border-dashed border-red-300 dark:border-red-800 rounded-2xl p-4 transition-all">
                                <div className="flex items-center justify-between mb-3 border-b border-red-200 dark:border-red-800/60 pb-2">
                                  <h4 className="text-xs font-extrabold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> Unassigned Members Pool ({unassigned.length})
                                  </h4>
                                  <span className="text-[10px] text-red-500 font-semibold">Drag into department nodes below</span>
                                </div>
                                <div 
                                  className="flex flex-wrap gap-2.5 min-h-[50px] p-2"
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
                                      className="flex items-center gap-2 cursor-grab active:cursor-grabbing rounded-xl border border-red-200 dark:border-red-800/80 bg-white dark:bg-slate-900 px-3 py-1.5 shadow-sm hover:shadow-md hover:border-red-400 transition-all select-none"
                                    >
                                      <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300 flex items-center justify-center text-[10px] font-extrabold shrink-0">
                                        {(emp.firstName?.[0] || 'U')}{(emp.lastName?.[0] || '')}
                                      </div>
                                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{emp.firstName} {emp.lastName}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Node Structure / ERD Diagram Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {departments.map(dept => {
                              const deptEmployees = visualEmployeesByDept.get(dept.code) || [];
                              const manager = deptEmployees.find(e => e.id === dept.leadId || e.role.toLowerCase() === 'manager');
                              const members = deptEmployees.filter(e => e.id !== manager?.id);

                              return (
                                <div
                                  key={dept.id}
                                  className="relative bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-blue-400 dark:hover:border-blue-600 transition-all flex flex-col justify-between"
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={() => {
                                    if (draggedEmployeeId) {
                                      moveEmployeeToDept(draggedEmployeeId, dept.code);
                                      setDraggedEmployeeId(null);
                                    }
                                  }}
                                >
                                  {/* Department ERD Node Header */}
                                  <div>
                                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                        <input
                                          value={dept.name}
                                          onChange={(e) => renameDepartment(dept.id, e.target.value)}
                                          className="w-full bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-[#0F172A] dark:text-white rounded-lg px-2 py-1 text-base font-extrabold outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#0A5ED6] dark:focus:border-[#4F84F8] transition-all truncate"
                                          placeholder="Department Name"
                                        />
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="font-mono text-xs font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
                                          {dept.code}
                                        </span>
                                        <button 
                                          onClick={() => {
                                            if (window.confirm(`Are you sure you want to delete department ${dept.name} (${dept.code})? Employees will become unassigned.`)) {
                                              handleDeleteDepartment(dept.id, dept.code);
                                            }
                                          }} 
                                          className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors" 
                                          title="Delete Department"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                    {/* Connection Line & Manager Node */}
                                       <div className="space-y-3 relative pl-3 border-l-2 border-blue-400/40 dark:border-blue-500/30 ml-2 py-1">
                                         {manager ? (
                                           <div 
                                             draggable
                                             onDragStart={() => setDraggedEmployeeId(manager.id)}
                                             className="relative flex items-center justify-between gap-2 bg-gradient-to-r from-blue-50 to-indigo-50/30 dark:from-blue-950/40 dark:to-slate-900 border border-blue-200/80 dark:border-blue-800/60 rounded-xl p-2.5 shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-400"
                                           >
                                             <div className="flex items-center gap-2 min-w-0">
                                               <div className="min-w-0">
                                                 <div className="flex items-center gap-1.5">
                                                   <span className="text-xs font-extrabold text-blue-950 dark:text-blue-100 truncate">{manager.firstName} {manager.lastName}</span>
                                                   <span className="text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.2 rounded uppercase">Manager</span>
                                                 </div>
                                                 <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{manager.email}</p>
                                               </div>
                                             </div>
                                           </div>
                                         ) : (
                                           <div 
                                             onDragOver={(e) => e.preventDefault()}
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

                                         {/* Sub-node connection lines to Members */}
                                         <div className="space-y-2 pt-1">
                                           <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Department Members ({members.length})</p>
                                           {members.length > 0 ? (
                                             <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                                               {members.map(emp => (
                                                 <div
                                                   key={emp.id}
                                                   draggable={editingEmployeeId !== emp.id}
                                                   onDragStart={() => {
                                                     if (editingEmployeeId !== emp.id) setDraggedEmployeeId(emp.id);
                                                   }}
                                                   className="flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all"
                                                 >
                                                   <div className="flex items-center gap-2 min-w-0">
                                                     <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{emp.firstName} {emp.lastName}</span>
                                                   </div>

                                                   <select
                                                     value={emp.role.toLowerCase()}
                                                     onChange={(e) => {
                                                       const newRole = e.target.value === 'manager' ? 'Manager' : 'Employee';
                                                       updateEmployee(emp.id, { role: newRole });
                                                       if (newRole === 'Manager' && !dept.leadId) {
                                                         setDepartments(departments.map(d => d.id === dept.id ? { ...d, leadId: emp.id } : d));
                                                       }
                                                     }}
                                                     className="text-[10px] font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 outline-none cursor-pointer capitalize text-slate-600 dark:text-slate-300 hover:border-blue-400"
                                                   >
                                                     <option value="employee">Employee</option>
                                                     <option value="manager">Manager</option>
                                                   </select>
                                                 </div>
                                               ))}
                                             </div>
                                           ) : (
                                             <div className="p-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-400">
                                               Drag employees here
                                             </div>
                                           )}
                                         </div>
                                       </div>
                                  </div>
                                </div>
                              );
                            })}

                            {departments.length === 0 && (
                              <div className="col-span-full flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                                  <FileSpreadsheet className="w-7 h-7" />
                                </div>
                                <h4 className="text-lg font-bold text-[#0F172A] dark:text-white mb-1 font-display">No Departments Configured</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-4">
                                  Upload your employee CSV file or click <span className="font-bold text-blue-600">Add Dept</span> or <span className="font-bold text-emerald-600">Add Employee</span> above to create your organizational hierarchy manually.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {structureViewMode === 'table' && (
                        <TableMode 
                          employees={employees} 
                          departments={departments}
                          onMoveEmployee={moveEmployeeToDept}
                          onRoleChange={(empId, newRole) => {
                            const formattedRole = newRole.toLowerCase() === 'manager' ? 'Manager' : 'Employee';
                            updateEmployee(empId, { role: formattedRole });
                          }}
                          onBulkMove={handleBulkReassign}
                        />
                      )}
                    </div>
                  </div>

                {/* Live Validation Summary & Continue Button */}
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center sticky bottom-0 bg-[#f8fafc] dark:bg-[#0f172a] pb-6 z-20">
                  <button onClick={() => setStep(1)} className="text-slate-500 dark:text-slate-400 font-semibold hover:text-[#0F172A] dark:hover:text-white text-sm">Back</button>
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
                      onClick={() => setStep(3)} 
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

            {/* STEP 3: VALIDATION PREVIEW */}
            {step === 3 && (
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
                    <button onClick={() => { setPreviewMode(false); setStep(2); }} className="mt-4 text-xs font-bold text-red-700 dark:text-red-400 underline hover:text-red-900 dark:hover:text-red-300">Upload corrected file</button>
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
                                        setEmployees(prev => prev.map(e => {
                                          if (e.id === emp.id) {
                                            const updated = { ...e, ...editingDraft };
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
                                      Save
                                    </button>
                                    <button 
                                      onClick={() => setEditingEmployeeId(null)}
                                      className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded px-2 py-0.5 text-[10px] font-bold"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${emp.status === 'invalid' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                                    {emp.status === 'invalid' ? emp.error || 'Invalid' : 'Valid'}
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

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <button onClick={() => { setPreviewMode(false); setStep(2); }} className="text-slate-500 dark:text-slate-400 font-semibold hover:text-[#0F172A] dark:hover:text-white text-sm">Back</button>
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

            {/* STEP 4: ASSIGN MANAGERS */}
            {step === 4 && (
              <div className="animate-fadeIn space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white mb-2">Review Department Managers</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">We have automatically selected managers based on your imported data. Review them below and click Save. Managers have access to department-level threat reports.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {departments.map(dept => {
                    const deptEmployees = validEmployees.filter(e => e.departmentCode === dept.code);
                    const potentialManagers = deptEmployees.filter(e => e.role.toLowerCase() === 'manager');
                    
                    return (
                      <div key={dept.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-[#0F172A] dark:text-white">{dept.name}</h4>
                          <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500 dark:text-slate-300">{dept.code}</span>
                        </div>
                        {potentialManagers.length > 0 ? (
                          <select
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:border-[#0A5ED6] dark:focus:border-[#4F84F8] outline-none cursor-pointer"
                            value={dept.leadId || potentialManagers[0]?.id || ""}
                            onChange={(e) => {
                              setDepartments(departments.map(d => d.id === dept.id ? { ...d, leadId: e.target.value } : d));
                            }}
                          >
                            <option value="">Select Manager...</option>
                            <option value="SKIP">Skip — assign later</option>
                            {potentialManagers.map(e => (
                              <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.email})</option>
                            ))}
                          </select>
                        ) : (
                          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div className="text-xs">
                              <p className="font-semibold text-amber-900 dark:text-amber-200 mb-0.5">No Manager in CSV</p>
                              <p className="text-amber-700 dark:text-amber-300 mb-2">No employee with role <code className="font-mono bg-amber-100 dark:bg-amber-900/50 px-1 rounded">Manager</code> was found in department {dept.name}.</p>
                              {deptEmployees.length > 0 ? (
                                <select
                                  className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 dark:text-slate-200 rounded px-2 py-1 text-xs outline-none cursor-pointer mt-1"
                                  value={dept.leadId || ""}
                                  onChange={(e) => {
                                    const selectedId = e.target.value;
                                    if (selectedId && selectedId !== "SKIP") {
                                      setEmployees(employees.map(emp => emp.id === selectedId ? { ...emp, role: 'Manager' } : emp));
                                    }
                                    setDepartments(departments.map(d => d.id === dept.id ? { ...d, leadId: selectedId } : d));
                                  }}
                                >
                                  <option value="">Select Employee to Promote to Manager...</option>
                                  <option value="SKIP">Skip — assign later</option>
                                  {deptEmployees.map(e => (
                                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.email})</option>
                                  ))}
                                </select>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDepartments(departments.map(d => d.id === dept.id ? { ...d, leadId: 'SKIP' } : d));
                                  }}
                                  className="text-amber-800 dark:text-amber-300 font-bold underline text-[11px]"
                                >
                                  Skip — assign later
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <button onClick={() => setStep(3)} className="text-slate-500 dark:text-slate-400 font-semibold hover:text-[#0F172A] dark:hover:text-white text-sm">Back</button>
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
                      void saveStructure(nextDepts, employees);
                      handleNextStep();
                    }}
                    className="flex items-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md"
                  >
                    Save & Continue <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: SECURITY */}
            {step === 5 && (
              <div className="animate-fadeIn space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white mb-2">Security & Credentials Dispatch</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Configure email server credentials to dispatch secure welcome messages and password setup links to your employees.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
                    <h3 className="font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                      <Mail className="w-5 h-5 text-[#0A5ED6] dark:text-[#4F84F8]" /> SMTP Email Server Configuration
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Specify the outbound email account used to dispatch employee welcome credentials.</p>
                    
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">SMTP Host</label>
                        <input
                          type="text"
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                          placeholder="smtp.gmail.com"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0A5ED6] dark:focus:border-[#4F84F8]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Sender Email / Username</label>
                        <input
                          type="email"
                          value={smtpUser}
                          onChange={(e) => setSmtpUser(e.target.value)}
                          placeholder="admin@company.com"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0A5ED6] dark:focus:border-[#4F84F8]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">App Password</label>
                        <div className="relative">
                          <input
                            type={showSmtpPass ? "text" : "password"}
                            value={smtpPass}
                            onChange={(e) => setSmtpPass(e.target.value)}
                            placeholder="•••• •••• •••• ••••"
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-lg pl-3 pr-10 py-2.5 text-sm outline-none focus:border-[#0A5ED6] dark:focus:border-[#4F84F8]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSmtpPass(!showSmtpPass)}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">SMTP Port</label>
                        <input
                          type="text"
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
                  <button onClick={() => setStep(4)} className="text-slate-500 dark:text-slate-400 font-semibold hover:text-[#0F172A] dark:hover:text-white text-sm">Back</button>
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
                        setDispatchError(null);
                        try {
                          const payload = {
                            employees: validEmployees.map(e => ({
                              firstName: e.firstName,
                              lastName: e.lastName,
                              email: e.email,
                              departmentCode: e.departmentCode,
                              role: e.role,
                              designation: e.designation,
                              generatedPassword: e.generatedPassword
                            })),
                            smtpUser: smtpUser,
                            smtpPass: smtpPass,
                            smtpHost: smtpHost,
                            smtpPort: parseInt(smtpPort, 10)
                          };
                          const response = await fetch(`${API_BASE}/setup/execute`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                          });
                          if (response.ok) {
                            const data = await response.json();
                            // Mark setup as complete so demo seed data never reappears on reload
                            markSetupCompleted();
                            if (data.run_id) {
                              pollEmailStatus(data.run_id);
                            } else {
                              setDispatchDone(true);
                            }
                            setRolloutActive(true);
                            setStep(6);
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
                      disabled={!smtpUser || !smtpPass || loading}
                      className="flex items-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Finalize & Dispatch Emails <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 6: ROLLOUT */}
            {step === 6 && (
              <div className="animate-fadeIn space-y-8 text-center max-w-3xl mx-auto py-6">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div>
                  <h2 className="text-3xl font-bold text-[#0F172A] dark:text-white mb-2 font-display">Setup Complete!</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Your organization structure and employee accounts have been created in the AegisOne security database.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Employees</p>
                    <p className="text-2xl font-bold text-[#0F172A] dark:text-white">{validEmployees.length}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Emails Sent</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
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
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm text-left">
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-sm relative">
                      <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Employee</th>
                          <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px] text-center">Email Sent</th>
                          <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px] text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {validEmployees.map(emp => {
                          const result = emailResults[emp.email];
                          const sent = result ? result.sent : undefined;
                          return (
                            <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="px-6 py-3">
                                <p className="font-semibold text-[#0F172A] dark:text-slate-200">{emp.firstName} {emp.lastName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{emp.email}</p>
                                {sent === false && result?.error && (
                                  <p className="text-[11px] text-red-500 mt-1 break-all">{result.error}</p>
                                )}
                              </td>
                              <td className="px-6 py-3 text-center">
                                {sent === true ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                                ) : sent === false ? (
                                  <AlertCircle className="w-5 h-5 text-red-500 mx-auto" />
                                ) : (
                                  <Loader2 className="w-4 h-4 animate-spin text-slate-300 mx-auto" />
                                )}
                              </td>
                              <td className="px-6 py-3 text-right">
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
                  <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200 text-left">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-500" />
                    <div>
                      <p className="font-bold">Some welcome emails could not be delivered.</p>
                      <p className="text-amber-700 dark:text-amber-300/80 mt-1">
                        Verify your SMTP account credentials and ensure Google App Password / 2-Step Verification is enabled.
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-4 flex justify-center gap-4">
                  <button onClick={() => setStep(5)} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold px-6 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">
                    Back
                  </button>
                  <button onClick={() => window.location.href = 'http://localhost:3002/login'} className="flex items-center gap-2 bg-slate-900 dark:bg-blue-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-black dark:hover:bg-blue-700 transition-colors text-sm">
                    Go to Full Dashboard <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal: Add Employee */}
      {isAddEmpModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#0A5ED6]" /> Add New Employee
              </h3>
              <button onClick={() => setIsAddEmpModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Employee ID (Optional)</label>
                  <input
                    type="text"
                    value={newEmpIdInput}
                    onChange={e => setNewEmpIdInput(e.target.value)}
                    placeholder="e.g. EMP_1234 (Auto-generated if left blank)"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-[#0F172A] dark:text-white outline-none focus:border-[#0A5ED6]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">First Name *</label>
                  <input
                    type="text"
                    value={newEmpFirstName}
                    onChange={e => setNewEmpFirstName(e.target.value)}
                    placeholder="e.g. Sarah"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-[#0F172A] dark:text-white outline-none focus:border-[#0A5ED6]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Last Name *</label>
                  <input
                    type="text"
                    value={newEmpLastName}
                    onChange={e => setNewEmpLastName(e.target.value)}
                    placeholder="e.g. Connor"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-[#0F172A] dark:text-white outline-none focus:border-[#0A5ED6]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Email Address *</label>
                <input
                  type="email"
                  value={newEmpEmail}
                  onChange={e => setNewEmpEmail(e.target.value)}
                  placeholder="sarah.connor@company.com"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-[#0F172A] dark:text-white outline-none focus:border-[#0A5ED6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Department</label>
                  <select
                    value={newEmpDeptCode}
                    onChange={e => setNewEmpDeptCode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-[#0F172A] dark:text-white outline-none focus:border-[#0A5ED6]"
                  >
                    <option value="NONE">Unassigned</option>
                    {departments.map(d => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Role</label>
                  <select
                    value={newEmpRole}
                    onChange={e => setNewEmpRole(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-[#0F172A] dark:text-white outline-none focus:border-[#0A5ED6]"
                  >
                    <option value="Employee">Employee</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setIsAddEmpModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newEmpFirstName.trim() || !newEmpEmail.trim() || !newEmpEmail.includes('@')) {
                    showToast('Valid First Name and Email required', 'error');
                    return;
                  }
                  
                  const targetEmail = newEmpEmail.trim().toLowerCase();
                  if (employees.some(e => e.email.toLowerCase() === targetEmail)) {
                    showToast(`Email ${targetEmail} is already registered to another employee.`, 'error');
                    return;
                  }

                  const targetId = newEmpIdInput.trim() || `EMP_${Math.floor(Math.random() * 8999 + 1000)}`;
                  if (employees.some(e => e.employeeId === targetId)) {
                    showToast(`Employee ID ${targetId} is already in use.`, 'error');
                    return;
                  }

                  const newEmp: Employee = {
                    id: crypto.randomUUID(),
                    employeeId: targetId,
                    firstName: newEmpFirstName.trim(),
                    lastName: newEmpLastName.trim(),
                    email: newEmpEmail.trim(),
                    phone: '',
                    departmentCode: newEmpDeptCode || 'NONE',
                    role: newEmpRole,
                    designation: newEmpRole,
                    status: 'valid'
                  };
                  setEmployees(prev => {
                    const next = [newEmp, ...prev];
                    void saveStructure(departments, next);
                    return next;
                  });
                  // Removed automatic switch to table view to preserve user's current card view
                  setIsAddEmpModalOpen(false);
                  setNewEmpIdInput('');
                  setNewEmpFirstName('');
                  setNewEmpLastName('');
                  setNewEmpEmail('');
                  showToast(`Added ${newEmp.firstName} ${newEmp.lastName}`, 'success');
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-[#0A5ED6] hover:bg-[#0B63E0] rounded-xl transition-all shadow-md"
              >
                Create Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Department */}
      {isAddDeptModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#0A5ED6]" /> Add Department
              </h3>
              <button onClick={() => setIsAddDeptModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Department Name *</label>
                <input
                  type="text"
                  value={newDeptNameInput}
                  onChange={e => setNewDeptNameInput(e.target.value)}
                  placeholder="e.g. Web Development"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-[#0F172A] dark:text-white outline-none focus:border-[#0A5ED6]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Auto-Generated Code</label>
                <div className="w-full bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
                  {(() => {
                    const tokens = newDeptNameInput.trim().replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
                    let code = 'DPT';
                    if (tokens.length === 1) code = tokens[0].substring(0, 4).toUpperCase();
                    else if (tokens.length > 1) code = tokens.slice(0, 4).map(t => t[0]).join('').toUpperCase();
                    return code || 'DPT';
                  })()}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setIsAddDeptModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newDeptNameInput.trim()) {
                    showToast('Department name is required', 'error');
                    return;
                  }
                  const name = newDeptNameInput.trim();
                  const tokens = name.replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
                  let baseCode = 'DPT';
                  if (tokens.length === 1) baseCode = tokens[0].substring(0, 4).toUpperCase();
                  else if (tokens.length > 1) baseCode = tokens.slice(0, 4).map(t => t[0]).join('').toUpperCase();
                  
                  let finalCode = baseCode;
                  let counter = 1;
                  while (departments.some(d => d.code === finalCode)) {
                    finalCode = `${baseCode}${counter}`;
                    counter++;
                  }

                  const newDept: Department = {
                    id: `dept_${finalCode}_${Date.now()}`,
                    name,
                    code: finalCode
                  };

                  setDepartments(prev => {
                    const next = [...prev, newDept];
                    void saveStructure(next, employees);
                    return next;
                  });
                  setIsAddDeptModalOpen(false);
                  setNewDeptNameInput('');
                  showToast(`Created Department ${name} (${finalCode})`, 'success');
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-[#0A5ED6] hover:bg-[#0B63E0] rounded-xl transition-all shadow-md"
              >
                Create Department
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Swap Department Lead */}
      {isSwapLeadModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            {(() => {
              const targetDept = departments.find(d => d.id === swapDeptId);
              const deptEmployees = employees.filter(e => e.departmentCode === targetDept?.code && e.role.toLowerCase() !== 'admin');

              return (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" /> Swap Department Lead
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Select a new lead for {targetDept?.name} ({targetDept?.code})</p>
                    </div>
                    <button onClick={() => setIsSwapLeadModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                    {deptEmployees.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">No employees in this department yet. Move an employee into this department node first.</p>
                    ) : (
                      deptEmployees.map(emp => {
                        const isCurrentLead = targetDept?.leadId === emp.id || emp.role.toLowerCase() === 'manager';
                        return (
                          <div
                            key={emp.id}
                            onClick={() => {
                              // Promote selected employee to Manager and leadId, demote previous manager if any
                              setEmployees(prev => prev.map(e => {
                                if (e.id === emp.id) return { ...e, role: 'Manager' };
                                if (e.departmentCode === targetDept?.code && e.id === targetDept?.leadId) return { ...e, role: 'Employee' };
                                return e;
                              }));
                              setDepartments(prev => prev.map(d => d.id === targetDept?.id ? { ...d, leadId: emp.id } : d));
                              setIsSwapLeadModalOpen(false);
                              showToast(`Promoted ${emp.firstName} ${emp.lastName} to ${targetDept?.name} Lead`, 'success');
                            }}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${isCurrentLead ? 'bg-blue-50/80 border-blue-300 dark:bg-blue-950/40 dark:border-blue-800' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-blue-400'}`}
                          >
                            <div>
                              <p className="text-xs font-bold text-[#0F172A] dark:text-white">{emp.firstName} {emp.lastName}</p>
                              <p className="text-[11px] text-slate-500">{emp.email}</p>
                            </div>
                            {isCurrentLead ? (
                              <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded uppercase">Current Lead</span>
                            ) : (
                              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">Select as Lead</span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

