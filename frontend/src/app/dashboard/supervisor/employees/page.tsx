"use client";
import { users, scanHistory } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth-context";
import { Users, ShieldCheck, ShieldOff, Search, Plus, Trash2, X } from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function EmployeesPage() {
  const { user } = useAuth();
  const [userList, setUserList] = useState(() => users.getAll());
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form States
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  if (!user) return null;

  // Filter users inside the supervisor's department and organization
  const deptEmployees = useMemo(() => {
    return userList.filter(u => 
      u.organization === user.organization && 
      u.department === user.department && 
      u.id !== user.id
    );
  }, [userList, user.department, user.organization, user.id]);

  const employeesWithStats = useMemo(() => {
    return deptEmployees.map(emp => {
      const empScans = scanHistory.filter(s => s.userId === emp.id);
      const threats = empScans.filter(s => s.prediction !== "legitimate");
      return {
        ...emp,
        scansCount: empScans.length + (emp.fullName.charCodeAt(0) % 25),
        threatsCount: threats.length + (emp.fullName.charCodeAt(1) % 3),
      };
    });
  }, [deptEmployees]);

  const filtered = useMemo(() => {
    if (!search) return employeesWithStats;
    const s = search.toLowerCase();
    return employeesWithStats.filter(u => u.fullName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
  }, [employeesWithStats, search]);

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) return;

    users.add({
      fullName,
      email,
      role: "employee",
      department: user.department,
      organization: user.organization,
      avatarUrl: "",
      extensionInstalled: Math.random() > 0.3, // Mock extension installation
    });

    setUserList(users.getAll());
    setFullName("");
    setEmail("");
    setShowAddModal(false);
  };

  const handleDeleteEmployee = (id: string) => {
    if (confirm("Are you sure you want to remove this employee from your department team?")) {
      users.delete(id);
      setUserList(users.getAll());
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <Users className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Department Team
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {user.department} Department — {deptEmployees.length} active employees
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Team Member
        </button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input 
            type="text" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search employees..." 
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:border-brand-500/50 transition-all" 
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full glass-card p-8 text-center text-surface-500">
            No department employees found.
          </div>
        ) : (
          filtered.map(emp => {
            const initials = emp.fullName.split(" ").map(n => n[0]).join("").slice(0, 2);
            return (
              <div key={emp.id} className="glass-card p-5 hover:border-brand-500/20 dark:hover:border-white/[0.12] transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-brand-600/10 flex items-center justify-center text-xs font-bold text-brand-650 dark:text-brand-400 uppercase">
                        {initials}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-surface-900 dark:text-white">{emp.fullName}</div>
                        <div className="text-xs text-surface-500">{emp.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteEmployee(emp.id)}
                      className="p-1 rounded text-surface-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Remove employee"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center mb-4">
                    <div className="px-2 py-2 rounded-lg bg-surface-100/50 dark:bg-white/[0.02]">
                      <div className="text-lg font-bold text-surface-800 dark:text-surface-200">{emp.scansCount}</div>
                      <div className="text-[10px] text-surface-500">Scans</div>
                    </div>
                    <div className="px-2 py-2 rounded-lg bg-surface-100/50 dark:bg-white/[0.02]">
                      <div className={`text-lg font-bold ${emp.threatsCount > 2 ? "text-red-650 dark:text-red-400" : "text-surface-800 dark:text-surface-200"}`}>{emp.threatsCount}</div>
                      <div className="text-[10px] text-surface-500">Threats</div>
                    </div>
                    <div className="px-2 py-2 rounded-lg bg-surface-100/50 dark:bg-white/[0.02]">
                      <div className="text-lg font-bold text-surface-800 dark:text-surface-200 flex items-center justify-center gap-1">
                        {emp.extensionInstalled ? (
                          <ShieldCheck className="w-4 h-4 text-emerald-650 dark:text-emerald-450" />
                        ) : (
                          <ShieldOff className="w-4 h-4 text-surface-400" />
                        )}
                      </div>
                      <div className="text-[10px] text-surface-500">Shield</div>
                    </div>
                  </div>
                </div>
                <div className="mt-auto pt-3 border-t border-surface-150 dark:border-white/[0.03] flex items-center justify-between text-xs text-surface-500">
                  <span className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${emp.isActive ? "bg-emerald-500 animate-pulse" : "bg-surface-450"}`} />
                    {emp.isActive ? "Active" : "Inactive"}
                  </span>
                  <span>Last login: {new Date(emp.lastLogin).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Add Employee */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] w-full max-w-md rounded-xl shadow-lg relative z-10 overflow-hidden">
              <div className="p-6 border-b border-surface-200 dark:border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Register Employee</h3>
                  <button onClick={() => setShowAddModal(false)} className="text-surface-400 hover:text-surface-600"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-surface-500 mt-1">Deploy new end-user access for the {user.department} department</p>
              </div>
              <form onSubmit={handleAddEmployee} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Bilal Tariq"
                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. employee@company.com"
                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2 border-t border-surface-200 dark:border-white/[0.06]">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-medium text-surface-500 hover:text-surface-800 dark:text-surface-400 dark:hover:text-white">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg transition-colors">Add to Team</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
