"use client";
import { Users, Search, ShieldCheck, ShieldOff, Plus, Trash2, X, KeyRound, Ban, CheckCircle } from "lucide-react";
import { useState, useMemo, useDeferredValue, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";

export function getRoleBadge(role: string) {
  switch (role) {
    case "global_admin":
    case "super_admin":
      return { label: "Platform Head", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" };
    case "admin":
      return { label: "Admin", color: "bg-red-500/10 text-red-600 dark:text-red-400" };
    case "manager":
      return { label: "Manager", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
    case "employee":
      return { label: "Employee", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
    default:
      return { label: role, color: "bg-surface-500/10 text-surface-600 dark:text-surface-400" };
  }
}

export default function UsersPage() {
  const { user } = useAuth();
  const [userList, setUserList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [roleFilter, setRoleFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form States
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "employee">("employee");
  const [departmentId, setDepartmentId] = useState("");

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("aegis_access_token");
      if (!token) return;

      const [usersRes, deptsRes] = await Promise.all([
        fetch("http://localhost:8000/admin/users", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("http://localhost:8000/admin/departments", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUserList(data.users || []);
      }
      if (deptsRes.ok) {
        const data = await deptsRes.json();
        setDepartments(data.departments || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return userList.filter(u => {
      const matchSearch = !deferredSearch || 
        u.full_name?.toLowerCase().includes(deferredSearch.toLowerCase()) || 
        u.email?.toLowerCase().includes(deferredSearch.toLowerCase());
      
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [userList, deferredSearch, roleFilter]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) return;

    const generatedPassword = Math.random().toString(36).slice(-10) + 'X#';

    try {
      const token = localStorage.getItem("aegis_access_token");
      const res = await fetch("http://localhost:8000/admin/users", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          email,
          full_name: fullName,
          password: generatedPassword,
          role: role,
          department_id: departmentId ? parseInt(departmentId) : null
        })
      });

      if (res.ok) {
        // Send email via setup logic in the background
        const names = fullName.split(' ');
        fetch("http://localhost:8000/setup/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employees: [{
              firstName: names[0],
              lastName: names.length > 1 ? names.slice(1).join(' ') : 'User',
              email,
              departmentCode: departments.find(d => d.id.toString() === departmentId)?.name || "General",
              role: role,
              designation: role === "employee" ? "Employee" : "Management",
              generatedPassword
            }]
          })
        }).catch(console.error);

        await fetchData();
        setFullName("");
        setEmail("");
        setShowAddModal(false);
      } else {
        const error = await res.json();
        alert(error.detail || "Failed to create user");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "disabled" ? "active" : "disabled";
    if (!confirm(`Are you sure you want to mark this user as ${newStatus}?`)) return;

    try {
      const token = localStorage.getItem("aegis_access_token");
      const res = await fetch(`http://localhost:8000/admin/users/${id}/status`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus, reason: "Admin requested" })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleResetPassword = async (id: number) => {
    if (!confirm("Are you sure you want to reset this user's password?")) return;
    const newPassword = prompt("Enter new password for the user:");
    if (!newPassword) return;

    try {
      const token = localStorage.getItem("aegis_access_token");
      const res = await fetch(`http://localhost:8000/admin/users/${id}/password?new_password=${encodeURIComponent(newPassword)}`, {
        method: "PUT",
        headers: { 
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        alert("Password reset successfully.");
      } else {
        alert("Failed to reset password.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <Users className="w-6 h-6 text-brand-650 dark:text-brand-400" /> User Management
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Manage employees, managers, and administrators for your organization
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input 
            type="text" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search users..." 
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:border-brand-500/50 transition-all" 
          />
        </div>
        <div className="flex gap-2">
          {["all", "admin", "manager", "employee"].map(r => (
            <button 
              key={r} 
              onClick={() => setRoleFilter(r)} 
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                roleFilter === r 
                  ? "bg-brand-600/10 text-brand-600 dark:text-brand-400 border border-brand-500/20" 
                  : "text-surface-500 hover:text-surface-900 border border-transparent hover:bg-surface-100 dark:text-surface-400 dark:hover:text-white dark:hover:bg-white/[0.04]"
              }`}
            >
              {r === "all" ? "All Roles" : r === "admin" ? "Admin" : r === "manager" ? "Manager" : "Employee"}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-white/[0.06] bg-surface-50/50 dark:bg-white/[0.01]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-surface-500">Loading users...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-surface-500">No users found.</td>
                </tr>
              ) : (
                filtered.map(u => {
                  const badge = getRoleBadge(u.role);
                  const initials = (u.full_name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2);
                  const deptName = departments.find(d => d.id === u.department_id)?.name || "General";
                  
                  return (
                    <tr key={u.id} className="border-b border-surface-100 dark:border-white/[0.03] hover:bg-surface-100/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center text-xs font-bold text-brand-650 dark:text-brand-400 uppercase">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-surface-800 dark:text-surface-200">{u.full_name}</div>
                            <div className="text-[10px] text-surface-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-surface-700 dark:text-surface-300">
                        {deptName}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-xs ${
                          u.account_status === "active" ? "text-emerald-650 dark:text-emerald-450" : "text-surface-400"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.account_status === "active" ? "bg-emerald-500 animate-pulse" : "bg-surface-400"}`} />
                          {u.account_status === "active" ? "Active" : u.account_status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleUpdateStatus(u.id, u.account_status)}
                            className="p-1 rounded text-surface-400 hover:text-brand-500 hover:bg-brand-500/10 transition-colors"
                            title={u.account_status === "disabled" ? "Enable User" : "Disable User"}
                          >
                            {u.account_status === "disabled" ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => handleResetPassword(u.id)}
                            className="p-1 rounded text-surface-400 hover:text-brand-500 hover:bg-brand-500/10 transition-colors"
                            title="Reset Password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add User */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] w-full max-w-md rounded-xl shadow-lg relative z-10 overflow-hidden">
              <div className="p-6 border-b border-surface-200 dark:border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Add User</h3>
                  <button onClick={() => setShowAddModal(false)} className="text-surface-400 hover:text-surface-600"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-surface-500 mt-1">Register an employee, manager, or admin profile</p>
              </div>
              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Asma Jamil"
                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Corporate Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. supervisor@company.com"
                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Access Level</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    {user.role === "admin" || user.role === "super_admin" ? (
                      <option value="admin">Admin</option>
                    ) : null}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Department Assignment</label>
                  <select
                    required
                    value={departmentId}
                    onChange={e => setDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50"
                  >
                    <option value="" disabled>Select Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 justify-end pt-2 border-t border-surface-200 dark:border-white/[0.06]">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-medium text-surface-500 hover:text-surface-800 dark:text-surface-400 dark:hover:text-white">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg transition-colors">Create User</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
