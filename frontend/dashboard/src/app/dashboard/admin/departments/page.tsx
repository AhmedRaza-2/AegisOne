"use client";
import { Building2, Plus, Users, Trash2, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";

export default function DepartmentsPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form States
  const [name, setName] = useState("");
  const [managerId, setManagerId] = useState("");

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("aegis_access_token");
      if (!token) return;

      const res = await fetch("http://localhost:8000/admin/departments", {
        headers: { Authorization: `Bearer ${token}` }
      });
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
    fetchData();
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
        body: JSON.stringify({
          name,
          manager_id: managerId ? parseInt(managerId) : null
        })
      });

      if (res.ok) {
        await fetchData();
        setName("");
        setManagerId("");
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
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
