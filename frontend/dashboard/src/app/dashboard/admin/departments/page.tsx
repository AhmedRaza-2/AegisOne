"use client";
import { useState, useMemo, useDeferredValue, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { 
  Building2, Plus, Users, Trash2, X, Key, ShieldCheck, 
  CheckCircle2, XCircle, ChevronRight, UserPlus, Lock, Search, AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function DepartmentsPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<any[]>([]);
  const [userList, setUserList] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Department Form
  const [deptName, setDeptName] = useState("");
  const [deptManagerId, setDeptManagerId] = useState("");

  // User Form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"manager" | "employee">("employee");
  const [targetDeptId, setTargetDeptId] = useState("");

  // Quick Action States
  const [newPwInput, setNewPwInput] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getHeaders = () => {
    const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    return { "Authorization": `Bearer ${token || ""}`, "Content-Type": "application/json" };
  };

  const fetchData = async () => {
    try {
      const [deptsRes, usersRes] = await Promise.all([
        fetch("http://localhost:8000/admin/departments", { headers: getHeaders() }),
        fetch("http://localhost:8000/admin/users", { headers: getHeaders() })
      ]);

      if (deptsRes.ok) {
        const dData = await deptsRes.json();
        setDepartments(dData.departments || []);
      }
      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUserList(uData.users || []);
      }
    } catch (e) {
      showToast("Failed to load organization data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Filtered list of users based on selected department tab & search
  const filteredUsers = useMemo(() => {
    return userList.filter((u) => {
      // Department filter
      if (selectedDeptId !== "all") {
        const deptObj = departments.find(d => d.id === selectedDeptId);
        const matchesId = u.department_id === selectedDeptId;
        const matchesName = deptObj && u.department === deptObj.name;
        if (!matchesId && !matchesName) return false;
      }
      // Search filter
      if (deferredSearch.trim()) {
        const q = deferredSearch.toLowerCase();
        const nameMatch = u.full_name?.toLowerCase().includes(q);
        const emailMatch = u.email?.toLowerCase().includes(q);
        const roleMatch = u.role?.toLowerCase().includes(q);
        return nameMatch || emailMatch || roleMatch;
      }
      return true;
    });
  }, [userList, selectedDeptId, deferredSearch, departments]);

  // Create Department Handler
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim()) return;

    try {
      const res = await fetch("http://localhost:8000/admin/departments", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          name: deptName.trim(),
          manager_id: deptManagerId ? parseInt(deptManagerId) : null
        })
      });

      if (res.ok) {
        showToast("Department created successfully", "success");
        setDeptName("");
        setDeptManagerId("");
        setShowAddDeptModal(false);
        fetchData();
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to create department", "error");
      }
    } catch {
      showToast("Network error", "error");
    }
  };

  // Add User Handler
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) return;

    try {
      const res = await fetch("http://localhost:8000/admin/users", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          password: password,
          role: role,
          department_id: targetDeptId ? parseInt(targetDeptId) : null
        })
      });

      if (res.ok) {
        showToast("User account created successfully", "success");
        setFullName(""); setEmail(""); setPassword("");
        setShowAddUserModal(false);
        fetchData();
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to create user", "error");
      }
    } catch {
      showToast("Network error", "error");
    }
  };

  // Reset Password Handler
  const handleResetPassword = async (userId: number) => {
    if (!newPwInput || newPwInput.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ new_password: newPwInput })
      });
      if (res.ok) {
        showToast("Password reset successfully", "success");
        setNewPwInput("");
        setSelectedUser(null);
      } else {
        showToast("Failed to reset password", "error");
      }
    } catch {
      showToast("Network error", "error");
    }
  };

  // Delete User Handler
  const handleDeleteUser = async (userId: number) => {
    try {
      const res = await fetch(`http://localhost:8000/admin/users/${userId}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (res.ok) {
        showToast("User account deleted", "success");
        setSelectedUser(null);
        fetchData();
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to delete user", "error");
      }
    } catch {
      showToast("Network error", "error");
    }
  };

  // Toggle Account Status
  const handleToggleStatus = async (userObj: any) => {
    const nextStatus = userObj.account_status === "disabled" || userObj.account_status === "suspended" ? "approved" : "disabled";
    try {
      const res = await fetch(`http://localhost:8000/admin/users/${userObj.id}/status`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ status: nextStatus, reason: "Admin status update" })
      });
      if (res.ok) {
        showToast(`Account status updated to ${nextStatus}`, "success");
        fetchData();
      }
    } catch {
      showToast("Network error", "error");
    }
  };

  if (!user) return null;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-7xl mx-auto">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-white font-medium z-[999] text-sm ${
              toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <Building2 className="w-6 h-6 text-brand-600 dark:text-brand-400" /> Department & User Management
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Organize departments, assign managers, and manage employee credentials across your organization.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddDeptModal(true)}
            className="px-4 py-2 bg-surface-100 dark:bg-white/[0.04] text-surface-900 dark:text-white text-xs font-semibold rounded-xl hover:bg-surface-200 dark:hover:bg-white/[0.08] transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4 text-brand-500" /> Add Department
          </button>
          <button
            onClick={() => setShowAddUserModal(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 shadow-sm"
          >
            <UserPlus className="w-4 h-4" /> Add User / Manager
          </button>
        </div>
      </motion.div>

      {/* Department Cards Grid (Snapshots) */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => setSelectedDeptId("all")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            selectedDeptId === "all"
              ? "bg-brand-50/60 border-brand-500 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300 dark:border-brand-500/50 shadow-sm"
              : "bg-white dark:bg-[#141A29] border-surface-200 dark:border-white/[0.06] text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-white/[0.02]"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-70">Entire Organization</span>
            <Building2 className="w-4 h-4 text-brand-500" />
          </div>
          <p className="text-2xl font-bold text-surface-900 dark:text-white">{userList.length}</p>
          <p className="text-[11px] text-surface-500 mt-1">Total Members Across All Depts</p>
        </button>

        {departments.map((dept) => {
          const isSelected = selectedDeptId === dept.id;
          return (
            <button
              key={dept.id}
              onClick={() => setSelectedDeptId(dept.id)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                isSelected
                  ? "bg-brand-50/60 border-brand-500 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300 dark:border-brand-500/50 shadow-sm"
                  : "bg-white dark:bg-[#141A29] border-surface-200 dark:border-white/[0.06] text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-surface-900 dark:text-white truncate">{dept.name}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-100 dark:bg-white/[0.06] text-surface-500">
                  {dept.employee_count} members
                </span>
              </div>
              <p className="text-xs text-surface-500 font-medium truncate">
                Manager: <span className="text-surface-900 dark:text-white font-semibold">{dept.manager_name || "Unassigned"}</span>
              </p>
            </button>
          );
        })}
      </motion.div>

      {/* Main Employee & Manager Table Section */}
      <motion.div variants={fadeUp} className="stat-card space-y-4">
        {/* Table Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-surface-100 dark:border-white/[0.06] pb-4">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-surface-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search user name, email, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-xs text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="text-xs text-surface-500 font-medium">
            Showing <span className="font-bold text-surface-900 dark:text-white">{filteredUsers.length}</span> members
          </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-200 dark:border-white/[0.06] text-surface-500 uppercase tracking-wider">
                <th className="py-3 px-2">Member</th>
                <th className="py-3 px-2">Role</th>
                <th className="py-3 px-2">Department</th>
                <th className="py-3 px-2">Status</th>
                <th className="py-3 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-surface-400">Loading members...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-surface-400">No members found matching your filter</td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-50 dark:hover:bg-white/[0.01] transition-colors">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 font-bold flex items-center justify-center shrink-0">
                          {u.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-surface-900 dark:text-white">{u.full_name}</p>
                          <p className="text-[11px] text-surface-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${
                        u.role === "admin" || u.role === "super_admin"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : u.role === "manager" || u.role === "department_admin"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
                      }`}>
                        {u.role === "department_admin" ? "Manager" : u.role}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-medium text-surface-700 dark:text-surface-300">
                      {u.department || "Organization"}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${
                        u.account_status === "disabled" || u.account_status === "suspended"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      }`}>
                        {u.account_status || "Approved"}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedUser(u)}
                          className="px-2.5 py-1 bg-surface-100 dark:bg-white/[0.04] text-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-200 dark:hover:bg-white/[0.08] transition-colors text-[11px] font-medium flex items-center gap-1"
                        >
                          <Key className="w-3 h-3 text-amber-500" /> Options
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Add Department Modal */}
      <AnimatePresence>
        {showAddDeptModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-brand-500" /> Create New Department
                </h3>
                <button onClick={() => setShowAddDeptModal(false)} className="text-surface-400 hover:text-surface-700"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleCreateDepartment} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Department Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Cybersecurity, HR, Finance"
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-xl text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Assign Manager (Optional)</label>
                  <select
                    value={deptManagerId}
                    onChange={(e) => setDeptManagerId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-xl text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="">No Manager Assigned</option>
                    {userList.filter(u => u.role === "manager" || u.role === "department_admin").map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name} ({m.email})</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddDeptModal(false)} className="px-4 py-2 text-xs font-medium text-surface-500">Cancel</button>
                  <button type="submit" className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-xl">Create Department</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add User / Manager Modal */}
      <AnimatePresence>
        {showAddUserModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-brand-500" /> Add Member / Manager
                </h3>
                <button onClick={() => setShowAddUserModal(false)} className="text-surface-400 hover:text-surface-700"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAddUser} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-xl text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-xl text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-xl text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full px-3.5 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-xl text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Department</label>
                    <select
                      value={targetDeptId}
                      onChange={(e) => setTargetDeptId(e.target.value)}
                      className="w-full px-3.5 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-xl text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="">General</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-3">
                  <button type="button" onClick={() => setShowAddUserModal(false)} className="px-4 py-2 text-xs font-medium text-surface-500">Cancel</button>
                  <button type="submit" className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-xl">Create Account</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected User Management Modal Options */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-surface-100 dark:border-white/[0.06] pb-3">
                <div>
                  <h3 className="text-base font-bold text-surface-900 dark:text-white">{selectedUser.full_name}</h3>
                  <p className="text-xs text-surface-500">{selectedUser.email} · {selectedUser.department || "General"}</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="text-surface-400 hover:text-surface-700"><X className="w-5 h-5" /></button>
              </div>

              {/* Reset Password Form */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-medium text-surface-500">Reset User Password</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Enter new password"
                    value={newPwInput}
                    onChange={(e) => setNewPwInput(e.target.value)}
                    className="flex-1 px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-xl text-xs text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
                  />
                  <button
                    onClick={() => handleResetPassword(selectedUser.id)}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-xl flex items-center gap-1"
                  >
                    <Key className="w-3.5 h-3.5" /> Reset
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-surface-100 dark:border-white/[0.06]">
                <button
                  onClick={() => handleToggleStatus(selectedUser)}
                  className="flex-1 py-2 bg-surface-100 dark:bg-white/[0.04] text-surface-700 dark:text-surface-300 text-xs font-medium rounded-xl hover:bg-surface-200 dark:hover:bg-white/[0.08] transition-colors"
                >
                  {selectedUser.account_status === "disabled" ? "Enable Account" : "Disable Account"}
                </button>
                <button
                  onClick={() => handleDeleteUser(selectedUser.id)}
                  className="py-2 px-4 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-xl flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
