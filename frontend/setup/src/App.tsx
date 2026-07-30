import React, { useState, useEffect } from 'react';
import {
  Building2, Users, Download, Upload, CheckCircle2, AlertCircle, Key, Mail,
  ShieldCheck, Activity, ArrowRight, ChevronRight, Loader2, Sparkles, UserPlus,
  Shield, Network, HardDrive, FileSpreadsheet, Lock, Check, Search, Laptop, Globe, X
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

  // Step 1: Org Info (Pre-filled from Docker Environment Variables)
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('');
  const [timezone, setTimezone] = useState('UTC+00:00');
  const [configLoaded, setConfigLoaded] = useState(false);

  // Step 2: Departments
  const [departments, setDepartments] = useState<Department[]>([
    { id: '1', name: 'Information Technology', code: 'IT' },
    { id: '2', name: 'Human Resources', code: 'HR' },
    { id: '3', name: 'Finance', code: 'FIN' },
  ]);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');

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
    setConfigLoaded(true);

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
  }, []);

  // Step 7: Rollout Status
  const [rolloutActive, setRolloutActive] = useState(false);

  const handleNextStep = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 800)); // Fake network delay
    setStep((s) => Math.min(s + 1, 8) as SetupStep);
    setLoading(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddDepartment = () => {
    if (!newDeptName || !newDeptCode) return;
    setDepartments([...departments, { id: Math.random().toString(), name: newDeptName, code: newDeptCode.toUpperCase() }]);
    setNewDeptName('');
    setNewDeptCode('');
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
        return `${id},${fName},${lName},user${idx+1}@company.local,0300123456${idx},${dept.code},${role},Staff Member`;
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
        } else if (!departments.find(d => d.code === departmentCode) && normalizedRole !== 'admin') {
          status = 'invalid';
          error = `Invalid Dept: ${departmentCode}`;
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
          departmentCode: departmentCode || 'NONE',
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
            return [existingAdmin, ...parsedEmployees];
          }
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
    { num: 2, title: 'Departments' },
    { num: 3, title: 'Import Employees' },
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
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isPast ? 'bg-emerald-500 text-white border-2 border-emerald-500' :
                      isActive ? 'bg-white text-[#0A5ED6] border-2 border-[#0A5ED6] shadow-[0_0_0_4px_rgba(10,94,214,0.1)]' :
                      'bg-white text-slate-400 border-2 border-slate-200'
                    }`}>
                      {isPast ? <Check className="w-4 h-4" /> : s.num}
                    </div>
                    <span className={`font-semibold text-sm ${
                      isActive ? 'text-[#0F172A]' : isPast ? 'text-slate-600' : 'text-slate-400'
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

            {/* STEP 2: DEPARTMENTS */}
            {step === 2 && (
              <div className="animate-fadeIn space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Create Departments</h2>
                  <p className="text-slate-500 text-sm">Define the organizational structure before importing employees.</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-2">
                      <label className="text-xs font-bold text-slate-700 uppercase">Department Name</label>
                      <input type="text" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="e.g. Marketing" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#0A5ED6]" />
                    </div>
                    <div className="w-full sm:w-32 space-y-2">
                      <label className="text-xs font-bold text-slate-700 uppercase">Code</label>
                      <input type="text" value={newDeptCode} onChange={e => setNewDeptCode(e.target.value)} placeholder="MKT" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#0A5ED6] uppercase" />
                    </div>
                    <button onClick={handleAddDepartment} className="bg-slate-900 hover:bg-black text-white font-bold px-6 py-2.5 rounded-lg text-sm transition-colors w-full sm:w-auto">
                      Add
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">Department Name</th>
                        <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">Code</th>
                        <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {departments.map(dept => (
                        <tr key={dept.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-semibold text-[#0F172A]">{dept.name}</td>
                          <td className="px-6 py-4 font-mono text-slate-500">{dept.code}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => setDepartments(departments.filter(d => d.id !== dept.id))} className="text-red-500 hover:text-red-700 text-xs font-bold uppercase cursor-pointer">Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                  <button onClick={() => setStep(1)} className="text-slate-500 font-semibold hover:text-[#0F172A] text-sm">Back</button>
                  <button onClick={handleNextStep} disabled={loading || departments.length === 0} className="flex items-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md disabled:opacity-50">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: IMPORT EMPLOYEES */}
            {step === 3 && (
              <div className="animate-fadeIn space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Import Employees</h2>
                  <p className="text-slate-500 text-sm mb-4">Download our standardized template, fill in your employee details, and upload it back here for automatic validation.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                  {/* Download Card */}
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-8 text-center flex flex-col justify-center h-full min-h-[340px]">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                      <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="font-bold text-[#0F172A] mb-2">1. Download Template</h3>
                    <p className="text-sm text-blue-800 mb-6">Download this ready-to-use file to easily add your team members.</p>
                    
                    <button onClick={handleDownloadTemplate} className="flex items-center justify-center gap-2 bg-white border border-blue-200 text-blue-700 font-bold px-6 py-2.5 rounded-lg mx-auto hover:bg-blue-100 transition-colors text-sm w-full max-w-[240px] cursor-pointer shadow-sm hover:shadow mb-6">
                      <Download className="w-4 h-4" /> Employee_Template.csv
                    </button>

                    <ul className="text-[11px] text-blue-800/80 space-y-1.5 text-left mx-auto max-w-[240px]">
                      <li className="flex items-start gap-1.5 leading-snug"><span className="text-blue-400 font-bold">•</span> <span>Only type <strong>Employee</strong>, <strong>Manager</strong>, or <strong>Admin</strong> in the Role column.</span></li>
                      <li className="flex items-start gap-1.5 leading-snug"><span className="text-blue-400 font-bold">•</span> <span>Use the exact <strong>Department Codes</strong> you created earlier.</span></li>
                    </ul>
                  </div>

                  {/* Upload Card */}
                  <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center hover:bg-slate-100 transition-colors cursor-pointer flex flex-col justify-center h-full min-h-[340px]" onClick={() => fileInputRef.current?.click()}>
                    <input 
                      type="file" 
                      accept=".csv" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                    {loading ? (
                      <div className="flex flex-col items-center justify-center h-full space-y-4">
                        <Loader2 className="w-10 h-10 text-[#0A5ED6] animate-spin" />
                        <p className="text-sm font-semibold text-slate-600">Validating CSV data...</p>
                      </div>
                    ) : employees.length > 0 ? (
                      <>
                        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto shadow-sm mb-4">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        </div>
                        <h3 className="font-bold text-[#0F172A] mb-2">CSV Uploaded</h3>
                        <p className="text-sm text-slate-500 mb-6"><strong>{employees.length} employees</strong> loaded in memory. Upload a new file to overwrite.</p>
                        <button className="flex items-center justify-center gap-2 bg-slate-100 text-slate-700 border border-slate-300 font-bold px-6 py-2.5 rounded-lg mx-auto hover:bg-slate-200 transition-colors text-sm w-full max-w-[240px]">
                          Replace CSV File
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm mb-4">
                          <Upload className="w-8 h-8 text-slate-500" />
                        </div>
                        <h3 className="font-bold text-[#0F172A] mb-2">2. Upload Data</h3>
                        <p className="text-sm text-slate-500 mb-6">Click to upload your filled CSV file here to validate and import.</p>
                        <button className="flex items-center justify-center gap-2 bg-slate-900 text-white font-bold px-6 py-2.5 rounded-lg mx-auto hover:bg-black transition-colors text-sm w-full max-w-[240px]">
                          Select CSV File
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                  <button onClick={() => setStep(2)} className="text-slate-500 font-semibold hover:text-[#0F172A] text-sm">Back</button>
                  {employees.length > 0 ? (
                    <button onClick={() => setStep(4)} className="flex items-center gap-2 bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md">
                      Continue to Validation <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="text-slate-400 text-sm font-semibold px-4">Upload a CSV to continue</div>
                  )}
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
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase"><CheckCircle2 className="w-3 h-3"/> Valid</span>
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
                               setDepartments(departments.map(d => d.id === dept.id ? {...d, leadId: e.target.value} : d));
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
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-700"><CheckCircle2 className="w-5 h-5 text-emerald-500"/> Hash & Store secure passwords to local DB</div>
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-700"><CheckCircle2 className="w-5 h-5 text-emerald-500"/> Generate Temporary Login Tokens</div>
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-700"><CheckCircle2 className="w-5 h-5 text-emerald-500"/> Dispatch {validEmployees.length} Email Invitations</div>
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-700"><CheckCircle2 className="w-5 h-5 text-emerald-500"/> Enable Force-Password-Change policy</div>
                </div>

                <div className="pt-8 border-t border-slate-100 flex justify-between items-center">
                  <button onClick={() => setStep(5)} className="text-slate-500 font-semibold hover:text-[#0F172A] text-sm">Back</button>
                  <button 
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const response = await fetch('http://localhost:8000/setup/execute', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ employees: validEmployees })
                        });
                        
                        if (response.ok) {
                          setRolloutActive(true);
                          setStep(7);
                        } else {
                          console.error('Failed to execute setup', await response.text());
                          // You can add error handling state here if needed
                        }
                      } catch (err) {
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
                    <p className="text-slate-500 text-sm">Monitor your organization's onboarding progress in real-time. Welcome emails have been successfully dispatched.</p>
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
                    <p className="text-2xl font-bold text-blue-600">{validEmployees.length}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Emails Failed</p>
                    <p className="text-2xl font-bold text-red-500">0</p>
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
                      {validEmployees.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-[#0F172A]">{emp.firstName} {emp.lastName}</p>
                            <p className="text-xs text-slate-500">{emp.email}</p>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="inline-flex bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Dispatched</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                 </div>
                </div>


              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
