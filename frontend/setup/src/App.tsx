import React, { useState, useEffect } from 'react';
import {
  Building2, Users, Download, Upload, CheckCircle2, AlertCircle, Key, Mail,
  ShieldCheck, Activity, ArrowRight, ChevronRight, Loader2, Sparkles, UserPlus,
  Shield, Network, HardDrive, FileSpreadsheet, Lock, Check, Search, Laptop, Globe, X,
  Eye, EyeOff
} from 'lucide-react';

type SetupStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface Department {
  id: string;
  name: string;
  code: string;
  leadId?: string;
}

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentCode: string;
  role: string;
  designation: string;
  status: 'pending' | 'valid' | 'invalid';
  error?: string;
  generatedPassword?: string;
}

interface ActivationStatus {
  emailSent: boolean;
  firstLogin: boolean;
  extensionInstalled: boolean;
  deviceRegistered: boolean;
  status: 'Active' | 'Pending' | 'Install Extension';
}

export default function App() {
  const [step, setStep] = useState<SetupStep>(1);
  const [loading, setLoading] = useState(false);
  const API_BASE = 'http://localhost:8000';

  // Step 1: Org Info (Pre-filled from Docker Environment Variables)
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('');
  const [timezone, setTimezone] = useState('UTC+00:00');
  const [configLoaded, setConfigLoaded] = useState(false);

  // Step 2+: Departments are inferred from the uploaded employee CSV
  const [departments, setDepartments] = useState<Department[]>([]);
  const [draggedEmployeeId, setDraggedEmployeeId] = useState<string | null>(null);

  // Step 3 & 4: Employees
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

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

    fetch(`${API_BASE}/setup/structure/org_default`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (Array.isArray(data.departments) && data.departments.length > 0) {
          setDepartments(data.departments.map((d: any) => ({
            id: String(d.id ?? crypto.randomUUID()),
            name: d.name,
            code: String(d.code || d.name || '').toUpperCase(),
            leadId: d.managerId ? String(d.managerId) : undefined,
          })));
        }
        if (Array.isArray(data.employees) && data.employees.length > 0 && !adminEmailParam) {
          setEmployees(data.employees.map((u: any) => ({
            id: String(u.id),
            employeeId: u.employeeId || `EMP${u.id}`,
            firstName: String(u.name || '').split(' ')[0] || 'User',
            lastName: String(u.name || '').split(' ').slice(1).join(' ') || '',
            email: u.email,
            phone: '',
            departmentCode: u.department || 'NONE',
            role: u.role === 'admin' ? 'Admin' : (u.role === 'lead' ? 'Manager' : 'Employee'),
            designation: '',
            status: 'valid',
          })));
        }
      })
      .catch((err) => console.error('Failed to load persisted structure', err))
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

  const saveStructure = async (nextDepartments = departments, nextEmployees = employees) => {
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
    } catch (err) {
      console.error('Failed to save structure', err);
    }
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
    void saveStructure(next, rows.filter(row => row.status === 'valid' && row.email.includes('@')));
  };

  const renameDepartment = (deptId: string, name: string) => {
    setDepartments(prev => {
      const next = prev.map(dept => dept.id === deptId ? { ...dept, name } : dept);
      void saveStructure(next, employees);
      return next;
    });
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
        setPreviewMode(true);
        setStep(4);
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
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans selection:bg-blue-100 selection:text-blue-900">

      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0A5ED6]/10 border border-[#0A5ED6]/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#0A5ED6]" />
          </div>
          <span className="font-bold text-[#0F172A] text-sm tracking-tight">AegisOne Local Setup Engine</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Docker Connected
          </span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto w-full px-4 py-8 flex flex-col lg:flex-row gap-8">

        {/* Left Sidebar Stepper */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm sticky top-24">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">Setup Progress</h3>
            <div className="space-y-6 relative">
              <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-slate-100"></div>
              {STEPS.map((s) => {
                const isActive = step === s.num;
                const isPast = step > s.num;
                return (
                  <div key={s.num} className="flex items-center gap-4 relative z-10">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isPast ? 'bg-emerald-500 text-white border-2 border-emerald-500' :
                        isActive ? 'bg-white text-[#0A5ED6] border-2 border-[#0A5ED6] shadow-[0_0_0_4px_rgba(10,94,214,0.1)]' :
                          'bg-white text-slate-400 border-2 border-slate-200'
                      }`}>
                      {isPast ? <Check className="w-4 h-4" /> : s.num}
                    </div>
                    <span className={`font-semibold text-sm ${isActive ? 'text-[#0F172A]' : isPast ? 'text-slate-600' : 'text-slate-400'
                      }`}>
                      {s.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-lg p-8 md:p-12">

            {/* STEP 1: ORGANIZATION INFO */}
            {step === 1 && (
              <div className="animate-fadeIn space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Organization Information</h2>
                  <p className="text-slate-500 text-sm">Let's verify your company's core identity imported from your Docker deployment command.</p>
                </div>

                {!configLoaded ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Loader2 className="w-8 h-8 text-[#0A5ED6] animate-spin" />
                    <p className="text-sm text-slate-500 font-semibold animate-pulse">Reading environment variables from Docker container...</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 relative">
                        <label className="text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
                          Organization Name
                          <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-mono border border-emerald-200">AUTO DETECTED</span>
                        </label>
                        <input type="text" value={orgName} readOnly className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-semibold outline-none cursor-not-allowed" />
                      </div>
                      <div className="space-y-2 relative">
                        <label className="text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
                          Industry
                          <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-mono border border-emerald-200">AUTO DETECTED</span>
                        </label>
                        <input type="text" value={industry} readOnly className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-semibold outline-none cursor-not-allowed" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 uppercase">Timezone</label>
                        <select value={timezone} onChange={e => setTimezone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-[#0A5ED6] outline-none">
                          <option>UTC+00:00 (GMT)</option>
                          <option>UTC+05:00 (PKT)</option>
                          <option>UTC-05:00 (EST)</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 flex justify-end">
                      <button onClick={handleNextStep} disabled={loading} className="flex items-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verify & Continue <ArrowRight className="w-4 h-4" /></>}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* STEP 2: IMPORT EMPLOYEES */}
            {step === 2 && (
              <div className="animate-fadeIn space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Import Employees First</h2>
                  <p className="text-slate-500 text-sm">Upload employee.csv and the setup will infer departments automatically, so you can edit structure after the import instead of building it twice.</p>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                  <button onClick={() => setStep(1)} className="text-slate-500 font-semibold hover:text-[#0F172A] text-sm">Back</button>
                  <button onClick={handleNextStep} disabled={loading || employees.length === 0} className="flex items-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md disabled:opacity-50">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Review Structure <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: REVIEW STRUCTURE */}
            {step === 3 && (
              <div className="animate-fadeIn space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Review and Edit Structure</h2>
                  <p className="text-slate-500 text-sm mb-4">Drag employees into departments, rename departments inline, and assign managers after the CSV import.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1 bg-blue-50 border border-blue-100 rounded-2xl p-6">
                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                      <FileSpreadsheet className="w-7 h-7 text-blue-600" />
                    </div>
                    <h3 className="font-bold text-[#0F172A] mb-2">1. Upload employee.csv</h3>
                    <p className="text-sm text-blue-800 mb-5">The upload step infers departments automatically, so you only edit what the CSV actually contains.</p>
                    <button onClick={handleDownloadTemplate} className="flex items-center justify-center gap-2 bg-white border border-blue-200 text-blue-700 font-bold px-4 py-2.5 rounded-lg hover:bg-blue-100 transition-colors text-sm w-full cursor-pointer shadow-sm mb-4">
                      <Download className="w-4 h-4" /> Download Template
                    </button>
                    <input
                      type="file"
                      accept=".csv"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-900 text-white font-bold px-4 py-2.5 rounded-lg hover:bg-black transition-colors text-sm">
                      {employees.length > 0 ? 'Replace CSV File' : 'Select CSV File'}
                    </button>
                  </div>

                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-[#0F172A]">Departments</h3>
                        <span className="text-xs text-slate-500">{departments.length} inferred departments</span>
                      </div>
                      <div className="space-y-3">
                        {departments.map(dept => (
                          <div
                            key={dept.id}
                            className="bg-white border border-slate-200 rounded-xl p-3"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (draggedEmployeeId) {
                                moveEmployeeToDept(draggedEmployeeId, dept.code);
                                setDraggedEmployeeId(null);
                              }
                            }}
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <input
                                value={dept.name}
                                onChange={(e) => renameDepartment(dept.id, e.target.value)}
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:border-[#0A5ED6]"
                              />
                              <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">{dept.code}</span>
                              <select
                                value={dept.leadId || ''}
                                onChange={(e) => assignManager(dept.id, e.target.value)}
                                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none"
                              >
                                <option value="">Assign manager</option>
                                {employees.filter(e => e.status === 'valid' && e.role.toLowerCase() === 'manager' && e.departmentCode === dept.code).map(e => (
                                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-wrap gap-2 min-h-12">
                              {employees.filter(e => e.departmentCode === dept.code && e.role.toLowerCase() !== 'admin').map(emp => (
                                <div
                                  key={emp.id}
                                  draggable
                                  onDragStart={() => setDraggedEmployeeId(emp.id)}
                                  className="cursor-grab rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                                >
                                  {emp.firstName} {emp.lastName}
                                </div>
                              ))}
                              {employees.filter(e => e.departmentCode === dept.code && e.role.toLowerCase() !== 'admin').length === 0 && (
                                <div className="text-xs text-slate-400">Drop employees here</div>
                              )}
                            </div>
                          </div>
                        ))}
                        {departments.length === 0 && (
                          <div className="text-sm text-slate-500">Upload the CSV first and departments will appear here automatically.</div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4">
                      <h3 className="font-bold text-[#0F172A] mb-3">Employees</h3>
                      <div className="max-h-[260px] overflow-auto space-y-2">
                        {employees.map(emp => (
                          <div key={emp.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 bg-slate-50">
                            <div>
                              <p className="font-semibold text-sm text-[#0F172A]">{emp.firstName} {emp.lastName}</p>
                              <p className="text-xs text-slate-500">{emp.email} • {emp.role}</p>
                            </div>
                            <select
                              value={emp.departmentCode}
                              onChange={(e) => moveEmployeeToDept(emp.id, e.target.value)}
                              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none"
                            >
                              <option value="NONE">No Department</option>
                              {departments.map(dept => <option key={dept.id} value={dept.code}>{dept.code}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                  <button onClick={() => setStep(2)} className="text-slate-500 font-semibold hover:text-[#0F172A] text-sm">Back</button>
                  <button onClick={() => setStep(4)} className="flex items-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md">
                    Continue to Validation <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: VALIDATION PREVIEW */}
            {step === 4 && (
              <div className="animate-fadeIn space-y-6">
                <div className="flex items-center justify-between bg-white border border-blue-200 rounded-2xl p-6 shadow-sm">
                  <div>
                    <h3 className="text-lg font-bold text-[#0F172A]">Preview Import</h3>
                    <p className="text-sm text-slate-500">Review data integrity before writing to PostgreSQL.</p>
                  </div>
                  <div className="flex gap-6 text-center">
                    <div>
                      <p className="text-3xl font-bold text-blue-600">{employees.length}</p>
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Parsed</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-emerald-500">{validEmployees.length}</p>
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Valid</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-red-500">{invalidEmployees.length}</p>
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Errors</p>
                    </div>
                  </div>
                </div>

                {invalidEmployees.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-red-800 flex items-center gap-2 mb-3"><AlertCircle className="w-4 h-4" /> Validation Errors Found</h4>
                    <ul className="space-y-2">
                      {invalidEmployees.map(emp => (
                        <li key={emp.id} className="text-xs text-red-700 bg-white px-3 py-2 rounded border border-red-100 flex justify-between">
                          <span><strong>{emp.firstName} {emp.lastName}</strong> ({emp.email})</span>
                          <span className="font-bold uppercase tracking-wider">{emp.error}</span>
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => { setPreviewMode(false); setStep(3); }} className="mt-4 text-xs font-bold text-red-700 underline hover:text-red-900">Upload corrected file</button>
                  </div>
                )}

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-sm relative">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">ID</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Name</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Email</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Dept</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Role</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {validEmployees.map(emp => (
                          <tr key={emp.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-mono text-slate-500 text-xs">{emp.employeeId}</td>
                            <td className="px-4 py-3 font-semibold text-[#0F172A]">{emp.firstName} {emp.lastName}</td>
                            <td className="px-4 py-3 text-slate-600">{emp.email}</td>
                            <td className="px-4 py-3 font-mono text-blue-600 font-bold">
                              {emp.role.toLowerCase() === 'admin' ? (
                                <span className="uppercase">GLOBAL</span>
                              ) : (
                                emp.departmentCode
                              )}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-600 capitalize">{emp.role}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase"><CheckCircle2 className="w-3 h-3" /> Valid</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                  <button onClick={() => { setPreviewMode(false); setStep(3); }} className="text-slate-500 font-semibold hover:text-[#0F172A] text-sm">Back</button>
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
                  <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Assign Department Managers</h2>
                  <p className="text-slate-500 text-sm">Select managers for each department. Managers have access to department-level threat reports.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {departments.map(dept => {
                    const deptEmployees = validEmployees.filter(e => e.departmentCode === dept.code);
                    const potentialManagers = deptEmployees.filter(e => e.role.toLowerCase() === 'manager');
                    const defaultManager = potentialManagers[0];

                    return (
                      <div key={dept.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-[#0F172A]">{dept.name}</h4>
                          <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">{dept.code}</span>
                        </div>
                        {potentialManagers.length > 0 ? (
                          <select
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-[#0A5ED6] outline-none cursor-pointer"
                            defaultValue={dept.leadId || defaultManager?.id || ""}
                            onChange={(e) => {
                              setDepartments(departments.map(d => d.id === dept.id ? { ...d, leadId: e.target.value } : d));
                            }}
                          >
                            <option value="">Select Manager...</option>
                            {potentialManagers.map(e => (
                              <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.designation})</option>
                            ))}
                          </select>
                        ) : (
                          <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center">
                            <p className="text-xs text-red-600 font-medium">No managers found in CSV for this department.</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                  <button onClick={() => setStep(4)} className="text-slate-500 font-semibold hover:text-[#0F172A] text-sm">Back</button>
                  <button onClick={generatePasswordsAndMails} disabled={loading} className="flex items-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Save Assignments <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 6: ACCOUNT GENERATION & SECURITY */}
            {step === 6 && (
              <div className="animate-fadeIn space-y-8 text-center py-4">
                <h2 className="text-3xl font-bold text-[#0F172A] mb-4">Generate Secure Accounts</h2>
                <p className="text-slate-600 max-w-xl mx-auto leading-relaxed mb-8">
                  AegisOne will generate secure 14-character passwords for {validEmployees.length} employees and dispatch welcome emails containing temporary credentials.
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 max-w-lg mx-auto text-left space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">Automated Actions Queue</h4>
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-700"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Hash & Store secure passwords to local DB</div>
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-700"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Generate Temporary Login Tokens</div>
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-700"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Dispatch {validEmployees.length} Email Invitations</div>
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-700"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Enable Force-Password-Change policy</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-lg mx-auto text-left">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-2"><Mail className="w-4 h-4" /> SMTP Sender Credentials</h4>
                  <p className="text-xs text-slate-500 mb-4">Used to dispatch welcome emails. If left blank, the values from the root <span className="font-mono">.env</span> file are used (if set).</p>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase">SMTP User (sender email)</label>
                      <input
                        type="email"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        placeholder="youremail@gmail.com"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0A5ED6]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase">SMTP Password / App Password</label>
                      <div className="relative">
                        <input
                          type={showSmtpPass ? 'text' : 'password'}
                          value={smtpPass}
                          onChange={(e) => setSmtpPass(e.target.value)}
                          placeholder="••••••••••••••••"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#0A5ED6]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSmtpPass((v) => !v)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                          aria-label={showSmtpPass ? 'Hide password' : 'Show password'}
                        >
                          {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase">SMTP Host</label>
                        <input
                          type="text"
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                          placeholder="smtp.gmail.com"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0A5ED6]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase">Port</label>
                        <input
                          type="number"
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(e.target.value)}
                          placeholder="587"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0A5ED6]"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400">For Gmail, use an App Password (requires 2-Step Verification enabled).</p>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-100 flex justify-between items-center">
                  <button onClick={() => setStep(5)} className="text-slate-500 font-semibold hover:text-[#0F172A] text-sm">Back</button>
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
                    disabled={loading}
                    className="inline-flex items-center gap-2 bg-[#0F172A] hover:bg-black text-white font-bold px-10 py-4 rounded-xl transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Executing Security Protocol...</> : <><ShieldCheck className="w-5 h-5" /> Execute & Send Welcome Emails</>}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 7: EMPLOYEE ACTIVATION STATUS (ROLLOUT) */}
            {step === 7 && (
              <div className="animate-fadeIn space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-[#0F172A] mb-2 flex items-center gap-2">
                      <Activity className="w-6 h-6 text-emerald-500" /> Email Dispatch Status
                    </h2>
                    {dispatchDone ? (
                      <p className="text-slate-500 text-sm">Welcome email dispatch finished. Review the delivery results below.</p>
                    ) : (
                      <p className="text-slate-500 text-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Dispatching welcome emails in the background...
                      </p>
                    )}
                    {dispatchError && (
                      <p className="text-red-600 text-sm font-semibold mt-2">Setup failed: {dispatchError}</p>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setStep(6)} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 font-bold px-6 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm">
                      Back
                    </button>
                    <button onClick={() => window.location.href = 'http://localhost:3002/login'} className="flex items-center gap-2 bg-slate-900 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-black transition-colors text-sm">
                      Go to Full Dashboard <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Employees</p>
                    <p className="text-2xl font-bold text-[#0F172A]">{validEmployees.length}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Emails Sent</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {dispatchDone ? Object.values(emailResults).filter(r => r.sent).length : '...'}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Emails Failed</p>
                    <p className="text-2xl font-bold text-red-500">
                      {dispatchDone ? Object.values(emailResults).filter(r => !r.sent).length : '...'}
                    </p>
                  </div>
                </div>

                {/* Status Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-sm relative">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Employee</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-center">Email Sent</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {validEmployees.map(emp => {
                          const result = emailResults[emp.email];
                          const sent = result ? result.sent : undefined;
                          return (
                            <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                <p className="font-semibold text-[#0F172A]">{emp.firstName} {emp.lastName}</p>
                                <p className="text-xs text-slate-500">{emp.email}</p>
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
                                  <span className="inline-flex bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Dispatched</span>
                                ) : sent === false ? (
                                  <span className="inline-flex bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Failed</span>
                                ) : (
                                  <span className="inline-flex bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold uppercase">Pending</span>
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
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-500" />
                    <div>
                      <p className="font-bold">Some welcome emails could not be delivered.</p>
                      <p className="text-amber-700 mt-1">
                        Verify the <span className="font-mono">SMTP_USER</span> / <span className="font-mono">SMTP_PASS</span> in the backend <span className="font-mono">.env</span> file. For Gmail, use a valid App Password (requires 2-Step Verification enabled on the account) and restart the API.
                      </p>
                    </div>
                  </div>
                )}


              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

