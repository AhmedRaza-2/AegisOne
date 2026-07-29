"use client";
import { useState, useMemo, useDeferredValue, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { 
  Users, Search, Activity, ShieldAlert, Download, Key, TrendingUp, 
  Sparkles, X, Plus, ShieldCheck, Globe, Image as ImageIcon, 
  Trash2, UserCheck, CheckCircle2, Lock, BarChart3, Power
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function EmployeesPage() {
  const { user, theme, logout } = useAuth();
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [realStats, setRealStats] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("24h");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  // Modals state
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add employee form state
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState(false);

  // Profile actions state
  const [newPassword, setNewPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Custom styled popup modal states
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [pwModal, setPwModal] = useState<{ userId: number; userName: string } | null>(null);
  const [pwInput, setPwInput] = useState("");

  const fetchData = () => {
    if (!user) return;
    const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    const headers: Record<string, string> = token ? { "Authorization": `Bearer ${token}` } : {};

    console.log(`[Employees & Analytics] Fetching data (range: ${timeRange})`);

    // Fetch Stats
    fetch(`http://localhost:8000/admin/stats?time_range=${timeRange}`, { headers })
      .then(res => {
        if (res.status === 401) {
          logout();
          return;
        }
        return res.json();
      })
      .then(data => {
        if (data && !data.detail) {
          setRealStats(data);
        }
      })
      .catch(err => console.error("[Employees Page] Stats fetch error:", err));

    // Fetch Users
    fetch(`http://localhost:8000/admin/users?time_range=${timeRange}`, { headers })
      .then(res => {
        if (res.status === 401) {
          logout();
          return;
        }
        return res.json();
      })
      .then(data => {
        if (data && data.users) {
          setDbUsers(data.users);
        }
      })
      .catch(err => console.error("[Employees Page] Users fetch error:", err));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [user, timeRange]);

  if (!user) return null;

  const isDark = theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const tooltipBg = isDark ? "#1e293b" : "#ffffff";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tooltipColor = isDark ? "#ffffff" : "#0f172a";

  // Coverage calculations
  const coverageCards = useMemo(() => {
    if (!realStats) {
      return [
        { label: "URL Protection", value: "100%", icon: Globe, color: "text-blue-500" },
        { label: "Credential Protection", value: "100%", icon: Key, color: "text-emerald-500" },
        { label: "Download Protection", value: "100%", icon: Download, color: "text-amber-500" },
        { label: "Image AI", value: "100%", icon: ImageIcon, color: "text-purple-500" },
      ];
    }
    
    const scans = realStats.scans_today || 0;
    const threats = realStats.threats_today || 0;
    const urlScore = scans > 0 ? Math.max(50, 100 - Math.round((threats / scans) * 100)) : 100;
    
    return [
      { label: "URL Protection", value: `${urlScore}%`, icon: Globe, color: "text-blue-500" },
      { label: "Credential Protection", value: "100%", icon: Key, color: "text-emerald-500" },
      { label: "Download Protection", value: "100%", icon: Download, color: "text-amber-500" },
      { label: "Image AI", value: "100%", icon: ImageIcon, color: "text-purple-500" },
    ];
  }, [realStats]);

  const securityTrendData = useMemo(() => {
    if (!realStats?.daily_trend) return [];
    return realStats.daily_trend;
  }, [realStats]);

  const threatDistData = useMemo(() => {
    if (!realStats || !realStats.top_threat_types) {
      return [
        { name: "Safe Scans", value: 8, color: "#22c55e" },
        { name: "Phishing", value: 5, color: "#ef4444" },
        { name: "Malware", value: 2, color: "#f59e0b" },
      ];
    }
    const types = realStats.top_threat_types;
    const colorMap: Record<string, string> = {
      "Safe Scans": "#22c55e",
      "Phishing": "#ef4444",
      "Malware": "#f59e0b"
    };
    return Object.keys(types).map(k => ({
      name: k,
      value: types[k],
      color: colorMap[k] || "#8b5cf6"
    })).filter(d => d.value > 0);
  }, [realStats]);

  const employeesWithStats = useMemo(() => {
    return dbUsers.map(emp => {
      const totalScans = emp.total_scans || 0;
      const threats = emp.threats || 0;
      const riskScore = emp.risk_score || 0;
      const score = Math.max(0, 100 - riskScore);
      
      let status = "Excellent";
      if (score < 60) status = "Warning";
      else if (score < 80) status = "Needs Attention";

      return {
        ...emp,
        fullName: emp.full_name || emp.fullName || "Unknown User",
        score,
        threatsCount: threats,
        status,
        downloadsScanned: Math.floor(totalScans * 0.1),
        credentialEvents: Math.floor(threats * 0.2),
        lastActivity: totalScans > 0 ? "Just now" : "Offline"
      };
    });
  }, [dbUsers]);

  const filtered = useMemo(() => {
    if (!deferredSearch) return employeesWithStats;
    const s = deferredSearch.toLowerCase();
    return employeesWithStats.filter(u => u.fullName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
  }, [employeesWithStats, deferredSearch]);

  // CRUD Actions
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setAddSuccess(false);

    if (!addName || !addEmail || !addPassword) {
      setAddError("Please fill in all fields.");
      return;
    }

    try {
      const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
      const res = await fetch("http://localhost:8000/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          email: addEmail,
          full_name: addName,
          password: addPassword,
          role: "employee"
        })
      });

      const data = await res.json();
      if (res.ok) {
        setAddSuccess(true);
        setAddName("");
        setAddEmail("");
        setAddPassword("");
        fetchData();
        setTimeout(() => {
          setShowAddModal(false);
          setAddSuccess(false);
        }, 1500);
      } else {
        setAddError(data.detail || "Failed to create employee account.");
      }
    } catch (err) {
      setAddError("Connection error. Please try again.");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetSuccess(false);

    if (!newPassword) return;

    try {
      const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
      const res = await fetch(`http://localhost:8000/admin/users/${selectedEmployee.id}/password?new_password=${encodeURIComponent(newPassword)}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (res.ok) {
        setResetSuccess(true);
        setNewPassword("");
        setTimeout(() => setResetSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePromoteUser = async () => {
    try {
      const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
      const res = await fetch(`http://localhost:8000/admin/users/${selectedEmployee.id}/promote`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (res.ok) {
        setSelectedEmployee({ ...selectedEmployee, role: "manager" });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async () => {
    try {
      const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
      const res = await fetch(`http://localhost:8000/admin/users/${selectedEmployee.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (res.ok) {
        setSelectedEmployee(null);
        setConfirmDelete(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetPasswordDirect = async (userId: number, pw: string) => {
    try {
      const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
      const res = await fetch(`http://localhost:8000/admin/users/${userId}/password?new_password=${encodeURIComponent(pw)}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setPwModal(null);
        setPwInput("");
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePromoteDirect = async (userId: number, name: string) => {
    try {
      const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
      const res = await fetch(`http://localhost:8000/admin/users/${userId}/promote`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRoleChangeDirect = async (userId: number, newRole: string, name: string) => {
    try {
      const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
      const res = await fetch(`http://localhost:8000/admin/users/${userId}/role?role=${newRole}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStatusDirect = async (userId: number, currentStatus: string, name: string) => {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
      const res = await fetch(`http://localhost:8000/admin/users/${userId}/status?status=${nextStatus}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDirect = async (userId: number, name: string) => {
    try {
      const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
      const res = await fetch(`http://localhost:8000/admin/users/${userId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Block */}
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <Users className="w-6 h-6 text-[#4F84F8]" /> Employee Management
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Department: {user.department} — Directory & Administrative Actions
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 bg-[#4F84F8] hover:bg-[#3d6fd8] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* Search and Table Row */}
      <div className="space-y-4">
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

        <div className="stat-card overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-surface-200 dark:border-white/[0.06]">
                <th className="px-4 py-3 font-medium text-surface-500">Employee</th>
                <th className="px-4 py-3 font-medium text-surface-500 text-right">Security Score</th>
                <th className="px-4 py-3 font-medium text-surface-500 text-right">Total Scans</th>
                <th className="px-4 py-3 font-medium text-surface-500 text-right">Blocked Threats</th>
                <th className="px-4 py-3 font-medium text-surface-500">Role</th>
                <th className="px-4 py-3 font-medium text-surface-500">Status</th>
                <th className="px-4 py-3 font-medium text-surface-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-surface-500">No employees found.</td>
                </tr>
              ) : (
                filtered.map(emp => (
                  <tr
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className="border-b border-surface-100 dark:border-white/[0.03] hover:bg-surface-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-surface-900 dark:text-white">{emp.fullName}</div>
                      <div className="text-xs text-surface-500">{emp.email}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${emp.score >= 80 ? 'text-emerald-500' : emp.score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{emp.score}%</span>
                    </td>
                    <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">{emp.total_scans}</td>
                    <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">{emp.threatsCount}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                        emp.role === "manager"
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                          : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                      }`}>
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        emp.account_status === "active"
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                          : "bg-surface-100 dark:bg-white/[0.04] text-surface-600 dark:text-surface-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${emp.account_status === "active" ? "bg-emerald-500" : "bg-surface-400"}`} />
                        {emp.account_status === "active" ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end items-center gap-2">
                        {/* Toggle status (Disable/Enable) */}
                        {emp.id !== user.id ? (
                          <button
                            onClick={() => {
                              const nextStatus = emp.account_status === "active" ? "disable" : "enable";
                              setConfirmModal({
                                title: `${nextStatus === "active" ? "Enable" : "Disable"} Account`,
                                message: `Are you sure you want to ${nextStatus} ${emp.fullName}'s account?`,
                                onConfirm: () => handleToggleStatusDirect(emp.id, emp.account_status, emp.fullName)
                              });
                            }}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                              emp.account_status === "active"
                                ? "border-surface-200 dark:border-white/[0.08] text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-white/[0.02]"
                                : "border-purple-500/30 bg-purple-500/5 text-purple-650 dark:text-purple-400 hover:bg-purple-500/10"
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            {emp.account_status === "active" ? "Disable" : "Enable"}
                          </button>
                        ) : (
                          <span className="text-xs text-surface-400 italic px-2">Current User</span>
                        )}

                        {/* Role Switcher Dropdown */}
                        {emp.id !== user.id ? (
                          <select
                            value={emp.role}
                            onChange={(e) => {
                              const newRole = e.target.value;
                              setConfirmModal({
                                title: "Change User Role",
                                message: `Are you sure you want to change ${emp.fullName}'s role to ${newRole === "manager" ? "Manager" : "Employee"}?`,
                                onConfirm: () => handleRoleChangeDirect(emp.id, newRole, emp.fullName)
                              });
                            }}
                            className="px-2 py-1.5 bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.08] rounded-lg text-xs text-surface-700 dark:text-surface-300 font-bold focus:outline-none focus:border-brand-500/50"
                          >
                            <option value="employee">Employee</option>
                            <option value="manager">Manager</option>
                          </select>
                        ) : (
                          <span className="text-xs text-surface-400 font-bold px-2 py-1.5">Manager</span>
                        )}

                        {/* Change Password (Key) */}
                        <button
                          onClick={() => {
                            setPwModal({ userId: emp.id, userName: emp.fullName });
                            setPwInput("");
                          }}
                          className="p-1.5 text-surface-400 hover:text-amber-500 hover:bg-amber-500/10 rounded transition-colors"
                          title="Change Password"
                        >
                          <Key className="w-4 h-4" />
                        </button>

                        {/* Delete (Trash) */}
                        {emp.id !== user.id && (
                          <button
                            onClick={() => {
                              setConfirmModal({
                                title: "Delete Account",
                                message: `Are you sure you want to delete ${emp.fullName}'s account? This action cannot be undone.`,
                                onConfirm: () => handleDeleteDirect(emp.id, emp.fullName)
                              });
                            }}
                            className="p-1.5 text-surface-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                            title="Delete Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* Add Employee Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.08] w-full max-w-md rounded-xl shadow-xl relative z-10 p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-surface-900 dark:text-white">Add New Employee</h3>
                <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-surface-100 dark:hover:bg-white/[0.05] rounded-md transition-colors"><X className="w-5 h-5 text-surface-500" /></button>
              </div>

              {addError && <div className="p-3 text-xs bg-red-500/15 text-red-500 rounded-lg">{addError}</div>}
              {addSuccess && <div className="p-3 text-xs bg-emerald-500/15 text-emerald-500 rounded-lg flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Employee created successfully!</div>}

              <form onSubmit={handleAddEmployee} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-600 dark:text-surface-400">Full Name</label>
                  <input
                    type="text"
                    value={addName}
                    onChange={e => setAddName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-600 dark:text-surface-400">Email Address</label>
                  <input
                    type="email"
                    value={addEmail}
                    onChange={e => setAddEmail(e.target.value)}
                    placeholder="john@organization.com"
                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-600 dark:text-surface-400">Default Password</label>
                  <input
                    type="password"
                    value={addPassword}
                    onChange={e => setAddPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#4F84F8] hover:bg-[#3d6fd8] text-white text-sm font-bold py-2.5 rounded-lg shadow-sm transition-colors mt-2"
                >
                  Create Account
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Employee Management & Profile Modal */}
      <AnimatePresence>
        {selectedEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setSelectedEmployee(null); setConfirmDelete(false); }} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.08] w-full max-w-2xl rounded-2xl shadow-xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">

              <div className="p-6 border-b border-surface-200 dark:border-white/[0.06] flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-surface-900 dark:text-white">{selectedEmployee.fullName}</h3>
                  <p className="text-sm text-surface-500">Security Health Profile & Account Management</p>
                </div>
                <button onClick={() => { setSelectedEmployee(null); setConfirmDelete(false); }} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/[0.05] transition-colors"><X className="w-5 h-5 text-surface-500" /></button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">

                {/* Score stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.05]">
                    <div className="text-xs text-surface-500 mb-1">Security Score</div>
                    <div className={`text-2xl font-bold ${selectedEmployee.score >= 80 ? 'text-emerald-500' : selectedEmployee.score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{selectedEmployee.score}%</div>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.05]">
                    <div className="text-xs text-surface-500 mb-1">Total Scans</div>
                    <div className="text-2xl font-bold text-surface-900 dark:text-white">{selectedEmployee.total_scans}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.05]">
                    <div className="text-xs text-surface-500 mb-1">Blocked Threats</div>
                    <div className="text-2xl font-bold text-surface-900 dark:text-white">{selectedEmployee.threatsCount}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.05]">
                    <div className="text-xs text-surface-500 mb-1">Role Type</div>
                    <div className="text-2xl font-bold text-surface-900 dark:text-white capitalize">{selectedEmployee.role}</div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl border border-surface-200 dark:border-white/[0.05]">
                    <h4 className="text-sm font-semibold mb-4 flex items-center gap-2 text-surface-900 dark:text-white"><Activity className="w-4 h-4 text-[#4F84F8]" /> Protection Statistics</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-surface-600 dark:text-surface-400 flex items-center gap-2"><Download className="w-4 h-4" /> Downloads Scanned</span>
                        <span className="font-semibold text-surface-900 dark:text-white">{selectedEmployee.downloadsScanned}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-surface-600 dark:text-surface-400 flex items-center gap-2"><Key className="w-4 h-4" /> Credential Warning Events</span>
                        <span className="font-semibold text-surface-900 dark:text-white">{selectedEmployee.credentialEvents}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-surface-600 dark:text-surface-400 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Compliance Rating</span>
                        <span className="font-semibold text-emerald-500">100%</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl border border-surface-200 dark:border-white/[0.05] bg-brand-50/50 dark:bg-brand-900/10">
                    <h4 className="text-sm font-semibold mb-4 flex items-center gap-2 text-surface-900 dark:text-white"><Sparkles className="w-4 h-4 text-brand-500" /> AI Recommendations</h4>
                    <ul className="space-y-3 text-sm text-surface-600 dark:text-surface-400 list-disc list-inside">
                      {selectedEmployee.score >= 80 ? (
                        <>
                          <li>Employee is maintaining excellent security hygiene.</li>
                          <li>No immediate awareness training required.</li>
                        </>
                      ) : (
                        <>
                          <li>Recommend reviewing "Identifying Phishing Links" training.</li>
                          <li>Employee recently interacted with suspicious credential prompts.</li>
                          <li>Consider a brief check-in regarding recent blocked downloads.</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Account Controls Section */}
                <div className="p-5 rounded-xl border border-surface-200 dark:border-white/[0.05] space-y-4">
                  <h4 className="text-sm font-bold flex items-center gap-2 text-surface-900 dark:text-white">
                    <Lock className="w-4 h-4 text-amber-500" /> Administrative Controls
                  </h4>

                  <div className="grid md:grid-cols-2 gap-6 items-start">
                    {/* Password reset form */}
                    <form onSubmit={handleResetPassword} className="space-y-2">
                      <label className="text-xs font-bold text-surface-600 dark:text-surface-400">Change Password</label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="New password..."
                          className="flex-1 px-3 py-1.5 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-xs text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50"
                        />
                        <button
                          type="submit"
                          className="bg-amber-550 hover:bg-amber-600 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-sm transition-colors"
                        >
                          Change
                        </button>
                      </div>
                      {resetSuccess && <p className="text-[10px] text-emerald-500 font-bold">Password reset successfully!</p>}
                    </form>

                    {/* Account modifications */}
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-surface-600 dark:text-surface-400">Role Status</label>
                        {selectedEmployee.role === "employee" ? (
                          <button
                            onClick={handlePromoteUser}
                            className="w-full flex items-center justify-center gap-1.5 border border-[#4F84F8] hover:bg-[#4F84F8]/10 text-[#4F84F8] text-xs font-bold py-2 rounded-lg transition-colors"
                          >
                            <UserCheck className="w-4 h-4" /> Promote to Manager
                          </button>
                        ) : (
                          <p className="text-xs text-surface-500 italic mt-1">This user is already a manager.</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 pt-2 border-t border-surface-200 dark:border-white/[0.05]">
                        <label className="text-xs font-bold text-red-500">Danger Zone</label>
                        {!confirmDelete ? (
                          <button
                            onClick={() => setConfirmDelete(true)}
                            className="w-full flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-650 dark:text-red-400 text-xs font-bold py-2 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" /> Delete Account
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={handleDeleteUser}
                              className="flex-1 bg-red-650 hover:bg-red-700 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                            >
                              Confirm Delete
                            </button>
                            <button
                              onClick={() => setConfirmDelete(false)}
                              className="flex-1 border border-surface-300 text-surface-700 dark:border-white/[0.08] dark:text-surface-300 text-xs font-bold py-2 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirm Modal */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmModal(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.08] w-full max-w-sm rounded-xl shadow-xl relative z-10 p-6 space-y-4">
              <h3 className="text-base font-bold text-surface-900 dark:text-white">{confirmModal.title}</h3>
              <p className="text-sm text-surface-500">{confirmModal.message}</p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 border border-surface-200 dark:border-white/[0.08] text-surface-700 dark:text-surface-300 text-xs font-bold rounded-lg hover:bg-surface-100 dark:hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  className="px-4 py-2 bg-[#4F84F8] hover:bg-[#3d6fd8] text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Password Modal */}
      <AnimatePresence>
        {pwModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPwModal(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.08] w-full max-w-sm rounded-xl shadow-xl relative z-10 p-6 space-y-4">
              <h3 className="text-base font-bold text-surface-900 dark:text-white">Change Password</h3>
              <p className="text-sm text-surface-500">Enter new password for {pwModal.userName}</p>
              <input
                type="password"
                value={pwInput}
                onChange={e => setPwInput(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setPwModal(null)}
                  className="px-4 py-2 border border-surface-200 dark:border-white/[0.08] text-surface-700 dark:text-surface-300 text-xs font-bold rounded-lg hover:bg-surface-100 dark:hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleResetPasswordDirect(pwModal.userId, pwInput)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  Update Password
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
