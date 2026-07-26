"use client";
<<<<<<< Updated upstream
import { Building2, Plus, Users, Trash2, X } from "lucide-react";
=======
import { Building2, Plus, ShieldCheck, ShieldOff, Key, X, AlertCircle } from "lucide-react";
>>>>>>> Stashed changes
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";

export default function DepartmentsPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<any[]>([]);
<<<<<<< Updated upstream
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form States
  const [name, setName] = useState("");
  const [managerId, setManagerId] = useState("");

  const fetchData = async () => {
=======
  const [loading, setLoading] = useState(true);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");

  const fetchDepartments = async () => {
>>>>>>> Stashed changes
    try {
      const token = localStorage.getItem("aegis_access_token");
      if (!token) return;

      const res = await fetch("http://localhost:8000/admin/departments", {
        headers: { Authorization: `Bearer ${token}` }
      });
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
<<<<<<< Updated upstream
    fetchData();
=======
    fetchDepartments();
>>>>>>> Stashed changes
  }, []);

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      const token = localStorage.getItem("aegis_access_token");
      const res = await fetch("http://localhost:8000/admin/departments", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
<<<<<<< Updated upstream
        body: JSON.stringify({
          name,
          manager_id: managerId ? parseInt(managerId) : null
        })
      });

      if (res.ok) {
        await fetchData();
        setName("");
        setManagerId("");
=======
        body: JSON.stringify({ name })
      });

      if (res.ok) {
        await fetchDepartments();
        setName("");
>>>>>>> Stashed changes
        setShowAddModal(false);
      } else {
        const error = await res.json();
        alert(error.detail || "Failed to create department");
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
            <Building2 className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Department Management
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
<<<<<<< Updated upstream
            Manage organization structure and department leads
          </p>
        </div>
        {user.role === "admin" || user.role === "super_admin" || user.role === "global_admin" ? (
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Department
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-surface-500">Loading departments...</div>
        ) : departments.length === 0 ? (
          <div className="col-span-full p-8 text-center text-surface-500">No departments found.</div>
        ) : (
          departments.map(dept => (
            <div key={dept.id} className="glass-card p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg text-surface-900 dark:text-white">{dept.name}</h3>
                </div>
                <div className="text-sm text-surface-500 flex items-center gap-2 mt-4">
                  <Users className="w-4 h-4" /> Manager ID: {dept.manager_id || "Unassigned"}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Add Department */}
=======
            Create and manage organizational departments
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Department
        </button>
      </div>

      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-surface-600 dark:text-surface-300">
            <thead className="bg-surface-50 dark:bg-surface-800/50 text-xs uppercase text-surface-500 dark:text-surface-400 border-b border-surface-200 dark:border-white/[0.08]">
              <tr>
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">Department Name</th>
                <th className="px-6 py-4 font-semibold">Manager ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-white/[0.04]">
              {loading ? (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-surface-500">Loading...</td></tr>
              ) : departments.length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-surface-500">No departments found.</td></tr>
              ) : (
                departments.map(d => (
                  <tr key={d.id} className="hover:bg-surface-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">{d.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-surface-900 dark:text-white">{d.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{d.manager_id || "None"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

>>>>>>> Stashed changes
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] w-full max-w-md rounded-xl shadow-lg relative z-10 overflow-hidden">
              <div className="p-6 border-b border-surface-200 dark:border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Add Department</h3>
                  <button onClick={() => setShowAddModal(false)} className="text-surface-400 hover:text-surface-600"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <form onSubmit={handleAddDepartment} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Department Name</label>
<<<<<<< Updated upstream
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Finance"
                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2 border-t border-surface-200 dark:border-white/[0.06]">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-medium text-surface-500 hover:text-surface-800 dark:text-surface-400 dark:hover:text-white">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg transition-colors">Create</button>
=======
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Finance" className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white" />
                </div>
                <div className="flex gap-3 justify-end pt-2 border-t border-surface-200 dark:border-white/[0.06]">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-medium text-surface-500 hover:text-surface-800 dark:text-surface-400 dark:hover:text-white">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg">Create</button>
>>>>>>> Stashed changes
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
